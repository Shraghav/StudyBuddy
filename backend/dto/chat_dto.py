from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    title: str = Field(..., description="Initial title for the chat session", examples=["DBMS Queries Session"])
    document_id: UUID = Field(..., description="Unique identifier of the document to associate with this chat session")


class ChatRequest(BaseModel):
    question: str = Field(..., description="Natural language question to ask grounded in the attached document", examples=["What are the differences between clustered and non-clustered indexing?"])


class SessionRenameRequest(BaseModel):
    title: str = Field(..., description="Updated display title for the session", examples=["Database Indexing Discussion"])


class BulkDeleteRequest(BaseModel):
    session_ids: list[UUID] = Field(..., description="List of chat session UUIDs to delete")


# Response DTOs
class ChatSessionItemDTO(BaseModel):
    id: UUID = Field(..., description="Unique identifier of the chat session")
    user_id: UUID | None = Field(default=None, description="Identifier of the session owner")
    document_id: UUID | None = Field(default=None, description="Identifier of the linked document")
    title: str = Field(..., description="Display title of the chat session", examples=["Database Normalization Q&A"])
    created_at: datetime | None = Field(default=None, description="Session creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class ChatSessionCreateResponseDTO(BaseModel):
    status: str = Field(default="success", description="Status of the operation", examples=["success"])
    session: ChatSessionItemDTO


class ChatSessionRenameResponseDTO(BaseModel):
    status: str = Field(default="success", description="Operation status", examples=["success"])
    data: dict[str, str]


class ChatBulkDeleteResponseDTO(BaseModel):
    status: str = Field(default="success", description="Operation status", examples=["success"])
    data: dict[str, str]


class ChatMessageItemDTO(BaseModel):
    id: str = Field(..., description="Unique identifier of the message")
    text: str = Field(..., description="Message content", examples=["What is 3NF in DBMS?"])
    sender: str = Field(..., description="Origin of the message ('user' or 'ai')", examples=["user"])
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp string", examples=["2026-11-11T10:00:00"])


class ChatHistorySessionDTO(BaseModel):
    id: str = Field(..., validation_alias=AliasChoices("id", "session_id"), description="Unique identifier of the chat session")
    title: str = Field(..., description="Title of the session", examples=["DBMS Revision"])
    document_id: str | None = Field(default=None, description="Identifier of the linked document")
    attachedDocName: str | None = Field(default="No document attached", description="Name of the attached document", examples=["DBMS_Cheatsheet.pdf"])
    messages: list[ChatMessageItemDTO] = Field(default=[], description="Chronological list of chat messages")

    model_config = ConfigDict(populate_by_name=True)


class ChatHistoryResponseDTO(BaseModel):
    status: str = Field(default="success", description="Operation status", examples=["success"])
    sessions: list[ChatHistorySessionDTO] = Field(default=[], description="List of all chat sessions for the authenticated user")