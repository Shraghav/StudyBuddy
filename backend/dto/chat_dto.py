from uuid import UUID

from pydantic import BaseModel


class SessionCreate(BaseModel):
    title: str
    document_id: UUID

class ChatRequest(BaseModel):
    question: str

class SessionRenameRequest(BaseModel):
    title: str

class BulkDeleteRequest(BaseModel):
    session_ids: list[UUID]