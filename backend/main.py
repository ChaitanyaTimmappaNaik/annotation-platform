from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, users, projects, tasks, annotations, batches, analytics
from dotenv import load_dotenv
import os

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Annotation Platform API", version="2.0.0")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(annotations.router)
app.include_router(batches.router)
app.include_router(analytics.router)
@app.get("/")
def root():
    return {"message": "Annotation Platform API v2.0 is running!"}

@app.get("/health")
def health():
    return {"status": "healthy", "version": "2.0.0"}