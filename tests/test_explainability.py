import numpy as np
from sklearn.ensemble import RandomForestClassifier

from nids.explain.shap_explainer import NIDSShapExplainer


def test_shap_explainer_generates_local_attributions():
    np.random.seed(42)
    X = np.random.randn(50, 4)
    y = np.array([0] * 25 + [1] * 25)
    rf = RandomForestClassifier(n_estimators=10, random_state=42)
    rf.fit(X, y)

    explainer = NIDSShapExplainer(
        model=rf,
        feature_names=["f1", "f2", "f3", "f4"],
        class_names=["Normal", "DDoS"],
    )
    explainer.fit_explainer(X[:20])

    inst = X[0]
    explanation = explainer.explain_instance(inst, predicted_class_idx=0, top_n=3)

    assert "predicted_class" in explanation
    assert "top_features" in explanation
    assert len(explanation["top_features"]) == 3
    assert "shap_value" in explanation["top_features"][0]
    assert "actual_value" in explanation["top_features"][0]
    assert "disclaimer" in explanation
