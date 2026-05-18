from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import QueueBatch, BatchAssignment, Task, TaskStatus, User, TaskActivityLog
from auth import require_admin, get_current_user
from websocket_manager import manager
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json

router = APIRouter(prefix="/batches", tags=["batches"])

class BatchCreate(BaseModel):
    name: str
    project_id: int
    user_ids: List[int]
    tasks_per_user: int = 10
    time_limit: int = 1800
    required_annotators: int = 3

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

    # Get tasks for this project
    tasks = db.execute(text(
        f"SELECT id FROM tasks WHERE project_id = {batch_data.project_id} "
        f"AND status = 'available' ORDER BY id LIMIT {batch_data.tasks_per_user}"
    )).fetchall()

    # Create batch sequences with dataset_object_id
    for idx, task_row in enumerate(tasks):
        db.execute(text(
            f"INSERT INTO batch_task_sequences "
            f"(batch_id, task_id, sequence_order, dataset_object_id) "
            f"VALUES ({batch.id}, {task_row[0]}, {idx}, {idx}) "
            f"ON CONFLICT (batch_id, sequence_order) DO NOTHING"
        ))
        db.execute(text(
            f"UPDATE tasks SET dataset_object_id = {idx}, "
            f"batch_sequence = {idx}, "
            f"required_annotators = {batch_data.required_annotators}, "
            f"iteration = 1 "
            f"WHERE id = {task_row[0]}"
        ))

    # Create assignments for each user
    for user_id in batch_data.user_ids:
        assignment = BatchAssignment(
            batch_id=batch.id,
            user_id=user_id
        )
        db.add(assignment)

        # Create task_assignments for consensus
        for slot, task_row in enumerate(tasks):
            db.execute(text(
                f"INSERT INTO task_assignments "
                f"(task_id, user_id, batch_id, assignment_slot, status) "
                f"VALUES ({task_row[0]}, {user_id}, {batch.id}, {slot}, 'pending') "
                f"ON CONFLICT (task_id, user_id) DO NOTHING"
            ))

    db.commit()

    # Notify users via WebSocket
    for user_id in batch_data.user_ids:
        await manager.broadcast(
            f"user_{user_id}",
            {
                "type": "batch_assigned",
                "batch_id": batch.id,
                "batch_name": batch.name,
                "tasks_per_user": batch.tasks_per_user,
                "time_limit": batch.time_limit,
                "message": f"New batch '{batch.name}' is now available!"
            }
        )

    return {"message": "Batch created successfully", "batch_id": batch.id}

@router.get("/user-batches")
async def get_user_batches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get all active batches assigned to this user
    assignments = db.execute(text(f"""
        SELECT DISTINCT
            qb.id, qb.name, qb.project_id, qb.time_limit,
            qb.tasks_per_user, qb.status as batch_status,
            p.name as project_name
        FROM batch_assignments ba
        JOIN queue_batches qb ON qb.id = ba.batch_id
        JOIN projects p ON p.id = qb.project_id
        WHERE ba.user_id = {current_user.id}
        AND qb.status = 'active'
        ORDER BY qb.id DESC
    """)).fetchall()

    result = []
    for row in assignments:
        batch_id = row[0]

        # Total tasks assigned to this user in this batch
        total = db.execute(text(f"""
            SELECT COUNT(*) FROM task_assignments
            WHERE batch_id = {batch_id}
            AND user_id = {current_user.id}
        """)).scalar() or 0

        # Completed count
        completed = db.execute(text(f"""
            SELECT COUNT(*) FROM task_assignments
            WHERE batch_id = {batch_id}
            AND user_id = {current_user.id}
            AND status = 'completed'
        """)).scalar() or 0

        # In progress count
        in_progress = db.execute(text(f"""
            SELECT COUNT(*) FROM task_assignments
            WHERE batch_id = {batch_id}
            AND user_id = {current_user.id}
            AND status = 'in_progress'
        """)).scalar() or 0

        # Task statuses for progress pills
        task_statuses = db.execute(text(f"""
            SELECT t.title, ta.status
            FROM task_assignments ta
            JOIN tasks t ON t.id = ta.task_id
            JOIN batch_task_sequences bts
                ON bts.task_id = ta.task_id
                AND bts.batch_id = {batch_id}
            WHERE ta.batch_id = {batch_id}
            AND ta.user_id = {current_user.id}
            ORDER BY bts.sequence_order ASC
        """)).fetchall()

        result.append({
            "id": batch_id,
            "name": row[1],
            "project_id": row[2],
            "project_name": row[6],
            "time_limit": row[3],
            "tasks_per_user": row[4],
            "batch_status": row[5],
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "remaining": total - completed,
            "required_annotators": 3,
            "task_statuses": [
                {"title": ts[0], "status": ts[1]}
                for ts in task_statuses
            ]
        })

    return result

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

        task_count = db.execute(text(
            f"SELECT COUNT(*) FROM batch_task_sequences "
            f"WHERE batch_id = {batch.id}"
        )).scalar()

        completed = db.execute(text(
            f"SELECT COUNT(*) FROM task_assignments "
            f"WHERE batch_id = {batch.id} "
            f"AND status = 'completed'"
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
            "completed_annotations": completed,
            "assignments": [
                {
                    "user_id": a.user_id,
                    "tasks_assigned": a.tasks_assigned,
                    "tasks_completed": a.tasks_completed
                } for a in assignments
            ]
        })
    return result

@router.get("/next-task/{batch_id}")
async def get_next_task(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # First check if there is an in_progress task to resume
    in_progress = db.execute(text(f"""
        SELECT ta.task_id, bts.sequence_order, bts.dataset_object_id,
               t.title, t.data_content, t.customer_id, t.instructions,
               t.project_id, ta.status
        FROM task_assignments ta
        JOIN batch_task_sequences bts
            ON bts.task_id = ta.task_id
            AND bts.batch_id = {batch_id}
        JOIN tasks t ON t.id = ta.task_id
        WHERE ta.user_id = {current_user.id}
        AND ta.batch_id = {batch_id}
        AND ta.status = 'in_progress'
        ORDER BY bts.sequence_order ASC
        LIMIT 1
    """)).fetchone()

    if in_progress:
        return {
            "completed": False,
            "task_id": in_progress[0],
            "sequence_order": in_progress[1],
            "dataset_object_id": in_progress[2],
            "title": in_progress[3],
            "data_content": in_progress[4],
            "customer_id": in_progress[5],
            "instructions": in_progress[6],
            "project_id": in_progress[7],
            "batch_id": batch_id,
            "resuming": True
        }

    # Get next pending task
    next_task = db.execute(text(f"""
        SELECT ta.task_id, bts.sequence_order, bts.dataset_object_id,
               t.title, t.data_content, t.customer_id, t.instructions,
               t.project_id, ta.status
        FROM task_assignments ta
        JOIN batch_task_sequences bts
            ON bts.task_id = ta.task_id
            AND bts.batch_id = {batch_id}
        JOIN tasks t ON t.id = ta.task_id
        WHERE ta.user_id = {current_user.id}
        AND ta.batch_id = {batch_id}
        AND ta.status = 'pending'
        ORDER BY bts.sequence_order ASC
        LIMIT 1
    """)).fetchone()

    if not next_task:
        return {
            "completed": True,
            "message": "All tasks in this batch completed!"
        }

    return {
        "completed": False,
        "task_id": next_task[0],
        "sequence_order": next_task[1],
        "dataset_object_id": next_task[2],
        "title": next_task[3],
        "data_content": next_task[4],
        "customer_id": next_task[5],
        "instructions": next_task[6],
        "project_id": next_task[7],
        "batch_id": batch_id,
        "resuming": False
    }

@router.get("/progress/{batch_id}")
async def get_batch_progress(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total = db.execute(text(
        f"SELECT COUNT(*) FROM task_assignments "
        f"WHERE batch_id = {batch_id} "
        f"AND user_id = {current_user.id}"
    )).scalar() or 0

    completed = db.execute(text(
        f"SELECT COUNT(*) FROM task_assignments "
        f"WHERE batch_id = {batch_id} "
        f"AND user_id = {current_user.id} "
        f"AND status = 'completed'"
    )).scalar() or 0

    return {
        "total": total,
        "completed": completed,
        "remaining": total - completed,
        "percentage": round(
            (completed / total * 100) if total > 0 else 0, 1
        )
    }

@router.put("/{batch_id}")
async def update_batch(
    batch_id: int,
    update_data: BatchUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    batch = db.query(QueueBatch).filter(
        QueueBatch.id == batch_id
    ).first()
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

    # Notify assigned users
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
                "message": "Batch settings updated by admin"
            }
        )

    return {"message": "Batch updated"}

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
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await manager.send_personal(
                    websocket, {"type": "pong"}
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)