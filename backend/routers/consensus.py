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

def clean_annotation(ann: dict) -> dict:
    """Strip internal system fields — only keep annotation fields."""
    ignore = {
        "task_id", "batch_id", "dataset_object_id",
        "annotator_id", "submitted_at", "overall_comments",
        "intent_rationale"
    }
    return {k: v for k, v in ann.items() if k not in ignore}

def calculate_agreement(ann1: dict, ann2: dict, ann3: dict) -> float:
    """Calculate agreement score between 3 annotators.
    Only compares meaningful annotation fields.
    Returns 0.0 - 1.0 where 1.0 = perfect agreement.
    """
    try:
        a1 = clean_annotation(ann1)
        a2 = clean_annotation(ann2)
        a3 = clean_annotation(ann3)

        scores = []

        # has_harm — weighted x2 (primary gate)
        v1 = str(a1.get("has_harm", ""))
        v2 = str(a2.get("has_harm", ""))
        v3 = str(a3.get("has_harm", ""))
        agree = sum([v1 == v2, v2 == v3, v1 == v3])
        scores.append(agree / 3.0)
        scores.append(agree / 3.0)

        # intent
        v1 = str(a1.get("intent", ""))
        v2 = str(a2.get("intent", ""))
        v3 = str(a3.get("intent", ""))
        agree = sum([v1 == v2, v2 == v3, v1 == v3])
        scores.append(agree / 3.0)

        # intent_confidence_level
        v1 = str(a1.get("intent_confidence_level", ""))
        v2 = str(a2.get("intent_confidence_level", ""))
        v3 = str(a3.get("intent_confidence_level", ""))
        agree = sum([v1 == v2, v2 == v3, v1 == v3])
        scores.append(agree / 3.0)

        # harm_categories — intensity + severity per category
        cats1 = a1.get("harm_categories", {}) or {}
        cats2 = a2.get("harm_categories", {}) or {}
        cats3 = a3.get("harm_categories", {}) or {}
        all_cats = set(
            list(cats1.keys()) +
            list(cats2.keys()) +
            list(cats3.keys())
        )

        for cat in all_cats:
            c1 = cats1.get(cat, {}) or {}
            c2 = cats2.get(cat, {}) or {}
            c3 = cats3.get(cat, {}) or {}

            # intensity agreement
            i1 = str(c1.get("intensity", ""))
            i2 = str(c2.get("intensity", ""))
            i3 = str(c3.get("intensity", ""))
            agree = sum([i1 == i2, i2 == i3, i1 == i3])
            scores.append(agree / 3.0)

            # severity agreement
            s1 = str(c1.get("severity", ""))
            s2 = str(c2.get("severity", ""))
            s3 = str(c3.get("severity", ""))
            agree = sum([s1 == s2, s2 == s3, s1 == s3])
            scores.append(agree / 3.0)

        return round(sum(scores) / len(scores) if scores else 0, 4)
    except Exception as e:
        return 0.0

def determine_consensus(ann1: dict, ann2: dict, ann3: dict) -> dict:
    """Determine consensus by majority vote (2 of 3).
    Only includes clean annotation fields.
    """
    a1 = clean_annotation(ann1)
    a2 = clean_annotation(ann2)
    a3 = clean_annotation(ann3)

    consensus = {}

    # has_harm majority vote
    vals = [a1.get("has_harm"), a2.get("has_harm"), a3.get("has_harm")]
    for v in vals:
        if vals.count(v) >= 2:
            consensus["has_harm"] = v
            break
    else:
        consensus["has_harm"] = None

    # intent majority vote
    vals = [a1.get("intent"), a2.get("intent"), a3.get("intent")]
    for v in vals:
        if vals.count(v) >= 2:
            consensus["intent"] = v
            break
    else:
        consensus["intent"] = None

    # intent_confidence_level majority vote
    vals = [
        a1.get("intent_confidence_level"),
        a2.get("intent_confidence_level"),
        a3.get("intent_confidence_level")
    ]
    for v in vals:
        if vals.count(v) >= 2:
            consensus["intent_confidence_level"] = v
            break
    else:
        consensus["intent_confidence_level"] = None

    # harm_categories majority vote per category per field
    cats1 = a1.get("harm_categories", {}) or {}
    cats2 = a2.get("harm_categories", {}) or {}
    cats3 = a3.get("harm_categories", {}) or {}
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
        cat_result = {}
        for field in ["intensity", "severity", "confidence"]:
            fvals = [c1.get(field), c2.get(field), c3.get(field)]
            for v in fvals:
                if fvals.count(v) >= 2:
                    cat_result[field] = v
                    break
            else:
                cat_result[field] = None
        consensus_cats[cat] = cat_result

    consensus["harm_categories"] = consensus_cats
    return consensus

@router.post("/submit")
async def submit_consensus_annotation(
    data: ConsensusAnnotationSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Mark this user's assignment as completed
    db.execute(text(f"""
        UPDATE task_assignments
        SET status = 'completed', completed_at = NOW()
        WHERE task_id = {data.task_id}
        AND user_id = {current_user.id}
        AND batch_id = {data.batch_id}
    """))

    # Clean label_data before saving
    clean_data = clean_annotation(data.label_data)
    # Keep only annotation-relevant fields
    save_data = {
        "has_harm": data.label_data.get("has_harm"),
        "intent": data.label_data.get("intent"),
        "intent_rationale": data.label_data.get("intent_rationale", ""),
        "intent_confidence_level": data.label_data.get(
            "intent_confidence_level", ""
        ),
        "harm_categories": data.label_data.get("harm_categories", {}),
        "overall_comments": data.label_data.get("overall_comments", "")
    }

    label_json = json.dumps(save_data).replace("'", "''")
    notes_val = (data.notes or "").replace("'", "''")

    # Save or update annotation
    existing = db.execute(text(
        f"SELECT id FROM annotations "
        f"WHERE task_id = {data.task_id} "
        f"AND annotator_id = {current_user.id}"
    )).fetchone()

    if existing:
        db.execute(text(f"""
            UPDATE annotations SET
                label_data = '{label_json}'::jsonb,
                notes = '{notes_val}',
                time_spent = {data.time_spent or 0},
                submitted_at = NOW()
            WHERE task_id = {data.task_id}
            AND annotator_id = {current_user.id}
        """))
    else:
        db.execute(text(f"""
            INSERT INTO annotations
            (task_id, annotator_id, label_data,
             notes, time_spent, submitted_at)
            VALUES (
                {data.task_id}, {current_user.id},
                '{label_json}'::jsonb,
                '{notes_val}',
                {data.time_spent or 0}, NOW()
            )
        """))

    # Count annotations submitted so far
    annotation_count = db.execute(text(
        f"SELECT COUNT(*) FROM annotations "
        f"WHERE task_id = {data.task_id}"
    )).scalar()

    required = db.execute(text(
        f"SELECT required_annotators FROM tasks "
        f"WHERE id = {data.task_id}"
    )).scalar() or 3

    if annotation_count >= required:
        # All annotators done — run consensus
        annotations = db.execute(text(f"""
            SELECT a.annotator_id, a.label_data,
                   u.username, a.submitted_at, a.time_spent
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

            id1 = ann_ids[0]
            id2 = ann_ids[1] if ann_ids[1] else "NULL"
            id3 = ann_ids[2] if ann_ids[2] else "NULL"
            status = "agreed" if agreement >= 0.7 else "needs_review"

            existing_c = db.execute(text(
                f"SELECT id FROM annotation_consensus "
                f"WHERE task_id = {data.task_id}"
            )).fetchone()

            if existing_c:
                db.execute(text(f"""
                    UPDATE annotation_consensus SET
                        annotation_1 = '{ann1_json}'::jsonb,
                        annotation_2 = '{ann2_json}'::jsonb,
                        annotation_3 = '{ann3_json}'::jsonb,
                        annotator_1_id = {id1},
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
                        {id1}, {id2}, {id3},
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
        detail=(
            f"Annotation submitted by {current_user.username} "
            f"({annotation_count}/{required} annotators)"
        )
    )
    db.add(log)
    db.commit()

    # Get next pending task for this user in this batch
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
        "agreement_score": None,
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
    batch = db.execute(text(f"""
        SELECT qb.id, qb.name, qb.project_id,
               qb.created_at, p.name as project_name
        FROM queue_batches qb
        JOIN projects p ON p.id = qb.project_id
        WHERE qb.id = {batch_id}
    """)).fetchone()

    if not batch:
        raise HTTPException(404, "Batch not found")

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
    customer_id = results[0]["customer_id"] if results else "977099032732"

    tasks_export = []
    for r in results:
        annotations = []
        for i, (ann_data, ann_id, ann_user) in enumerate([
            (r["annotation_1"], r["annotator_1_id"], r["annotator_1"]),
            (r["annotation_2"], r["annotator_2_id"], r["annotator_2"]),
            (r["annotation_3"], r["annotator_3_id"], r["annotator_3"]),
        ], 1):
            if ann_data is not None:
                annotations.append({
                    "workerId": f"worker-{str(i).zfill(3)}",
                    "annotatorId": ann_id,
                    "annotatorUsername": ann_user,
                    "label_data": ann_data
                })

        # Ground truth — only for decided tasks
        ground_truth = None
        if r["status"] == "agreed" and r["consensus_result"]:
            ground_truth = {
                **r["consensus_result"],
                "auto_accepted": True,
                "accepted_at": r["updated_at"],
                "result": "PASSED"
            }
        elif r["status"] == "needs_review" and r["consensus_result"]:
            ground_truth = {
                **r["consensus_result"],
                "auto_accepted": False,
                "requires_arbitration": True,
                "result": "FAILED — sent to arbitration"
            }

        pct = round((r["agreement_score"] or 0) * 100, 1)
        passed = (r["agreement_score"] or 0) >= 0.7

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
            "agreement_percentage": f"{pct}%",
            "passed": passed,
            "status": r["status"] or "pending",
            "result": (
                "✅ PASSED — Ground truth auto-accepted"
                if passed else
                "⚠️ FAILED — Needs arbitration review"
            ),
            "ground_truth": ground_truth,
            "metadata": {
                "created_at": r["created_at"],
                "completed_at": r["updated_at"],
                "schema_version": "2.0",
                "threshold": 0.7,
                "rule": "agreement_score >= 0.7 → PASSED"
            }
        })

    export = {
        "schema_version": "2.0",
        "export_timestamp": datetime.now(
            timezone.utc
        ).isoformat().replace("+00:00", "Z"),
        "consensus_rule": {
            "threshold": 0.7,
            "description": (
                "agreement_score >= 0.70 → agreed (PASSED). "
                "agreement_score < 0.70 → needs_review (FAILED)"
            ),
            "annotators_required": 3,
            "majority": "2 of 3"
        },
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
            "agreement_rate": (
                f"{round(agreed / total * 100, 1)}%"
                if total > 0 else "0%"
            )
        },
        "tasks": tasks_export
    }

    return JSONResponse(
        content=export,
        headers={
            "Content-Disposition": (
                f'attachment; filename='
                f'"bbc-CF-export-v2-batch{batch_id}.json"'
            )
        }
    )