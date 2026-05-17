from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import User
from auth import require_admin, get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard")
async def get_dashboard_analytics(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Total counts
    totals = db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM tasks) as total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'available') as available_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as inprogress_tasks,
            (SELECT COUNT(*) FROM annotations) as total_annotations,
            (SELECT COUNT(*) FROM users WHERE role = 'annotator') as total_annotators,
            (SELECT COUNT(*) FROM projects) as total_projects,
            (SELECT COUNT(*) FROM queue_batches WHERE status = 'active') as active_batches
    """)).fetchone()

    # Per user productivity
    user_stats = db.execute(text("""
        SELECT
            u.id,
            u.username,
            COUNT(a.id) as total_annotations,
            COUNT(DISTINCT a.task_id) as tasks_completed,
            COALESCE(AVG(a.time_spent), 0) as avg_time_spent,
            MAX(a.submitted_at) as last_activity
        FROM users u
        LEFT JOIN annotations a ON a.annotator_id = u.id
        WHERE u.role = 'annotator'
        GROUP BY u.id, u.username
        ORDER BY tasks_completed DESC
    """)).fetchall()

    # Task activity logs
    recent_activity = db.execute(text("""
        SELECT
            tal.action,
            tal.detail,
            tal.created_at,
            u.username,
            t.title as task_title
        FROM task_activity_logs tal
        JOIN users u ON u.id = tal.user_id
        JOIN tasks t ON t.id = tal.task_id
        ORDER BY tal.created_at DESC
        LIMIT 20
    """)).fetchall()

    # Daily completion trend (last 7 days)
    daily_trend = db.execute(text("""
        SELECT
            DATE(submitted_at) as date,
            COUNT(*) as count
        FROM annotations
        WHERE submitted_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(submitted_at)
        ORDER BY date ASC
    """)).fetchall()

    return {
        "totals": {
            "total_tasks": totals[0],
            "completed_tasks": totals[1],
            "available_tasks": totals[2],
            "inprogress_tasks": totals[3],
            "total_annotations": totals[4],
            "total_annotators": totals[5],
            "total_projects": totals[6],
            "active_batches": totals[7]
        },
        "user_stats": [
            {
                "id": row[0],
                "username": row[1],
                "total_annotations": row[2],
                "tasks_completed": row[3],
                "avg_time_spent": round(float(row[4]) / 60, 1),
                "last_activity": row[5]
            } for row in user_stats
        ],
        "recent_activity": [
            {
                "action": row[0],
                "detail": row[1],
                "created_at": row[2],
                "username": row[3],
                "task_title": row[4]
            } for row in recent_activity
        ],
        "daily_trend": [
            {
                "date": str(row[0]),
                "count": row[1]
            } for row in daily_trend
        ]
    }

@router.get("/user/{user_id}")
async def get_user_analytics(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # User details
    user = db.execute(text(
        f"SELECT id, username, email, created_at, last_login FROM users WHERE id = {user_id}"
    )).fetchone()

    if not user:
        raise HTTPException(404, "User not found")

    # User task history
    task_history = db.execute(text(f"""
        SELECT
            t.title,
            t.status,
            a.submitted_at,
            a.time_spent,
            p.name as project_name
        FROM annotations a
        JOIN tasks t ON t.id = a.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE a.annotator_id = {user_id}
        ORDER BY a.submitted_at DESC
        LIMIT 50
    """)).fetchall()

    # User activity logs
    activity_logs = db.execute(text(f"""
        SELECT
            tal.action,
            tal.detail,
            tal.created_at,
            t.title as task_title
        FROM task_activity_logs tal
        JOIN tasks t ON t.id = tal.task_id
        WHERE tal.user_id = {user_id}
        ORDER BY tal.created_at DESC
        LIMIT 30
    """)).fetchall()

    return {
        "user": {
            "id": user[0],
            "username": user[1],
            "email": user[2],
            "created_at": user[3],
            "last_login": user[4]
        },
        "task_history": [
            {
                "title": row[0],
                "status": row[1],
                "submitted_at": row[2],
                "time_spent_minutes": round((row[3] or 0) / 60, 1),
                "project_name": row[4]
            } for row in task_history
        ],
        "activity_logs": [
            {
                "action": row[0],
                "detail": row[1],
                "created_at": row[2],
                "task_title": row[3]
            } for row in activity_logs
        ]
    }