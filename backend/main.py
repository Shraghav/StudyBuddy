from contextlib import asynccontextmanager

import uvicorn
from controller.chat_controller import router as chat_controller
from controller.document_controller import router as document_router
from controller.quiz_controller import router as quiz_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from repository.database import create_db
from repository.models import (ChatMessage, ChatSession, Document,
                               DocumentChunk, User, QuizSession, QuizQuestion)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating database tables...")
    await create_db() 
    yield

app = FastAPI(lifespan=lifespan)
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
@app.get("/")
def read_root():
    return {
        "status": "online",
        "version": "v2.1-streaming-fix", 
        "deployed_at": "2026-03-19 14:30" 
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)