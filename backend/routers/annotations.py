from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import Annotation, Task, TaskStatus, User, UserRole, TaskActivityLog
from auth import get_current_user, require_admin
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/annotations", tags=["annotations"])

class AnnotationCreate(BaseModel):
    label_data: dict
    notes: Optional[str] = None
    time_spent: Optional[int] = 0

class ReviewDecision(BaseModel):
    decision: str  # "approved" or "rejected"
    feedback: Optional[str] = None

@router.post("/tasks/{task_id}")
async def submit_annotation(
    task_id: int,
    annotation_data: AnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Check if annotation already exists
    existing = db.query(Annotation).filter(
        Annotation.task_id == task_id,
        Annotation.annotator_id == current_user.id
    ).first()

    if existing:
        existing.label_data = annotation_data.label_data
        existing.notes = annotation_data.notes
        existing.time_spent = annotation_data.time_spent
        existing.submitted_at = datetime.utcnow()
    else:
        annotation = Annotation(
            task_id=task_id,
            annotator_id=current_user.id,
            label_data=annotation_data.label_data,
            notes=annotation_data.notes,
            time_spent=annotation_data.time_spent or 0
        )
        db.add(annotation)

    # Update task status to under_review
    task.status = TaskStatus.under_review

    # Log activity
    log = TaskActivityLog(
        task_id=task_id,
        user_id=current_user.id,
        action="submitted",
        detail=f"Annotation submitted by {current_user.username}"
    )
    db.add(log)
    db.commit()

    return {"message": "Annotation submitted for review"}

@router.get("/tasks/{task_id}")
async def get_task_annotation(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    annotation = db.query(Annotation).filter(
        Annotation.task_id == task_id
    ).first()
    if not annotation:
        raise HTTPException(404, "No annotation found")
    return annotation

@router.get("/projects/{project_id}")
async def get_project_annotations(
    project_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    annotations = db.execute(text(f"""
        SELECT a.id, a.task_id, a.annotator_id, a.label_data,
               a.notes, a.time_spent, a.submitted_at
        FROM annotations a
        JOIN tasks t ON t.id = a.task_id
        WHERE t.project_id = {project_id}
    """)).fetchall()
    return [
        {
            "id": r[0], "task_id": r[1], "annotator_id": r[2],
            "label_data": r[3], "notes": r[4],
            "time_spent": r[5], "submitted_at": r[6]
        } for r in annotations
    ]

@router.get("/projects/{project_id}/export")
async def export_annotations(
    project_id: int,
    format: str = "json",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from fastapi.responses import JSONResponse
    annotations = db.execute(text(f"""
        SELECT a.id, a.task_id, a.label_data, a.notes,
               a.submitted_at, u.username, t.title
        FROM annotations a
        JOIN tasks t ON t.id = a.task_id
        JOIN users u ON u.id = a.annotator_id
        WHERE t.project_id = {project_id}
    """)).fetchall()

    data = [
        {
            "annotation_id": r[0],
            "task_id": r[1],
            "label_data": r[2],
            "notes": r[3],
            "submitted_at": str(r[4]),
            "annotator": r[5],
            "task_title": r[6]
        } for r in annotations
    ]
    return JSONResponse(content=data)

# ── Review Queue ──

@router.get("/review/queue")
async def get_review_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in [UserRole.admin, UserRole.reviewer]:
        raise HTTPException(403, "Reviewer access required")

    rows = db.execute(text("""
        SELECT
            t.id, t.title, t.data_content, t.customer_id,
            t.instructions, t.project_id,
            a.id as annotation_id, a.label_data, a.notes,
            a.submitted_at, a.time_spent,
            u.username as annotator_name,
            p.name as project_name,
            ar.decision, ar.feedback
        FROM tasks t
        JOIN annotations a ON a.task_id = t.id
        JOIN users u ON u.id = a.annotator_id
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN annotation_reviews ar ON ar.annotation_id = a.id
        WHERE t.status = 'under_review'
        ORDER BY a.submitted_at DESC
    """)).fetchall()

    return [
        {
            "task_id": r[0],
            "title": r[1],
            "data_content": r[2],
            "customer_id": r[3],
            "instructions": r[4],
            "project_id": r[5],
            "annotation_id": r[6],
            "label_data": r[7],
            "notes": r[8],
            "submitted_at": r[9],
            "time_spent": r[10],
            "annotator_name": r[11],
            "project_name": r[12],
            "previous_decision": r[13],
            "previous_feedback": r[14]
        } for r in rows
    ]

@router.post("/review/{annotation_id}")
async def review_annotation(
    annotation_id: int,
    review: ReviewDecision,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in [UserRole.admin, UserRole.reviewer]:
        raise HTTPException(403, "Reviewer access required")

    if review.decision not in ["approved", "rejected"]:
        raise HTTPException(400, "Decision must be 'approved' or 'rejected'")

    annotation = db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()
    if not annotation:
        raise HTTPException(404, "Annotation not found")

    task = db.query(Task).filter(Task.id == annotation.task_id).first()

    # Save review
    db.execute(text(f"""
        INSERT INTO annotation_reviews
            (annotation_id, reviewer_id, decision, feedback, reviewed_at)
        VALUES
            ({annotation_id}, {current_user.id},
             '{review.decision}', '{review.feedback or ""}', NOW())
        ON CONFLICT (annotation_id)
        DO UPDATE SET
            decision = '{review.decision}',
            feedback = '{review.feedback or ""}',
            reviewed_at = NOW(),
            reviewer_id = {current_user.id}
    """))

    # Update task status
    if review.decision == "approved":
        task.status = TaskStatus.completed
    else:
        task.status = TaskStatus.available
        task.assigned_to = None

    # Log activity
    log = TaskActivityLog(
        task_id=annotation.task_id,
        user_id=current_user.id,
        action=review.decision,
        detail=f"Annotation {review.decision} by {current_user.username}. Feedback: {review.feedback or 'None'}"
    )
    db.add(log)
    db.commit()

    return {"message": f"Annotation {review.decision} successfully"}