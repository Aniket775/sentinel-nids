from app.components.charts import (
    create_attack_breakdown_bar,
    create_class_distribution_pie,
    create_confidence_histogram,
    create_shap_waterfall_bar,
)
from app.components.metrics import render_status_badge
from app.dashboard import get_prediction_pipeline


def test_dashboard_pipeline_loading():
    pipeline = get_prediction_pipeline()
    assert pipeline is not None
    assert len(pipeline.selected_features) == 25
    assert len(pipeline.label_classes) == 4


def test_dashboard_charts():
    counts = {"Normal": 80, "DDoS": 15, "PortScan": 3, "BruteForce": 2}
    fig_pie = create_class_distribution_pie(counts)
    assert fig_pie is not None

    fig_bar = create_attack_breakdown_bar({"DDoS": 15, "PortScan": 3})
    assert fig_bar is not None

    fig_hist = create_confidence_histogram([0.95, 0.99, 0.88, 0.72])
    assert fig_hist is not None

    top_feats = [
        {"feature": "Destination Port", "shap_value": 0.45, "actual_value": 80.0},
        {"feature": "Flow Packets/s", "shap_value": -0.12, "actual_value": 1200.0},
    ]
    fig_shap = create_shap_waterfall_bar(top_feats)
    assert fig_shap is not None


def test_status_badge():
    badge_normal = render_status_badge("Normal")
    assert "Normal" in badge_normal
    assert "#065F46" in badge_normal

    badge_ddos = render_status_badge("DDoS")
    assert "DDoS" in badge_ddos
    assert "#7F1D1D" in badge_ddos
