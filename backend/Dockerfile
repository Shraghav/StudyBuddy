# Production Dockerfile for Study Buddy FastAPI Backend
FROM python:3.12-slim

# 1. Performance and environment flags
# PYTHONPATH includes both /app and /app/backend to handle root and nested import statements
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app:/app/backend"

# 2. Install essential system dependencies (Poppler, ONNX/OpenCV runtime libraries, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. Set work directory
WORKDIR /app

# 4. Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 5. Create non-root system user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

# 6. Copy application code with non-root ownership
COPY --chown=appuser:appuser . .

USER appuser

# 7. Expose default API port
EXPOSE 8000

# 8. Lightweight container health check using the root health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# 9. Start Uvicorn production server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
