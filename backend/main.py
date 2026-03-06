from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from repository.database import create_db
from controller.document_controller import router as document_router
from controller.chat_controller import router as chat_controller
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating database tables...")
    await create_db() 
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(document_router)
app.include_router(chat_controller)
# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your specific domains
    allow_credentials=True,
    allow_methods=["*"], # Allows GET, POST, PUT, DELETE
    allow_headers=["*"], # Allows Authorization headers (for your Auth token)
)
@app.get("/")
def read_root():
    return {"message": "StudyBuddy API is alive"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)