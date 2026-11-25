import numpy as np

from nids.models.evaluate import evaluate_predictions


def test_evaluate_predictions_metrics():
    y_true = np.array(["Normal", "Normal", "DDoS", "PortScan", "BruteForce"])
    y_pred = np.array(["Normal", "Normal", "DDoS", "PortScan", "Normal"])

    metrics = evaluate_predictions(
        y_true, y_pred, classes=["Normal", "DDoS", "PortScan", "BruteForce"]
    )

    assert "accuracy" in metrics
    assert "macro_f1" in metrics
    assert "weighted_f1" in metrics
    assert "per_class" in metrics
    assert "confusion_matrix" in metrics

    # 4 out of 5 correct = 0.8
    assert metrics["accuracy"] == 0.8
    # BruteForce recall should be 0.0 because it was predicted as Normal
    assert metrics["per_class"]["BruteForce"]["recall"] == 0.0
    # Normal recall should be 1.0 (2 out of 2 true Normals were identified)
    assert metrics["per_class"]["Normal"]["recall"] == 1.0
    # DDoS recall should be 1.0
    assert metrics["per_class"]["DDoS"]["recall"] == 1.0
