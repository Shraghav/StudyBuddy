from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

class SessionCreate(BaseModel):
    title: str
    document_id: Optional[UUID] = None

class ChatRequest(BaseModel):
    question: str

class SessionRenameRequest(BaseModel):
    title: str

class BulkDeleteRequest(BaseModel):
    session_ids: List[UUID]