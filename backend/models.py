from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    annotator = "annotator"
    reviewer = "reviewer"

class TaskStatus(str, enum.Enum):
    available = "available"
    in_progress = "in_progress"
    completed = "completed"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"

class DataType(str, enum.Enum):
    text = "text"
    image = "image"
    video = "video"
    audio = "audio"

class User(Base):
    __tablename__ = "users"
    id                  = Column(Integer, primary_key=True, index=True)
    username            = Column(String(100), unique=True, nullable=False)
    email               = Column(String(255), unique=True, nullable=False)
    hashed_password     = Column(String(255), nullable=False)
    role                = Column(Enum(UserRole), default=UserRole.annotator)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    last_login          = Column(DateTime, nullable=True)
    failed_login_count  = Column(Integer, default=0)
    locked_until        = Column(DateTime, nullable=True)
    annotations         = relationship("Annotation", back_populates="annotator")
    activity_logs       = relationship("TaskActivityLog", back_populates="user")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"))
    token       = Column(String(255), unique=True, nullable=False)
    expires_at  = Column(DateTime, nullable=False)
    used        = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    user        = relationship("User")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"))
    token       = Column(String(255), unique=True, nullable=False)
    expires_at  = Column(DateTime, nullable=False)
    revoked     = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    user        = relationship("User")

class Project(Base):
    __tablename__ = "projects"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False)
    description   = Column(Text)
    data_type     = Column(Enum(DataType), nullable=False)
    tags          = Column(JSON, default=[])
    ontology      = Column(JSON, default={})
    lock_ontology = Column(Boolean, default=False)
    customer_id   = Column(String(100))
    task_time_limit = Column(Integer, default=1800)
    created_by    = Column(Integer, ForeignKey("users.id"))
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow)
    tasks         = relationship("Task", back_populates="project")

class Task(Base):
    __tablename__ = "tasks"
    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String(255), nullable=False)
    project_id    = Column(Integer, ForeignKey("projects.id"))
    data_content  = Column(Text)
    data_url      = Column(String(500))
    instructions  = Column(Text)
    status        = Column(Enum(TaskStatus), default=TaskStatus.available)
    assigned_to   = Column(Integer, ForeignKey("users.id"), nullable=True)
    claimed_at    = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow)
    project       = relationship("Project", back_populates="tasks")
    annotations   = relationship("Annotation", back_populates="task")
    activity_logs = relationship("TaskActivityLog", back_populates="task")

class Annotation(Base):
    __tablename__ = "annotations"
    id            = Column(Integer, primary_key=True, index=True)
    task_id       = Column(Integer, ForeignKey("tasks.id"))
    annotator_id  = Column(Integer, ForeignKey("users.id"))
    label_data    = Column(JSON, nullable=False)
    notes         = Column(Text)
    time_spent    = Column(Integer, default=0)
    submitted_at  = Column(DateTime, default=datetime.utcnow)
    task          = relationship("Task", back_populates="annotations")
    annotator     = relationship("User", back_populates="annotations")

class TaskActivityLog(Base):
    __tablename__ = "task_activity_logs"
    id          = Column(Integer, primary_key=True, index=True)
    task_id     = Column(Integer, ForeignKey("tasks.id"))
    user_id     = Column(Integer, ForeignKey("users.id"))
    action      = Column(String(50), nullable=False)
    detail      = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    task        = relationship("Task", back_populates="activity_logs")
    user        = relationship("User", back_populates="activity_logs")