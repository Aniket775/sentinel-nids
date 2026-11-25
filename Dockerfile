# Multi-Stage Production Dockerfile for Sentinel NIDS
# Stage 1: Build the React / TypeScript Web Interface
FROM node:20-slim AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Python 3.11 Production Runtime Environment
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code, models, reports, configs, and demo data
COPY src/ ./src/
RUN pip install --no-cache-dir -e .
COPY api/ ./api/
COPY app/ ./app/
COPY configs/ ./configs/
COPY models/ ./models/
COPY reports/ ./reports/
COPY data/demo/ ./data/demo/

# Copy built frontend assets from Stage 1 into web/dist
COPY --from=frontend-builder /app/web/dist ./web/dist

# Expose production port
EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch unified FastAPI server serving both API and Frontend
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
