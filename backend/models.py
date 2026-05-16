from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    annotator = "annotator"

class TaskStatus(str, enum.Enum):
    available = "available"
    in_progress = "in_progress"
    completed = "completed"
    under_review = "under_review"

class DataType(str, enum.Enum):
    text = "text"
    image = "image"
    video = "video"
    audio = "audio"

class User(Base):
    __tablename__ = "users"
    id               = Column(Integer, primary_key=True, index=True)
    username         = Column(String(100), unique=True, nullable=False)
    email            = Column(String(255), unique=True, nullable=False)
    hashed_password  = Column(String(255), nullable=False)
    role             = Column(Enum(UserRole), default=UserRole.annotator)
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    annotations      = relationship("Annotation", back_populates="annotator")

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
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow)
    project       = relationship("Project", back_populates="tasks")
    annotations   = relationship("Annotation", back_populates="task")

class Annotation(Base):
    __tablename__ = "annotations"
    id            = Column(Integer, primary_key=True, index=True)
    task_id       = Column(Integer, ForeignKey("tasks.id"))
    annotator_id  = Column(Integer, ForeignKey("users.id"))
    label_data    = Column(JSON, nullable=False)
    notes         = Column(Text)
    submitted_at  = Column(DateTime, default=datetime.utcnow)
    task          = relationship("Task", back_populates="annotations")
    annotator     = relationship("User", back_populates="annotations")