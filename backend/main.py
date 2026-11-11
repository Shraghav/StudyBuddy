from contextlib import asynccontextmanager

import uvicorn
from controller.chat_controller import router as chat_controller
from controller.document_controller import router as document_router
from controller.quiz_controller import router as quiz_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from repository.database import create_db


class HealthCheckResponseDTO(BaseModel):
    status: str = Field(default="online", description="Operational health status of the API", examples=["online"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating database tables...")
    await create_db()
    yield


app = FastAPI(
    title="StudyBuddy API",
    description="Production-grade AI study assistant API featuring dual-mode OCR extraction, pgvector RAG, and an automated assessment engine.",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(document_router)
app.include_router(chat_controller)
app.include_router(quiz_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/",
    response_model=HealthCheckResponseDTO,
    summary="Service Health Check",
    description="Returns the operational health status of the StudyBuddy API.",
    responses={
        200: {"model": HealthCheckResponseDTO, "description": "Service is healthy and online."}
    },
)
def read_root():
    return HealthCheckResponseDTO(status="online")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

