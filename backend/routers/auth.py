from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from models import User, PasswordResetToken, RefreshToken
from pydantic import BaseModel
from datetime import datetime
import os

router = APIRouter(prefix="/auth", tags=["auth"])

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    from auth import verify_password, create_access_token, create_refresh_token
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    user.last_login = datetime.utcnow()
    db.commit()
    access_token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "username": user.username
    })
    refresh_token = create_refresh_token(user.id, db)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "user_id": user.id,
        "expires_in": 3600
    }

@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    from auth import create_access_token
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == request.refresh_token,
        RefreshToken.revoked == False
    ).first()
    if not db_token or db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    access_token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "username": user.username
    })
    return {"access_token": access_token, "token_type": "bearer", "expires_in": 3600}

@router.post("/logout")
async def logout(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == request.refresh_token
    ).first()
    if db_token:
        db_token.revoked = True
        db.commit()
    return {"message": "Logged out successfully"}

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    from auth import create_password_reset_token
    user = db.query(User).filter(User.email == request.email).first()
    if user:
        token = create_password_reset_token(user.id, db)
        print(f"Reset token for {user.email}: {token}")
    return {"message": "If an account exists with this email, reset instructions have been sent."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    from auth import hash_password
    db_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == request.token,
        PasswordResetToken.used == False
    ).first()
    if not db_token or db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = db.query(User).filter(User.id == db_token.user_id).first()
    user.hashed_password = hash_password(request.new_password)
    db_token.used = True
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": True})
    db.commit()
    return {"message": "Password reset successfully."}

@router.get("/me")
async def get_me(db: Session = Depends(get_db)):
    return {"message": "OK"}