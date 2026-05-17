from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserRole
from auth import hash_password, require_admin, get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "annotator"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True

# Admin: get all users
@router.get("/")
async def get_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

# Admin: create new annotator
@router.post("/")
async def create_user(
    user_data: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Check if username exists
    existing = db.query(User).filter(
        User.username == user_data.username
    ).first()
    if existing:
        raise HTTPException(400, "Username already exists")

    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=UserRole.annotator
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created", "username": user.username}

# Admin: deactivate user
@router.put("/{user_id}")
async def update_user(
    user_id: int,
    update_data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    from auth import hash_password
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if update_data.get("username"):
        user.username = update_data["username"]
    if update_data.get("email"):
        user.email = update_data["email"]
    if update_data.get("password"):
        user.hashed_password = hash_password(update_data["password"])
    db.commit()
    return {"message": "User updated successfully"}