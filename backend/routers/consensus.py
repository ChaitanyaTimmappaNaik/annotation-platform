from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import User, Task, TaskStatus, TaskActivityLog
from auth import get_current_user, require_admin
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import json

router = APIRouter(prefix="/consensus", tags=["consensus"])

class ConsensusAnnotationSubmit(BaseModel):
    task_id: int
    batch_id: int
    dataset_object_id: int
    label_data: Dict[str, Any]
    notes: Optional[str] = None
    time_spent: Optional[int] = 0

def now_utc():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def calculate_agreement(ann1: dict, ann2: dict, ann3: dict) -> float:
    try:
        scores = []
        # Check has_harm agreement
        v1 = str(ann1.get("has_harm", ""))
        v2 = str(ann2.get("has_harm", ""))
        v3 = str(ann3.get("has_harm", ""))
        agreements = sum([v1 == v2, v2 == v3, v1 == v3])
        scores.append(agreements / 3.0)

        # Check intent agreement
        v1 = str(ann1.get("intent", ""))
        v2 = str(ann2.get("intent", ""))
        v3 = str(ann3.get("intent", ""))
        agreements = sum([v1 == v2, v2 == v3, v1 == v3])
        scores.append(agreements / 3.0)

        # Check harm categories agreement
        cats1 = ann1.get("harm_categories", {}) or {}
        cats2 = ann2.get("harm_categories", {}) or {}
        cats3 = ann3.get("harm_categories", {}) or {}
        all_cats = set(
            list(cats1.keys()) +
            list(cats2.keys()) +
            list(cats3.keys())
        )
        for cat in all_cats:
            i1 = str((cats1.get(cat) or {}).get("intensity", ""))
            i2 = str((cats2.get(cat) or {}).get("intensity", ""))
            i3 = str((cats3.get(cat) or {}).get("intensity", ""))
            agreements = sum([i1 == i2, i2 == i3, i1 == i3])
            scores.append(agreements / 3.0)

        return round(sum(scores) / len(scores) if scores else 0, 4)
    except:
        return 0.0

def determine_consensus(ann1: dict, ann2: dict, ann3: dict) -> dict:
    consensus = {}

    # has_harm majority vote
    vals = [ann1.get("has_harm"), ann2.get("has_harm"), ann3.get("has_harm")]
    for v in vals:
        if vals.count(v) >= 2:
            consensus["has_harm"] = v
            break
    else:
        consensus["has_harm"] = None

    # intent majority vote
    vals = [ann1.get("intent"), ann2.get("intent"), ann3.get("intent")]
    for v in vals:
        if vals.count(v) >= 2:
            consensus["intent"] = v
            break
    else:
        consensus["intent"] = None

    # harm_categories majority vote per category
    cats1 = ann1.get("harm_categories", {}) or {}
    cats2 = ann2.get("harm_categories", {}) or {}
    cats3 = ann3.get("harm_categories", {}) or {}
    all_cats = set(
        list(cats1.keys()) +
        list(cats2.keys()) +
        list(cats3.keys())
    )

    consensus_cats = {}
    for cat in all_cats:
        c1 = cats1.get(cat, {}) or {}
        c2 = cats2.get(cat, {}) or {}
        c3 = cats3.get(cat, {}) or {}

        cat_consensus = {}
        for field in ["intensity", "severity", "confidence"]:
            fvals = [c1.get(field), c2.get(field), c3.get(field)]
            for v in fvals:
                if fvals.count(v) >= 2:
                    cat_consensus[field] = v
                    break
            else:
                cat_consensus[field] = None
        consensus_cats[cat] = cat_consensus

    consensus["harm_categories"] = consensus_cats
    return consensus

@router.post("/submit")
async def submit_consensus_annotation(
    data: ConsensusAnnotationSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Mark assignment as completed
    db.execute(text(f"""
        UPDATE task_assignments
        SET status = 'completed', completed_at = NOW()
        WHERE task_id = {data.task_id}
        AND user_id = {current_user.id}
        AND batch_id = {data.batch_id}
    """))

    # Save annotation
    label_json = json.dumps(data.label_data).replace("'", "''")
    notes_val = (data.notes or "").replace("'", "''")

    existing = db.execute(text(
        f"SELECT id FROM annotations WHERE task_id = {data.task_id} "
        f"AND annotator_id = {current_user.id}"
    )).fetchone()

    if existing:
        db.execute(text(f"""
            UPDATE annotations
            SET label_data = '{label_json}'::jsonb,
                notes = '{notes_val}',
                time_spent = {data.time_spent or 0},
                submitted_at = NOW()
            WHERE task_id = {data.task_id}
            AND annotator_id = {current_user.id}
        """))
    else:
        db.execute(text(f"""
            INSERT INTO annotations
            (task_id, annotator_id, label_data, notes, time_spent, submitted_at)
            VALUES ({data.task_id}, {current_user.id},
                    '{label_json}'::jsonb,
                    '{notes_val}',
                    {data.time_spent or 0}, NOW())
        """))

    # Check annotation count
    annotation_count = db.execute(text(
        f"SELECT COUNT(*) FROM annotations WHERE task_id = {data.task_id}"
    )).scalar()

    required = db.execute(text(
        f"SELECT required_annotators FROM tasks WHERE id = {data.task_id}"
    )).scalar() or 3

    if annotation_count >= required:
        # Fetch all annotations with user info
        annotations = db.execute(text(f"""
            SELECT a.annotator_id, a.label_data, u.username,
                   a.submitted_at, a.time_spent
            FROM annotations a
            JOIN users u ON u.id = a.annotator_id
            WHERE a.task_id = {data.task_id}
            ORDER BY a.submitted_at ASC
            LIMIT 3
        """)).fetchall()

        if len(annotations) >= 2:
            ann_data = [
                dict(row[1]) if isinstance(row[1], dict) else {}
                for row in annotations
            ]
            while len(ann_data) < 3:
                ann_data.append({})

            agreement = calculate_agreement(
                ann_data[0], ann_data[1], ann_data[2]
            )
            consensus = determine_consensus(
                ann_data[0], ann_data[1], ann_data[2]
            )

            consensus_json = json.dumps(consensus).replace("'", "''")
            ann1_json = json.dumps(ann_data[0]).replace("'", "''")
            ann2_json = json.dumps(ann_data[1]).replace("'", "''")
            ann3_json = json.dumps(ann_data[2]).replace("'", "''")

            ann_ids = [row[0] for row in annotations]
            while len(ann_ids) < 3:
                ann_ids.append(None)

            status = "agreed" if agreement >= 0.7 else "needs_review"

            # Save/update consensus
            existing_c = db.execute(text(
                f"SELECT id FROM annotation_consensus "
                f"WHERE task_id = {data.task_id}"
            )).fetchone()

            id2 = ann_ids[1] if ann_ids[1] else "NULL"
            id3 = ann_ids[2] if ann_ids[2] else "NULL"

            if existing_c:
                db.execute(text(f"""
                    UPDATE annotation_consensus SET
                        annotation_1 = '{ann1_json}'::jsonb,
                        annotation_2 = '{ann2_json}'::jsonb,
                        annotation_3 = '{ann3_json}'::jsonb,
                        annotator_1_id = {ann_ids[0]},
                        annotator_2_id = {id2},
                        annotator_3_id = {id3},
                        consensus_result = '{consensus_json}'::jsonb,
                        agreement_score = {agreement},
                        status = '{status}',
                        updated_at = NOW()
                    WHERE task_id = {data.task_id}
                """))
            else:
                db.execute(text(f"""
                    INSERT INTO annotation_consensus
                    (task_id, dataset_object_id, iteration,
                     annotator_1_id, annotator_2_id, annotator_3_id,
                     annotation_1, annotation_2, annotation_3,
                     consensus_result, agreement_score, status)
                    VALUES (
                        {data.task_id}, {data.dataset_object_id}, 1,
                        {ann_ids[0]}, {id2}, {id3},
                        '{ann1_json}'::jsonb,
                        '{ann2_json}'::jsonb,
                        '{ann3_json}'::jsonb,
                        '{consensus_json}'::jsonb,
                        {agreement}, '{status}'
                    )
                """))

            new_status = "completed" if agreement >= 0.7 else "under_review"
            db.execute(text(
                f"UPDATE tasks SET status = '{new_status}' "
                f"WHERE id = {data.task_id}"
            ))
    else:
        db.execute(text(
            f"UPDATE tasks SET status = 'in_progress' "
            f"WHERE id = {data.task_id}"
        ))

    log = TaskActivityLog(
        task_id=data.task_id,
        user_id=current_user.id,
        action="submitted",
        detail=f"Annotation submitted by {current_user.username} "
               f"({annotation_count}/{required} annotators)"
    )
    db.add(log)
    db.commit()

    # Get next pending task
    next_task = db.execute(text(f"""
        SELECT ta.task_id, bts.sequence_order, t.title
        FROM task_assignments ta
        JOIN batch_task_sequences bts
            ON bts.task_id = ta.task_id
            AND bts.batch_id = {data.batch_id}
        JOIN tasks t ON t.id = ta.task_id
        WHERE ta.user_id = {current_user.id}
        AND ta.batch_id = {data.batch_id}
        AND ta.status = 'pending'
        ORDER BY bts.sequence_order ASC
        LIMIT 1
    """)).fetchone()

    return {
        "message": "Annotation submitted successfully",
        "annotation_count": annotation_count,
        "required": required,
        "next_task_id": next_task[0] if next_task else None,
        "batch_complete": next_task is None
    }

@router.get("/results/{batch_id}")
async def get_consensus_results(
    batch_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    results = db.execute(text(f"""
        SELECT
            ac.task_id, ac.dataset_object_id, ac.iteration,
            ac.agreement_score, ac.status,
            ac.annotation_1, ac.annotation_2, ac.annotation_3,
            ac.consensus_result, ac.created_at, ac.updated_at,
            t.title, t.data_content, t.customer_id,
            u1.username as annotator_1, u1.id as ann1_id,
            u2.username as annotator_2, u2.id as ann2_id,
            u3.username as annotator_3, u3.id as ann3_id
        FROM annotation_consensus ac
        JOIN tasks t ON t.id = ac.task_id
        JOIN batch_task_sequences bts
            ON bts.task_id = ac.task_id
            AND bts.batch_id = {batch_id}
        LEFT JOIN users u1 ON u1.id = ac.annotator_1_id
        LEFT JOIN users u2 ON u2.id = ac.annotator_2_id
        LEFT JOIN users u3 ON u3.id = ac.annotator_3_id
        ORDER BY ac.dataset_object_id ASC
    """)).fetchall()

    return [
        {
            "task_id": r[0],
            "dataset_object_id": r[1],
            "iteration": r[2],
            "agreement_score": r[3],
            "status": r[4],
            "annotation_1": r[5],
            "annotation_2": r[6],
            "annotation_3": r[7],
            "consensus_result": r[8],
            "created_at": str(r[9]) if r[9] else None,
            "updated_at": str(r[10]) if r[10] else None,
            "title": r[11],
            "data_content": r[12],
            "customer_id": r[13],
            "annotator_1": r[14],
            "annotator_1_id": r[15],
            "annotator_2": r[16],
            "annotator_2_id": r[17],
            "annotator_3": r[18],
            "annotator_3_id": r[19],
        }
        for r in results
    ]

@router.get("/export/{batch_id}")
async def export_consensus_json_v2(
    batch_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Get batch info
    batch = db.execute(text(f"""
        SELECT qb.id, qb.name, qb.project_id, qb.created_at,
               p.name as project_name
        FROM queue_batches qb
        JOIN projects p ON p.id = qb.project_id
        WHERE qb.id = {batch_id}
    """)).fetchone()

    if not batch:
        raise HTTPException(404, "Batch not found")

    # Get all results
    results = await get_consensus_results(batch_id, admin, db)

    total = len(results)
    agreed = sum(1 for r in results if r["status"] == "agreed")
    needs_review = sum(
        1 for r in results if r["status"] == "needs_review"
    )
    pending = sum(
        1 for r in results
        if not r["status"] or r["status"] == "pending"
    )

    # Get customer_id from first task
    customer_id = results[0]["customer_id"] if results else "977099032732"

    # Build v2.0 export
    tasks_export = []
    for r in results:
        # Build annotations array
        annotations = []
        for i, (ann_data, ann_id, ann_username) in enumerate([
            (r["annotation_1"], r["annotator_1_id"], r["annotator_1"]),
            (r["annotation_2"], r["annotator_2_id"], r["annotator_2"]),
            (r["annotation_3"], r["annotator_3_id"], r["annotator_3"]),
        ], 1):
            if ann_data is not None:
                annotations.append({
                    "workerId": f"worker-{str(i).zfill(3)}",
                    "annotatorId": ann_id,
                    "annotatorUsername": ann_username,
                    "label_data": ann_data
                })

        # Build ground truth (only if agreed)
        ground_truth = None
        if r["status"] == "agreed" and r["consensus_result"]:
            ground_truth = {
                **r["consensus_result"],
                "auto_accepted": True,
                "accepted_at": r["updated_at"]
            }
        elif r["status"] == "needs_review" and r["consensus_result"]:
            ground_truth = {
                **r["consensus_result"],
                "auto_accepted": False,
                "requires_arbitration": True
            }

        tasks_export.append({
            "datasetObjectId": r["dataset_object_id"],
            "taskId": r["task_id"],
            "title": r["title"],
            "source": r["data_content"],
            "customer_id": r["customer_id"],
            "iteration": r["iteration"] or 1,
            "annotations": annotations,
            "consensus": r["consensus_result"],
            "agreement_score": r["agreement_score"],
            "status": r["status"] or "pending",
            "ground_truth": ground_truth,
            "metadata": {
                "created_at": r["created_at"],
                "completed_at": r["updated_at"],
                "schema_version": "2.0"
            }
        })

    export = {
        "schema_version": "2.0",
        "export_timestamp": datetime.now(
            timezone.utc
        ).isoformat().replace("+00:00", "Z"),
        "batch": {
            "id": batch[0],
            "name": batch[1],
            "project_id": batch[2],
            "project_name": batch[4],
            "customer_id": customer_id,
            "created_at": str(batch[3]) if batch[3] else None,
            "total_tasks": total,
            "agreed_tasks": agreed,
            "needs_review_tasks": needs_review,
            "pending_tasks": pending,
            "agreement_rate": round(
                agreed / total * 100, 1
            ) if total > 0 else 0
        },
        "tasks": tasks_export
    }

    return JSONResponse(
        content=export,
        headers={
            "Content-Disposition": f'attachment; '
            f'filename="bbc-CF-export-v2-batch{batch_id}.json"'
        }
    )