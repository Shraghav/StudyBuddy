from typing import Any, Literal, Union
from uuid import UUID

from dto.enums import QuizStatus
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class SetupQuizRequest(BaseModel):
    title: str = Field(..., description="Display title for the new quiz session", examples=["Database Normalization Mastery"])
    document_id: UUID = Field(..., description="Unique identifier of the document from which questions will be generated")


class QuizSetupSessionData(BaseModel):
    id: UUID = Field(..., description="Unique identifier of the created quiz session")
    title: str = Field(..., description="Title of the quiz session", examples=["Database Normalization Mastery"])
    document_id: UUID | None = Field(default=None, description="Linked document identifier")
    status: QuizStatus = Field(default=QuizStatus.setup, description="Initial lifecycle state of the quiz session", examples=["setup"])

    model_config = ConfigDict(from_attributes=True)


class QuizSetupResponseDTO(BaseModel):
    status: str = Field(default="success", description="Outcome status of the initialization", examples=["success"])
    session: QuizSetupSessionData


class QuizGenerationRequestDTO(BaseModel):
    numQuestions: int = Field(..., gt=0, le=20, description="Number of questions to generate (1 to 20)", examples=[5])
    difficulty: Literal["Easy", "Medium", "Hard"] = Field(..., description="Difficulty level for assessment generation", examples=["Medium"])
    customPrompt: str = Field(default="", max_length=500, description="Optional extra prompt guidance for question generation", examples=["Focus on 2NF and 3NF anomalies"])


class QuizGenerationResponseDTO(BaseModel):
    message: str = Field(..., description="Notification describing generation initiation status", examples=["Started generation"])
    session_title: str = Field(..., description="Title of the session where generation was triggered", examples=["Database Normalization Mastery"])


class QuizDeleteResponseDTO(BaseModel):
    message: str = Field(..., description="Operation success message", examples=["success"])
    session_ids: list[UUID] = Field(..., description="Collection of deleted quiz session UUIDs")


class QuizSessionMinimalDTO(BaseModel):
    session_id: UUID = Field(..., description="Identifier of the quiz session", validation_alias=AliasChoices("session_id", "id"))
    title: str = Field(..., description="Title of the quiz session", examples=["SQL Joins Assessment"])
    document_id: UUID | None = Field(default=None, description="Linked document identifier")
    status: QuizStatus = Field(..., description="Current status of the quiz session", examples=["setup"])

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionActiveDTO(BaseModel):
    id: UUID = Field(..., description="Identifier of the question")
    text: str = Field(..., description="Question statement", examples=["Which normal form eliminates partial functional dependency?"])
    options: dict[str, Any] | None = Field(default=None, description="Multiple choice answer options", examples=[{"A": "1NF", "B": "2NF", "C": "3NF", "D": "BCNF"}])


class QuizSessionActiveDTO(BaseModel):
    session_id: UUID = Field(..., description="Unique identifier of the active quiz session", validation_alias=AliasChoices("session_id", "id"))
    title: str = Field(..., description="Title of the quiz", examples=["SQL Joins Assessment"])
    document_id: UUID | None = Field(default=None, description="Linked document identifier")
    status: Literal[QuizStatus.active] = Field(default=QuizStatus.active, description="Active status indicating readiness for answers")
    questions: list[QuizQuestionActiveDTO] = Field(default=[], description="List of generated questions available to solve")

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionCompletedDTO(BaseModel):
    id: UUID = Field(..., description="Identifier of the question", validation_alias=AliasChoices("id", "session_id"))
    session_id: UUID | None = Field(default=None, description="Identifier of the question session")
    text: str = Field(..., description="Question text", examples=["Which normal form eliminates partial functional dependency?"])
    options: dict[str, Any] | None = Field(default=None, description="Available answer options", examples=[{"A": "1NF", "B": "2NF", "C": "3NF", "D": "BCNF"}])
    user_answer: str | None = Field(default=None, description="Answer submitted by the user", examples=["B"])
    correct_answer: str = Field(..., description="Actual correct option letter or answer", examples=["B"])
    evaluation_score: float | None = Field(default=None, description="Score awarded for this question (1.0 or 0.0)", examples=[1.0])
    evaluation_feedback: str | None = Field(default=None, description="Feedback or explanation for the question")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class QuizSessionCompletedDTO(BaseModel):
    session_id: UUID = Field(..., description="Identifier of the completed quiz session", validation_alias=AliasChoices("session_id", "id"))
    title: str = Field(..., description="Title of the quiz session", examples=["SQL Joins Assessment"])
    document_id: UUID | None = Field(default=None, description="Linked document identifier")
    status: Literal[QuizStatus.completed] = Field(default=QuizStatus.completed, description="Completed status indicating graded state")
    score: int = Field(..., description="Total score achieved by the user", examples=[5])
    feedback: str = Field(default="", description="Overall performance feedback or evaluation summary", examples=["Great job on database normalization concepts!"])
    questions: list[QuizQuestionCompletedDTO] = Field(default=[], description="Comprehensive list of evaluated questions and answers")

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionRequest(BaseModel):
    question_id: UUID = Field(..., description="Identifier of the question being answered")
    user_answer: str = Field(..., description="User's selected option letter or text", examples=["B"])


class QuizSubmitResponseDTO(BaseModel):
    message: str = Field(default="Quiz is submitted", description="Submission result message", examples=["Quiz is submitted"])
    status: str = Field(default="Success", description="Status confirmation", examples=["Success"])
    score: int = Field(..., description="Final numeric score attained on the quiz", examples=[5])


class QuizSessionRenameRequest(BaseModel):
    title: str = Field(..., description="New display title for the quiz session", examples=["Advanced SQL Joins Exam"])


class QuizRenameMessageDTO(BaseModel):
    message: str = Field(..., description="Confirmation message regarding the rename action", examples=["Session renamed successfully"])


class QuizSessionRenameResponse(BaseModel):
    status: str = Field(default="success", description="Status of the rename request", examples=["success"])
    data: dict[str, str]


QuizSessionResponseDTO = Union[QuizSessionCompletedDTO, QuizSessionActiveDTO, QuizSessionMinimalDTO]  # noqa: UP007
