from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_api_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "operational"


def test_api_metrics():
    resp = client.get("/api/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "champion_model" in data
    assert "accuracy" in data
    assert "macro_f1" in data
    assert "per_class" in data
    # Check n is present
    for cname, cinfo in data["per_class"].items():
        assert "test_n" in cinfo
        assert "total_n" in cinfo
        assert "support_note" in cinfo
    # PortScan should be low support
    assert data["per_class"]["PortScan"]["low_support"] is True


def test_api_comparison():
    resp = client.get("/api/comparison")
    assert resp.status_code == 200
    data = resp.json()
    assert "table" in data
    assert "models" in data
    assert "XGBoost" in data["models"]
    assert "Random Forest" in data["models"]
    assert "SVM" in data["models"]


def test_api_cases():
    resp = client.get("/api/cases")
    assert resp.status_code == 200
    data = resp.json()
    assert "cases" in data
    assert len(data["cases"]) >= 3
    assert "global_importance" in data
    assert "shap_note" in data


def test_api_dataset():
    resp = client.get("/api/dataset")
    assert resp.status_code == 200
    data = resp.json()
    assert data["benchmark_name"] == "CICIDS2017"
    assert "funnel_stages" in data
    assert len(data["raw_files"]) == 3


def test_api_predict_demo():
    resp = client.post("/api/predict?demo=true")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_records" in data
    assert data["total_records"] == 10000
    assert "class_counts" in data
    assert "rows" in data
    assert len(data["rows"]) > 0


def test_api_export():
    resp = client.get("/api/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "Predicted_Class" in resp.text


def test_spa_production_serving():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "<!doctype html>" in resp.text.lower() or "<html" in resp.text.lower()
    # Deep client route fallback
    resp_route = client.get("/analyze")
    assert resp_route.status_code == 200
    assert "<!doctype html>" in resp_route.text.lower() or "<html" in resp_route.text.lower()
