from typing import Any, Literal, Union
from uuid import UUID

from dto.enums import QuizStatus
from pydantic import BaseModel, ConfigDict, Field


class SetupQuizRequest(BaseModel):
    title: str
    document_id: UUID


class QuizGenerationRequestDTO(BaseModel):
    numQuestions: int = Field(..., gt=0, le=25)
    difficulty: Literal["Easy", "Medium", "Hard"]
    customPrompt: str = Field(default="", max_length=500)

class QuizGenerationResponseDTO(BaseModel):
    message:str
    session_title:str

class QuizDeleteResponseDTO(BaseModel):
    message:str   
    session_ids:list[UUID]

class QuizSessionMinimalDTO(BaseModel):
    id: UUID
    title: str
    status: QuizStatus
    
    model_config = ConfigDict(from_attributes=True)

class QuizQuestionActiveDTO(BaseModel):
    id: UUID
    text: str
    options: dict[str, Any] | None = None

class QuizSessionActiveDTO(BaseModel):
    id: UUID
    title: str
    status: Literal[QuizStatus.active]
    questions: list[QuizQuestionActiveDTO]
    
    model_config = ConfigDict(from_attributes=True)

class QuizQuestionCompletedDTO(BaseModel):
    id: UUID
    text: str
    options: dict[str, Any] | None = None
    user_answer: str | None = None
    correct_answer: str
    evaluation_score: float | None = None
    evaluation_feedback: str | None = None

class QuizSessionCompletedDTO(BaseModel):
    id: UUID
    title: str
    status: Literal[QuizStatus.completed]
    score: int
    feedback: str
    questions: list[QuizQuestionCompletedDTO]
    
    model_config = ConfigDict(from_attributes=True)

class QuizQuestionRequest(BaseModel):
    question_id:UUID
    user_answer:str

class QuizSubmitResponseDTO(BaseModel):
    message: str
    status: str
    score: int

class QuizSessionRenameRequest(BaseModel):
    title: str

class QuizSessionRenameResponse(BaseModel):
    status: str
    data:dict[str, str]
QuizSessionResponseDTO = Union[QuizSessionCompletedDTO, QuizSessionActiveDTO, QuizSessionMinimalDTO]