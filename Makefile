.PHONY: help install lint test data demo train app api web build-web serve-prod clean

help:
	@echo "Available commands:"
	@echo "  make install    - Set up virtual environment and install dependencies"
	@echo "  make lint       - Run Ruff code style checks"
	@echo "  make test       - Run pytest test suite"
	@echo "  make data       - Download authentic CICIDS2017 files & audit"
	@echo "  make demo       - Extract 10,000 genuine demonstration records"
	@echo "  make train      - Train Random Forest, SVM, and XGBoost models"
	@echo "  make app        - Launch the Streamlit Cybersecurity Dashboard"
	@echo "  make api        - Launch the FastAPI Backend service (:8000)"
	@echo "  make web        - Launch both FastAPI (:8000) and Vite React Frontend (:5173)"
	@echo "  make build-web  - Build the production React frontend bundle"
	@echo "  make serve-prod - Compile frontend & serve unified full-stack app on :8000"
	@echo "  make clean      - Remove build artifacts, pycache, and temp files"

install:
	python3 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip
	. .venv/bin/activate && pip install -r requirements.txt
	. .venv/bin/activate && pip install -e .

lint:
	. .venv/bin/activate && ruff check src tests app scripts api

test:
	. .venv/bin/activate && pytest -v tests/

data:
	. .venv/bin/activate && python3 scripts/download_data.py
	. .venv/bin/activate && python3 scripts/audit_dataset.py

demo:
	. .venv/bin/activate && python3 scripts/generate_demo_data.py

train:
	. .venv/bin/activate && python3 scripts/train_models.py

app:
	. .venv/bin/activate && streamlit run app/dashboard.py

api:
	. .venv/bin/activate && uvicorn api.main:app --host 0.0.0.0 --port 8000

web:
	@echo "Launching Sentinel NIDS API (:8000) and Web Frontend (:5173)..."
	@trap 'kill 0' EXIT INT TERM; \
	(. .venv/bin/activate && uvicorn api.main:app --host 0.0.0.0 --port 8000) & \
	(cd web && npm run dev) & \
	wait

build-web:
	cd web && npm run build

serve-prod: build-web
	@echo "Serving Sentinel NIDS full-stack production build on http://localhost:8000..."
	. .venv/bin/activate && uvicorn api.main:app --host 0.0.0.0 --port 8000

tunnel:
	@echo "Opening universal public HTTPS tunnel to Sentinel NIDS on port 8000..."
	ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:localhost:8000 a.pinggy.io

clean:
	rm -rf build/ dist/ *.egg-info .pytest_cache/ web/dist/
	find . -type d -name __pycache__ -exec rm -rf {} +
