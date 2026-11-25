# Production Deployment Guide: Sentinel NIDS

Sentinel NIDS is engineered as a unified full-stack application capable of running locally, inside production Docker containers, or across cloud platforms (GCP Cloud Run, AWS App Runner, Fly.io, Render, Railway, Hugging Face Spaces).

---

## 1. Unified Single-Port Architecture

In production, the compiled React Single-Page Application (SPA) in `web/dist/` is mounted and served directly by the FastAPI application:
- **Port**: `8000` (or `$PORT` environment variable)
- **Root URL (`/`)**: Serves the animated editorial React frontend with particle background and D3 visualizers.
- **Client-Side Routes (`/analyze`, `/threats`, `/explain`, `/compare`, `/method`, `/limits`)**: Resolved via SPA fallback to `index.html`.
- **API Endpoints (`/api/*`)**: High-speed batch inference, metric queries, SHAP case retrieval, and CSV exports.
- **Interactive Documentation (`/docs`)**: OpenAPI/Swagger documentation.

---

## 2. Local Production Run

To build the web bundle and launch the unified production server on `http://localhost:8000`:

```bash
# 1. Compile React production assets
cd web && npm run build && cd ..

# 2. Launch production server
. .venv/bin/activate && uvicorn api.main:app --host 0.0.0.0 --port 8000
```
Or use the Makefile shortcut:
```bash
make serve-prod
```

---

## 3. Containerized Deployment (Docker)

A multi-stage Docker build encapsulates the Node.js frontend compiler and Python 3.11 runtime:

### Build & Run with Docker Compose:
```bash
docker compose up --build -d
```
The application will be live at `http://localhost:8000`.

### Manual Docker CLI:
```bash
# Build image
docker build -t sentinel-nids:latest .

# Run container
docker run -d -p 8000:8000 --name sentinel-nids sentinel-nids:latest
```

---

## 4. Cloud Platform Deployments

### A. Google Cloud Run / AWS App Runner / Fly.io
Deploy the container directly from the root directory:
```bash
# Example Fly.io deploy
fly launch --now

# Example GCP Cloud Run deploy
gcloud run deploy sentinel-nids --source . --port 8000 --allow-unauthenticated
```

### B. Render / Railway
1. Connect your GitHub repository to Render or Railway.
2. Select **Docker** environment (or Python environment with build command `cd web && npm run build && cd .. && pip install -r requirements.txt`).
3. Set start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.

### C. Hugging Face Spaces (Docker Space)
1. Create a new Space with the **Docker** SDK.
2. Push this repository to the Space remote.
3. Hugging Face Spaces will automatically build the `Dockerfile` and serve on port `7860` (or specify `PORT=7860`).

---

## 5. Production Health Check

Verify deployment health:
```bash
curl -f http://localhost:8000/api/health
# Response: {"status":"operational","system":"Sentinel NIDS"}
```
