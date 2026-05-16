from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from database import get_db
from models import QueueBatch, BatchAssignment, Task, TaskStatus, User, TaskActivityLog
from auth import require_admin, get_current_user
from websocket_manager import manager
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/batches", tags=["batches"])

class BatchCreate(BaseModel):
    name: str
    project_id: int
    user_ids: List[int]
    tasks_per_user: int = 10
    time_limit: int = 1800

class BatchUpdate(BaseModel):
    time_limit: Optional[int] = None
    status: Optional[str] = None
    tasks_per_user: Optional[int] = None

# Admin: Create batch and assign to users
@router.post("/")
async def create_batch(
    batch_data: BatchCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Create batch
    batch = QueueBatch(
        name=batch_data.name,
        project_id=batch_data.project_id,
        tasks_per_user=batch_data.tasks_per_user,
        time_limit=batch_data.time_limit,
        created_by=admin.id
    )
    db.add(batch)
    db.flush()

    # Assign users to batch
    for user_id in batch_data.user_ids:
        assignment = BatchAssignment(
            batch_id=batch.id,
            user_id=user_id
        )
        db.add(assignment)

    db.commit()

    # Notify assigned users via WebSocket
    for user_id in batch_data.user_ids:
        await manager.broadcast(
            f"user_{user_id}",
            {
                "type": "batch_assigned",
                "batch_id": batch.id,
                "batch_name": batch.name,
                "tasks_per_user": batch.tasks_per_user,
                "time_limit": batch.time_limit,
                "message": f"New batch '{batch.name}' assigned to you!"
            }
        )

    return {
        "message": "Batch created and users notified",
        "batch_id": batch.id
    }

# Admin: Get all batches
@router.get("/")
async def get_batches(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    batches = db.query(QueueBatch).all()
    result = []
    for batch in batches:
        assignments = db.query(BatchAssignment).filter(
            BatchAssignment.batch_id == batch.id
        ).all()
        result.append({
            "id": batch.id,
            "name": batch.name,
            "project_id": batch.project_id,
            "tasks_per_user": batch.tasks_per_user,
            "time_limit": batch.time_limit,
            "status": batch.status,
            "created_at": batch.created_at,
            "assigned_users": len(assignments),
            "assignments": [
                {
                    "user_id": a.user_id,
                    "tasks_assigned": a.tasks_assigned,
                    "tasks_completed": a.tasks_completed
                } for a in assignments
            ]
        })
    return result

# Admin: Update batch settings (time limit, status)
@router.put("/{batch_id}")
async def update_batch(
    batch_id: int,
    update_data: BatchUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    batch = db.query(QueueBatch).filter(QueueBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(404, "Batch not found")

    if update_data.time_limit:
        batch.time_limit = update_data.time_limit
    if update_data.status:
        batch.status = update_data.status
    if update_data.tasks_per_user:
        batch.tasks_per_user = update_data.tasks_per_user

    batch.updated_at = datetime.utcnow()
    db.commit()

    # Broadcast time limit change to all users in batch
    assignments = db.query(BatchAssignment).filter(
        BatchAssignment.batch_id == batch_id
    ).all()

    for assignment in assignments:
        await manager.broadcast(
            f"user_{assignment.user_id}",
            {
                "type": "batch_updated",
                "batch_id": batch_id,
                "time_limit": batch.time_limit,
                "status": batch.status,
                "message": f"Batch settings updated by admin"
            }
        )

    return {"message": "Batch updated and users notified"}

# Annotator: Get my assigned tasks from batch
@router.get("/my-tasks")
async def get_my_batch_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignments = db.query(BatchAssignment).filter(
        BatchAssignment.user_id == current_user.id
    ).all()

    if not assignments:
        return []

    result = []
    for assignment in assignments:
        batch = db.query(QueueBatch).filter(
            QueueBatch.id == assignment.batch_id,
            QueueBatch.status == "active"
        ).first()

        if not batch:
            continue

        tasks = db.query(Task).filter(
            Task.project_id == batch.project_id,
            Task.status == TaskStatus.available
        ).limit(batch.tasks_per_user).all()

        result.append({
            "batch_id": batch.id,
            "batch_name": batch.name,
            "time_limit": batch.time_limit,
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "created_at": t.created_at
                } for t in tasks
            ]
        })

    return result

# WebSocket: Real-time connection per user
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: Session = Depends(get_db)
):
    room = f"user_{user_id}"
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            msg = json.loads(data)

            if msg.get("type") == "task_claimed":
                task_id = msg.get("task_id")
                task = db.query(Task).filter(Task.id == task_id).first()
                if task and task.status == TaskStatus.available:
                    task.status = TaskStatus.in_progress
                    task.assigned_to = user_id
                    task.claimed_at = datetime.utcnow()

                    log = TaskActivityLog(
                        task_id=task_id,
                        user_id=user_id,
                        action="claimed",
                        detail="Task claimed via WebSocket"
                    )
                    db.add(log)
                    db.commit()

                    # Broadcast to all users that task is taken
                    await manager.broadcast_to_all({
                        "type": "task_status_changed",
                        "task_id": task_id,
                        "status": "in_progress",
                        "claimed_by": user_id
                    })

            elif msg.get("type") == "task_released":
                task_id = msg.get("task_id")
                task = db.query(Task).filter(Task.id == task_id).first()
                if task:
                    task.status = TaskStatus.available
                    task.assigned_to = None

                    log = TaskActivityLog(
                        task_id=task_id,
                        user_id=user_id,
                        action="released",
                        detail="Task released via WebSocket"
                    )
                    db.add(log)
                    db.commit()

                    await manager.broadcast_to_all({
                        "type": "task_status_changed",
                        "task_id": task_id,
                        "status": "available",
                        "released_by": user_id
                    })

            elif msg.get("type") == "ping":
                await manager.send_personal(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        await manager.broadcast_to_all({
            "type": "user_disconnected",
            "user_id": user_id
        })