from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentRenameRequest(BaseModel):
    new_name: str = Field(..., description="Target new display name for the document", examples=["DBMS_CheatSheet_v2.pdf"])


class DocumentResponse(BaseModel):
    id: UUID = Field(..., description="Unique identifier of the document")
    name: str = Field(..., description="Display name of the document", examples=["DBMS_Cheatsheet.pdf"])
    upload_date: datetime | None = Field(default=None, description="Timestamp of document upload")
    status: str | None = Field(default="Processing", description="Current processing status (Processing, READY, FAILED)", examples=["READY"])
    file_url: str | None = Field(default=None, description="Storage URL of the document file")

    model_config = ConfigDict(from_attributes=True)


class DocumentCreate(BaseModel):
    name: str = Field(..., description="Name of the file to upload", examples=["DBMS_Cheatsheet.pdf"])
    file_url: str = Field(..., description="Storage URL of the uploaded document", examples=["https://example.supabase.co/storage/v1/object/study-buddy-docs/uploads/DBMS.pdf"])


class DocumentBatchDeleteResponseDTO(BaseModel):
    success: bool = Field(..., description="Flag indicating if the deletion operation was successful", examples=[True])
