from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
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

@router.post("/upload")
async def upload_tasks_csv(
    project_id: int,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    import csv
    import io

    content = await file.read()

    try:
        text_content = content.decode("utf-8")
    except Exception:
        text_content = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    tasks_created = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            title = (
                row.get("title") or row.get("Title") or f"Task {i+1}"
            ).strip()
            data_content = (
                row.get("content") or row.get("Content") or
                row.get("text") or row.get("Text") or ""
            ).strip()
            customer_id = row.get("customer_id") or row.get("Customer ID") or None
            instructions = row.get("instructions") or row.get("Instructions") or None

            task = Task(
                title=title,
                project_id=project_id,
                customer_id=customer_id.strip() if customer_id else None,
                data_content=data_content,
                instructions=instructions.strip() if instructions else None,
                status=TaskStatus.available
            )
            db.add(task)
            tasks_created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    db.commit()

    return {
        "message": f"{tasks_created} tasks created successfully",
        "tasks_created": tasks_created,
        "errors": errors
    }

@router.get("/queue")
async def get_queue(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import QueueBatch

    # ── 1. Consensus batch tasks (from task_assignments) ──
    # Show tasks assigned to this user in any active batch
    # regardless of global task status — each user works independently
    consensus_rows = db.execute(text(f"""
        SELECT DISTINCT
            t.id, t.title, t.project_id, t.customer_id,
            t.data_content, t.instructions, t.status,
            t.assigned_to, t.created_at,
            ta.status as assignment_status,
            bts.dataset_object_id,
            qb.time_limit, qb.name as batch_name,
            ta.batch_id
        FROM task_assignments ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN batch_task_sequences bts
            ON bts.task_id = ta.task_id
            AND bts.batch_id = ta.batch_id
        JOIN queue_batches qb ON qb.id = ta.batch_id
        WHERE ta.user_id = {current_user.id}
        AND ta.status = 'pending'
        AND qb.status = 'active'
        ORDER BY bts.dataset_object_id ASC
    """)).fetchall()

    # ── 2. Non-batch paused/in_progress tasks for this user ──
    personal_rows = db.execute(text(f"""
        SELECT
            t.id, t.title, t.project_id, t.customer_id,
            t.data_content, t.instructions, t.status,
            t.assigned_to, t.created_at,
            t.status as assignment_status,
            t.dataset_object_id,
            1800 as time_limit, NULL as batch_name,
            NULL as batch_id
        FROM tasks t
        WHERE t.status IN ('paused', 'in_progress')
        AND t.assigned_to = {current_user.id}
        AND t.id NOT IN (
            SELECT task_id FROM task_assignments
            WHERE user_id = {current_user.id}
        )
    """)).fetchall()

    # ── 3. Regular available tasks (no batch assignment) ──
    active_batches = db.query(QueueBatch).filter(
        QueueBatch.status == "active"
    ).all()

    # Get task IDs already in consensus assignments for this user
    assigned_task_ids = [row[0] for row in consensus_rows]

    if active_batches:
        project_ids = ",".join(str(b.project_id) for b in active_batches)
        batch_map = {b.project_id: b for b in active_batches}
        exclude_clause = (
            f"AND t.id NOT IN ({','.join(str(x) for x in assigned_task_ids)})"
            if assigned_task_ids else ""
        )
        free_rows = db.execute(text(f"""
            SELECT
                t.id, t.title, t.project_id, t.customer_id,
                t.data_content, t.instructions, t.status,
                t.assigned_to, t.created_at,
                t.status as assignment_status,
                t.dataset_object_id,
                1800 as time_limit, NULL as batch_name,
                NULL as batch_id
            FROM tasks t
            WHERE t.status = 'available'
            AND t.project_id IN ({project_ids})
            {exclude_clause}
        """)).fetchall()
    else:
        batch_map = {}
        free_rows = []

    result = []
    seen_ids = set()

    # Add consensus tasks first (in sequence order)
    for row in consensus_rows:
        if row[0] not in seen_ids:
            seen_ids.add(row[0])
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
                "assignment_status": row[9],
                "dataset_object_id": row[10],
                "time_limit": row[11],
                "batch_name": row[12],
                "batch_id": row[13]
            })

    # Add personal paused/in_progress
    for row in personal_rows:
        if row[0] not in seen_ids:
            seen_ids.add(row[0])
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
                "assignment_status": row[9],
                "dataset_object_id": row[10],
                "time_limit": row[11],
                "batch_name": row[12],
                "batch_id": row[13]
            })

    # Add free available tasks
    for row in free_rows:
        if row[0] not in seen_ids:
            seen_ids.add(row[0])
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
                "assignment_status": row[9],
                "dataset_object_id": row[10],
                "time_limit": batch.time_limit if batch else 1800,
                "batch_name": batch.name if batch else None,
                "batch_id": None
            })

    if search:
        result = [r for r in result
                  if search.lower() in r["title"].lower()]

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

    # Check if this is a consensus batch task
    assignment = db.execute(text(
        f"SELECT id, status FROM task_assignments "
        f"WHERE task_id = {task_id} "
        f"AND user_id = {current_user.id}"
    )).fetchone()

    if assignment:
        # Consensus task — only update this user's assignment
        # Do NOT change global task status so other annotators
        # can still see and claim it independently
        if assignment[1] == "completed":
            return {"message": "Already completed", "task_id": task.id}
        db.execute(text(
            f"UPDATE task_assignments "
            f"SET status = 'in_progress' "
            f"WHERE task_id = {task_id} "
            f"AND user_id = {current_user.id}"
        ))
        log = TaskActivityLog(
            task_id=task_id,
            user_id=current_user.id,
            action="claimed",
            detail=f"Consensus task claimed by {current_user.username}"
        )
        db.add(log)
        db.commit()
        return {"message": "Task claimed", "task_id": task.id}

    # Regular (non-consensus) task logic
    if task.status == TaskStatus.paused and \
       task.assigned_to == current_user.id:
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

    if task.status == TaskStatus.in_progress and \
       task.assigned_to == current_user.id:
        return {"message": "Task already in progress", "task_id": task.id}

    if task.status != TaskStatus.available:
        raise HTTPException(400, "Task not available — already claimed")

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

    # For consensus tasks just update assignment status
    assignment = db.execute(text(
        f"SELECT id FROM task_assignments "
        f"WHERE task_id = {task_id} "
        f"AND user_id = {current_user.id}"
    )).fetchone()

    if assignment:
        db.execute(text(
            f"UPDATE task_assignments SET status = 'pending' "
            f"WHERE task_id = {task_id} "
            f"AND user_id = {current_user.id}"
        ))
    else:
        task.status = TaskStatus.paused

    log = TaskActivityLog(
        task_id=task_id,
        user_id=current_user.id,
        action="paused",
        detail="Task paused - will resume later"
    )
    db.add(log)
    db.commit()
    return {"message": "Task paused"}

@router.put("/{task_id}/decline")
async def decline_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # For consensus tasks reset assignment to pending
    assignment = db.execute(text(
        f"SELECT id FROM task_assignments "
        f"WHERE task_id = {task_id} "
        f"AND user_id = {current_user.id}"
    )).fetchone()

    if assignment:
        db.execute(text(
            f"UPDATE task_assignments SET status = 'pending' "
            f"WHERE task_id = {task_id} "
            f"AND user_id = {current_user.id}"
        ))
    else:
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

    # For consensus tasks reset assignment to pending
    assignment = db.execute(text(
        f"SELECT id FROM task_assignments "
        f"WHERE task_id = {task_id} "
        f"AND user_id = {current_user.id}"
    )).fetchone()

    if assignment:
        db.execute(text(
            f"UPDATE task_assignments SET status = 'pending' "
            f"WHERE task_id = {task_id} "
            f"AND user_id = {current_user.id}"
        ))
        # Clear timer
    else:
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
    # Reset all assignments for this task
    db.execute(text(
        f"UPDATE task_assignments SET status = 'pending' "
        f"WHERE task_id = {task_id}"
    ))
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