from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Annotation, Task, TaskStatus, User
from auth import require_admin, get_current_user
from pydantic import BaseModel
from typing import Optional
import json
import io
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/annotations", tags=["annotations"])

class AnnotationCreate(BaseModel):
    label_data: dict
    notes: Optional[str] = None

# Annotator: submit annotation
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
    if task.assigned_to != current_user.id:
        raise HTTPException(403, "Task not assigned to you")

    annotation = Annotation(
        task_id=task_id,
        annotator_id=current_user.id,
        label_data=annotation_data.label_data,
        notes=annotation_data.notes
    )
    db.add(annotation)

    # Mark task as completed
    task.status = TaskStatus.completed
    db.commit()
    db.refresh(annotation)
    return {
        "message": "Annotation submitted",
        "annotation_id": annotation.id
    }

# Annotator: get my annotations
@router.get("/my")
async def get_my_annotations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    annotations = db.query(Annotation).filter(
        Annotation.annotator_id == current_user.id
    ).all()
    return annotations

# Admin: get all annotations for a project
@router.get("/projects/{project_id}")
async def get_project_annotations(
    project_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    annotations = db.query(Annotation).join(Task).filter(
        Task.project_id == project_id
    ).all()
    return annotations

# Admin: export annotations as JSON
@router.get("/projects/{project_id}/export")
async def export_annotations(
    project_id: int,
    format: str = "json",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    rows = db.query(Annotation, Task).join(Task).filter(
        Task.project_id == project_id
    ).all()

    data = [{
        "task_id": a.task_id,
        "task_title": t.title,
        "annotator_id": a.annotator_id,
        "label_data": a.label_data,
        "notes": a.notes,
        "submitted_at": a.submitted_at.isoformat()
    } for a, t in rows]

    if format == "csv":
        output = "task_id,task_title,annotator_id,label_data,notes,submitted_at\n"
        for row in data:
            output += f"{row['task_id']},{row['task_title']},{row['annotator_id']},{json.dumps(row['label_data'])},{row['notes']},{row['submitted_at']}\n"
        return StreamingResponse(
            io.BytesIO(output.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=project_{project_id}.csv"}
        )
    else:
        return StreamingResponse(
            io.BytesIO(json.dumps(data, indent=2).encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=project_{project_id}.json"}
        )