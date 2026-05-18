from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import User, Task, TaskStatus, TaskActivityLog
from auth import get_current_user, require_admin
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import json

router = APIRouter(prefix="/consensus", tags=["consensus"])

class ConsensusAnnotationSubmit(BaseModel):
    task_id: int
    batch_id: int
    dataset_object_id: int
    label_data: Dict[str, Any]
    notes: Optional[str] = None
    time_spent: Optional[int] = 0

def calculate_agreement(ann1: dict, ann2: dict, ann3: dict) -> float:
    """Calculate agreement score between 3 annotators."""
    try:
        scores = []
        all_keys = set(list(ann1.keys()) + list(ann2.keys()) + list(ann3.keys()))
        for key in all_keys:
            v1 = str(ann1.get(key, ""))
            v2 = str(ann2.get(key, ""))
            v3 = str(ann3.get(key, ""))
            agreements = sum([v1 == v2, v2 == v3, v1 == v3])
            scores.append(agreements / 3.0)
        return round(sum(scores) / len(scores) if scores else 0, 2)
    except:
        return 0.0

def determine_consensus(ann1: dict, ann2: dict, ann3: dict) -> dict:
    """Determine consensus by majority vote."""
    consensus = {}
    all_keys = set(list(ann1.keys()) + list(ann2.keys()) + list(ann3.keys()))
    for key in all_keys:
        v1 = ann1.get(key)
        v2 = ann2.get(key)
        v3 = ann3.get(key)
        values = [v1, v2, v3]
        # Majority vote
        for val in [v1, v2, v3]:
            if values.count(val) >= 2:
                consensus[key] = val
                break
        else:
            consensus[key] = None  # No majority
    return consensus

@router.post("/submit")
async def submit_consensus_annotation(
    data: ConsensusAnnotationSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Update task assignment as completed
    db.execute(text(f"""
        UPDATE task_assignments
        SET status = 'completed', completed_at = NOW()
        WHERE task_id = {data.task_id}
        AND user_id = {current_user.id}
        AND batch_id = {data.batch_id}
    """))

    # Save annotation
    existing = db.execute(text(
        f"SELECT id FROM annotations WHERE task_id = {data.task_id} "
        f"AND annotator_id = {current_user.id}"
    )).fetchone()

    label_json = json.dumps(data.label_data)
    notes_val = (data.notes or "").replace("'", "''")

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
            INSERT INTO annotations (task_id, annotator_id, label_data, notes, time_spent, submitted_at)
            VALUES ({data.task_id}, {current_user.id},
                    '{label_json}'::jsonb,
                    '{notes_val}',
                    {data.time_spent or 0}, NOW())
        """))

    # Check how many annotators have submitted for this task
    annotation_count = db.execute(text(
        f"SELECT COUNT(*) FROM annotations WHERE task_id = {data.task_id}"
    )).scalar()

    # Update task status based on annotation count
    required = db.execute(text(
        f"SELECT required_annotators FROM tasks WHERE id = {data.task_id}"
    )).scalar() or 3

    if annotation_count >= required:
        # All annotators done — run consensus
        annotations = db.execute(text(f"""
            SELECT a.annotator_id, a.label_data, u.username
            FROM annotations a
            JOIN users u ON u.id = a.annotator_id
            WHERE a.task_id = {data.task_id}
            ORDER BY a.submitted_at ASC
            LIMIT 3
        """)).fetchall()

        if len(annotations) >= 2:
            ann_data = [dict(row[1]) if isinstance(row[1], dict) else {} for row in annotations]
            while len(ann_data) < 3:
                ann_data.append({})

            agreement = calculate_agreement(ann_data[0], ann_data[1], ann_data[2])
            consensus = determine_consensus(ann_data[0], ann_data[1], ann_data[2])

            consensus_json = json.dumps(consensus)
            ann1_json = json.dumps(ann_data[0])
            ann2_json = json.dumps(ann_data[1])
            ann3_json = json.dumps(ann_data[2])

            ann_ids = [row[0] for row in annotations]
            while len(ann_ids) < 3:
                ann_ids.append("NULL")

            # Save consensus
            existing_consensus = db.execute(text(
                f"SELECT id FROM annotation_consensus WHERE task_id = {data.task_id}"
            )).fetchone()

            if existing_consensus:
                db.execute(text(f"""
                    UPDATE annotation_consensus
                    SET annotation_1 = '{ann1_json}'::jsonb,
                        annotation_2 = '{ann2_json}'::jsonb,
                        annotation_3 = '{ann3_json}'::jsonb,
                        annotator_1_id = {ann_ids[0]},
                        annotator_2_id = {ann_ids[1]},
                        annotator_3_id = {ann_ids[2] if ann_ids[2] != 'NULL' else 'NULL'},
                        consensus_result = '{consensus_json}'::jsonb,
                        agreement_score = {agreement},
                        status = '{"agreed" if agreement >= 0.7 else "needs_review"}',
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
                        {ann_ids[0]}, {ann_ids[1]},
                        {ann_ids[2] if ann_ids[2] != 'NULL' else 'NULL'},
                        '{ann1_json}'::jsonb,
                        '{ann2_json}'::jsonb,
                        '{ann3_json}'::jsonb,
                        '{consensus_json}'::jsonb,
                        {agreement},
                        '{"agreed" if agreement >= 0.7 else "needs_review"}'
                    )
                """))

            # Update task status
            new_status = "completed" if agreement >= 0.7 else "under_review"
            db.execute(text(
                f"UPDATE tasks SET status = '{new_status}' WHERE id = {data.task_id}"
            ))
        else:
            db.execute(text(
                f"UPDATE tasks SET status = 'under_review' WHERE id = {data.task_id}"
            ))
    else:
        # Keep as in_progress — more annotators needed
        db.execute(text(
            f"UPDATE tasks SET status = 'in_progress' WHERE id = {data.task_id}"
        ))

    # Log activity
    log = TaskActivityLog(
        task_id=data.task_id,
        user_id=current_user.id,
        action="submitted",
        detail=f"Annotation submitted by {current_user.username} ({annotation_count}/{required} annotators)"
    )
    db.add(log)
    db.commit()

    # Get next task info
    next_task = db.execute(text(f"""
        SELECT ta.task_id, bts.sequence_order, t.title
        FROM task_assignments ta
        JOIN batch_task_sequences bts ON bts.task_id = ta.task_id AND bts.batch_id = {data.batch_id}
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
            ac.consensus_result,
            t.title, t.data_content, t.customer_id,
            u1.username as annotator_1,
            u2.username as annotator_2,
            u3.username as annotator_3
        FROM annotation_consensus ac
        JOIN tasks t ON t.id = ac.task_id
        JOIN batch_task_sequences bts ON bts.task_id = ac.task_id AND bts.batch_id = {batch_id}
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
            "title": r[9],
            "data_content": r[10],
            "customer_id": r[11],
            "annotator_1": r[12],
            "annotator_2": r[13],
            "annotator_3": r[14]
        } for r in results
    ]

@router.get("/export/{batch_id}")
async def export_consensus_json(
    batch_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from fastapi.responses import JSONResponse
    results = await get_consensus_results(batch_id, admin, db)
    export_data = []
    for r in results:
        export_data.append({
            "datasetObjectId": r["dataset_object_id"],
            "taskId": r["task_id"],
            "iteration": r["iteration"],
            "title": r["title"],
            "customerId": r["customer_id"],
            "content": r["data_content"],
            "annotations": {
                "worker_1": {"workerId": r["annotator_1"], "labels": r["annotation_1"]},
                "worker_2": {"workerId": r["annotator_2"], "labels": r["annotation_2"]},
                "worker_3": {"workerId": r["annotator_3"], "labels": r["annotation_3"]}
            },
            "consensus": r["consensus_result"],
            "agreementScore": r["agreement_score"],
            "status": r["status"]
        })
    return JSONResponse(content=export_data)