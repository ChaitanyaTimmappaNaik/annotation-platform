from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Project, Task, User, DataType
from auth import require_admin, get_current_user
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/projects", tags=["projects"])

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    data_type: str = "text"
    tags: Optional[List[str]] = []
    ontology: Optional[dict] = {}
    lock_ontology: Optional[bool] = False
    customer_id: Optional[str] = None

# Admin: create project
@router.post("/")
async def create_project(
    project_data: ProjectCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    project = Project(
        name=project_data.name,
        description=project_data.description,
        data_type=project_data.data_type,
        tags=project_data.tags,
        ontology=project_data.ontology,
        lock_ontology=project_data.lock_ontology,
        customer_id=project_data.customer_id,
        created_by=admin.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"message": "Project created", "project_id": project.id}

# Admin: get all projects
@router.get("/")
async def get_all_projects(
    search: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Project)
    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))
    return query.all()

# Admin: get single project
@router.get("/{project_id}")
async def get_project(
    project_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project

# Admin: update project
@router.put("/{project_id}")
async def update_project(
    project_id: int,
    update_data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if update_data.get("name"):
        project.name = update_data["name"]
    if update_data.get("description") is not None:
        project.description = update_data["description"]
    if update_data.get("customer_id") is not None:
        project.customer_id = update_data["customer_id"]
    db.commit()
    return {"message": "Project updated successfully"}