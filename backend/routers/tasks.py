from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import Task, TaskStatus, User, TaskActivityLog
from auth import require_admin, get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str
    project_id: int
    customer_id: Optional[str] = None
    data_content: Optional[str] = None
    data_url: Optional[str] = None
    instructions: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    customer_id: Optional[str] = None
    data_content: Optional[str] = None
    instructions: Optional[str] = None

class BulkTaskCreate(BaseModel):
    project_id: int
    customer_id: Optional[str] = None
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
        customer_id=task_data.customer_id,
        data_content=task_data.data_content,
        data_url=task_data.data_url,
        instructions=task_data.instructions,
        status=TaskStatus.available
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "Task created", "task_id": task.id}

@router.put("/update/{task_id}")
async def update_task(
    task_id: int,
    task_data: TaskUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task_data.title is not None:
        task.title = task_data.title
    if task_data.customer_id is not None:
        task.customer_id = task_data.customer_id
    if task_data.data_content is not None:
        task.data_content = task_data.data_content
    if task_data.instructions is not None:
        task.instructions = task_data.instructions
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Task updated"}

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
            customer_id=t.customer_id or bulk_data.customer_id,
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
    from models import QueueBatch

    # Get paused tasks for current user using raw SQL
    paused_rows = db.execute(text(
        "SELECT id, title, project_id, customer_id, data_content, "
        "instructions, status, assigned_to, created_at "
        f"FROM tasks WHERE status = 'paused' AND assigned_to = {current_user.id}"
    )).fetchall()

    # Get active batches
    active_batches = db.query(QueueBatch).filter(
        QueueBatch.status == "active"
    ).all()

    if not active_batches:
        # No batches — show all available tasks
        available_rows = db.execute(text(
            "SELECT id, title, project_id, customer_id, data_content, "
            "instructions, status, assigned_to, created_at "
            "FROM tasks WHERE status = 'available'"
        )).fetchall()
        batch_map = {}
    else:
        project_ids = ",".join(str(b.project_id) for b in active_batches)
        available_rows = db.execute(text(
            "SELECT id, title, project_id, customer_id, data_content, "
            "instructions, status, assigned_to, created_at "
            f"FROM tasks WHERE status = 'available' AND project_id IN ({project_ids})"
        )).fetchall()
        batch_map = {b.project_id: b for b in active_batches}

    result = []
    for row in list(paused_rows) + list(available_rows):
        batch = batch_map.get(row[2])
        result.append({
            "id": row[0],
            "title": row[1],
            "project_id": row[2],
            "customer_id": row[3],
            "data_content": row[4],
            "instructions": row[5],
            "status": row[6],
            "assigned_to": row[7],
            "created_at": row[8],
            "time_limit": batch.time_limit if batch else 1800,
            "batch_name": batch.name if batch else None
        })

    if search:
        result = [r for r in result if search.lower() in r["title"].lower()]

    return result

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

    # Allow resuming paused task
    if task.status == TaskStatus.paused and task.assigned_to == current_user.id:
        task.status = TaskStatus.in_progress
        log = TaskActivityLog(
            task_id=task_id,
            user_id=current_user.id,
            action="resumed",
            detail="Task resumed by user"
        )
        db.add(log)
        db.commit()
        return {"message": "Task resumed", "task_id": task.id}

    if task.status != TaskStatus.available:
        raise HTTPException(400, "Task not available — already claimed by another user")

    task.status = TaskStatus.in_progress
    task.assigned_to = current_user.id
    task.claimed_at = datetime.utcnow()
    log = TaskActivityLog(
        task_id=task_id,
        user_id=current_user.id,
        action="claimed",
        detail=f"Task claimed by {current_user.username}"
    )
    db.add(log)
    db.commit()
    return {"message": "Task claimed", "task_id": task.id}

@router.put("/{task_id}/pause")
async def pause_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = TaskStatus.paused
    log = TaskActivityLog(
        task_id=task_id,
        user_id=current_user.id,
        action="paused",
        detail="Task paused - will resume later"
    )
    db.add(log)
    db.commit()
    return {"message": "Task paused - visible in your queue to resume"}

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
    log = TaskActivityLog(
        task_id=task_id,
        user_id=current_user.id,
        action="declined",
        detail="Task declined and returned to queue"
    )
    db.add(log)
    db.commit()
    return {"message": "Task declined and returned to queue"}

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
    log = TaskActivityLog(
        task_id=task_id,
        user_id=current_user.id,
        action="released",
        detail="Task released back to queue"
    )
    db.add(log)
    db.commit()
    return {"message": "Task released back to queue"}

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