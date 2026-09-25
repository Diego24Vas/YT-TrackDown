FROM python:3.12-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install system dependencies: FFmpeg, Node.js, and CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user matching standard host UID/GID 1000
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Install python dependencies first for layer caching
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend and frontend source files
COPY backend /app/backend
COPY frontend /app/frontend

# Create downloads volume directory with correct ownership
RUN mkdir -p /app/downloads && chown -R appuser:appgroup /app

USER appuser

ENV HOST=0.0.0.0 \
    PORT=8080 \
    FFMPEG_LOCATION=/usr/bin/ffmpeg \
    NODE_PATH=/usr/bin/node

EXPOSE 8080

CMD ["python3", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
