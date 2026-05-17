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

@router.post("/")
async def create_batch(
    batch_data: BatchCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    batch = QueueBatch(
        name=batch_data.name,
        project_id=batch_data.project_id,
        tasks_per_user=batch_data.tasks_per_user,
        time_limit=batch_data.time_limit,
        created_by=admin.id
    )
    db.add(batch)
    db.flush()

    for user_id in batch_data.user_ids:
        assignment = BatchAssignment(
            batch_id=batch.id,
            user_id=user_id
        )
        db.add(assignment)

    db.commit()

    # Notify all assigned users via WebSocket
    for user_id in batch_data.user_ids:
        await manager.broadcast(
            f"user_{user_id}",
            {
                "type": "batch_assigned",
                "batch_id": batch.id,
                "batch_name": batch.name,
                "tasks_per_user": batch.tasks_per_user,
                "time_limit": batch.time_limit,
                "message": f"New batch '{batch.name}' is now available in your queue!"
            }
        )

    return {
        "message": "Batch created successfully",
        "batch_id": batch.id
    }

@router.get("/")
async def get_batches(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from sqlalchemy import text
    batches = db.query(QueueBatch).all()
    result = []
    for batch in batches:
        assignments = db.query(BatchAssignment).filter(
            BatchAssignment.batch_id == batch.id
        ).all()

        # Count tasks in this batch's project
        task_count = db.execute(text(
            f"SELECT COUNT(*) FROM tasks WHERE project_id = {batch.project_id} AND status = 'available'"
        )).scalar()

        result.append({
            "id": batch.id,
            "name": batch.name,
            "project_id": batch.project_id,
            "tasks_per_user": batch.tasks_per_user,
            "time_limit": batch.time_limit,
            "status": batch.status,
            "created_at": batch.created_at,
            "assigned_users": len(assignments),
            "available_tasks": task_count,
            "assignments": [
                {
                    "user_id": a.user_id,
                    "tasks_assigned": a.tasks_assigned,
                    "tasks_completed": a.tasks_completed
                } for a in assignments
            ]
        })
    return result

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

    # Broadcast update to all users in batch
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

            if msg.get("type") == "ping":
                await manager.send_personal(websocket, {"type": "pong"})

            elif msg.get("type") == "task_claimed":
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

    except WebSocketDisconnect:
        manager.disconnect(websocket, room)