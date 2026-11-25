import pandas as pd
import pytest

from nids.prediction.predict import PredictionPipeline
from nids.utils.config import get_project_root


def test_prediction_pipeline_on_demo_data():
    root = get_project_root()
    bundle_dir = root / "models" / "selected_model"
    demo_file = root / "data" / "demo" / "cicids2017_demo.csv"

    # Only run if model has been trained
    if not (bundle_dir / "model.joblib").exists():
        pytest.skip("Model not trained yet, skipping prediction pipeline test.")

    pipeline = PredictionPipeline(bundle_dir)
    df_demo = pd.read_csv(demo_file, nrows=100)

    results = pipeline.predict(df_demo)

    assert "Predicted_Class" in results.columns
    assert "Prediction_Confidence" in results.columns
    assert len(results) == len(df_demo)
    assert set(results["Predicted_Class"].unique()).issubset(
        {"Normal", "DDoS", "PortScan", "BruteForce"}
    )
    # Verify confidence is between 0 and 1
    assert (results["Prediction_Confidence"] >= 0.0).all()
    assert (results["Prediction_Confidence"] <= 1.0).all()


def test_prediction_pipeline_schema_validation():
    root = get_project_root()
    bundle_dir = root / "models" / "selected_model"

    if not (bundle_dir / "model.joblib").exists():
        pytest.skip("Model not trained yet.")

    pipeline = PredictionPipeline(bundle_dir)
    # DataFrame missing required columns
    df_bad = pd.DataFrame({"dummy_column": [1, 2, 3]})

    with pytest.raises(ValueError, match="Validation failed.*missing.*required features"):
        pipeline.predict(df_bad)
