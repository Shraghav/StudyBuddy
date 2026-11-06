from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentRenameRequest(BaseModel):
    new_name: str

class DocumentResponse(BaseModel):
    id: UUID
    name: str
    size: int | None = 0
    upload_date: datetime

class DocumentCreate(BaseModel):
    name: str
    file_url: str
    size: int