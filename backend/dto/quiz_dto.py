from typing import Any, Dict, List, Optional, Literal, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from dto.enums import QuizStatus

class QuizSetupParamsDTO(BaseModel):
    document_id:UUID

# Quiz Generation  request and response
class QuizGenerationRequestDTO(BaseModel):
    numQuestions: int = Field(..., gt=0, le=25)
    difficulty: Literal["Easy", "Medium", "Hard"]
    format: Literal["mcq","text"]
    customPrompt: Optional[str] = Field(default="", max_length=500)

class QuizGenerationResponseDTO(BaseModel):
    message:str
    session_title:str

# Quiz Setup and delete parameters
class QuizSetUPAndDeleteResponseDTO(BaseModel):
    message:str   
    session_id:UUID

#Quiz sidebar
class QuizSessionMinimalDTO(BaseModel):
    id: UUID
    title: str
    status: QuizStatus
    
    model_config = ConfigDict(from_attributes=True)

# Quiz active status (session and questions)
class QuizQuestionActiveDTO(BaseModel):
    id: UUID
    text: str
    options: Optional[Dict[str, Any]] = None

class QuizSessionActiveDTO(BaseModel):
    id: UUID
    title: str
    status: Literal[QuizStatus.active]
    questions: List[QuizQuestionActiveDTO]
    
    model_config = ConfigDict(from_attributes=True)

# Quiz completed status (session and questions)
class QuizQuestionCompletedDTO(BaseModel):
    id: UUID
    text: str
    options: Optional[Dict[str, Any]] = None
    user_answer: Optional[str] = None
    correct_answer: str
    evaluation_score: Optional[float] = None
    evaluation_feedback: Optional[str] = None

class QuizSessionCompletedDTO(BaseModel):
    id: UUID
    title: str
    status: Literal[QuizStatus.completed]
    score: int
    feedback: str
    questions: List[QuizQuestionCompletedDTO]
    
    model_config = ConfigDict(from_attributes=True)

# Quiz question request
class QuizQuestionRequest(BaseModel):
    question_id:UUID
    user_answer:str

# Quiz submit response (overall)
class QuizSubmitResponseDTO(BaseModel):
    message:str
    status:str

QuizSessionResponseDTO = Union[QuizSessionCompletedDTO, QuizSessionActiveDTO, QuizSessionMinimalDTO]