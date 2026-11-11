from pydantic import BaseModel, Field


class ErrorResponseDTO(BaseModel):
    """Standard error response payload returned by HTTP exceptions."""
    detail: str = Field(..., description="Error message describing the failure reason.", examples=["An error occurred while processing the request."])


class BadRequestErrorDTO(BaseModel):
    """Error response for HTTP 400 Bad Request."""
    detail: str = Field(..., description="Details regarding the invalid input or state constraint.", examples=["Document not found or invalid parameters provided."])


class UnauthorizedErrorDTO(BaseModel):
    """Error response for HTTP 401 Unauthorized."""
    detail: str = Field(default="Could not validate credentials", description="Authentication failure details.", examples=["Could not validate credentials"])


class NotFoundErrorDTO(BaseModel):
    """Error response for HTTP 404 Not Found."""
    detail: str = Field(..., description="Information on the resource that could not be located.", examples=["The requested resource was not found."])


class RateLimitErrorDTO(BaseModel):
    """Error response for HTTP 429 Too Many Requests."""
    detail: str = Field(..., description="Rate limit restriction message including window duration and cooldown.", examples=["Rate limit exceeded. Maximum 20 requests per 60s allowed. Try again in 45s."])


class InternalServerErrorDTO(BaseModel):
    """Error response for HTTP 500 Internal Server Error."""
    detail: str = Field(default="Internal server error.", description="Server failure error description.", examples=["Internal server error."])
