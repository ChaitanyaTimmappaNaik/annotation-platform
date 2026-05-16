from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Task, TaskStatus, User
from auth import require_admin, get_current_user
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str
    project_id: int
    data_content: Optional[str] = None
    data_url: Optional[str] = None
    instructions: Optional[str] = None

class BulkTaskCreate(BaseModel):
    project_id: int
    tasks: List[TaskCreate]

@router.post("/")
async def create_task(
    task_data: TaskCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    task = Task(
        title=task_data.title,
        project_id=task_data.project_id,
        data_content=task_data.data_content,
        data_url=task_data.data_url,
        instructions=task_data.instructions,
        status=TaskStatus.available
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "Task created", "task_id": task.id}

@router.post("/bulk")
async def create_bulk_tasks(
    bulk_data: BulkTaskCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    tasks = [
        Task(
            title=t.title,
            project_id=bulk_data.project_id,
            data_content=t.data_content,
            instructions=t.instructions,
            status=TaskStatus.available
        )
        for t in bulk_data.tasks
    ]
    db.add_all(tasks)
    db.commit()
    return {"message": f"{len(tasks)} tasks created"}

@router.get("/queue")
async def get_queue(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(
        Task.status == "available"
    )
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))
    return query.all()

@router.get("/{task_id}")
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task

@router.post("/{task_id}/claim")
async def claim_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.status != TaskStatus.available:
        raise HTTPException(400, "Task not available")
    task.status = TaskStatus.in_progress
    task.assigned_to = current_user.id
    db.commit()
    return {"message": "Task claimed", "task_id": task.id}

@router.put("/{task_id}/decline")
async def decline_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = TaskStatus.available
    task.assigned_to = None
    db.commit()
    return {"message": "Task declined"}

@router.put("/{task_id}/release")
async def release_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = TaskStatus.available
    task.assigned_to = None
    db.commit()
    return {"message": "Task released"}

@router.put("/{task_id}/reset")
async def reset_task(
    task_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = TaskStatus.available
    task.assigned_to = None
    db.commit()
    return {"message": "Task reset to available"}

@router.get("/")
async def get_all_tasks(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status)
    return query.all()