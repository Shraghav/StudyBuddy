from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

class QuizSetupParamsDTO(BaseModel):
    numQuestions: str
    difficulty: str
    format: str
    customPrompt: str

class QuizSessionCreate(BaseModel):
    title: str
    document_id: Optional[UUID] = None
    setup_params: QuizSetupParamsDTO

class QuizQuestionResponse(BaseModel):
    id: UUID
    text: str
    type: str
    options: Optional[List[str]]
    correct_answer: str
    class Config:
        from_attributes = True

class QuizSessionResponse(BaseModel):
    id: UUID
    title: str
    status: str
    setup_params: dict
    score: int
    feedback: Optional[str]
    questions: List[QuizQuestionResponse] = []
    class Config:
        from_attributes = True