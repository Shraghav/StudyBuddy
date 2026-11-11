from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class AttachDocumentRequest(BaseModel):
    document_id: UUID
    session_type: Literal["chat", "quiz"]

class AttachDocumentResponse(BaseModel):
    status: str
    message: str
    session_id: UUID
    document_id: UUID
    session_type: str