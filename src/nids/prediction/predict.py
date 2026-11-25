import time
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union

import numpy as np
import pandas as pd

from nids.models.registry import ModelRegistry
from nids.utils.logging import get_logger

logger = get_logger(__name__)


class PredictionPipeline:
    """
    Offline batch and single-record prediction pipeline for NIDS.
    - Loads saved model bundle from disk.
    - Validates CSV input schema.
    - Safely removes target label columns (e.g. 'Label') if present to avoid data leakage.
    - Transforms features using saved preprocessor and feature selector.
    - Executes prediction and returns class labels and confidence probabilities.
    """

    def __init__(self, model_bundle_dir: Union[str, Path]):
        self.bundle_dir = Path(model_bundle_dir)
        self.bundle = ModelRegistry.load_bundle(self.bundle_dir)
        self.model = self.bundle["model"]
        self.preprocessor = self.bundle["preprocessor"]
        self.feature_selector = self.bundle["feature_selector"]
        self.label_classes: List[str] = self.bundle["label_classes"]
        self.selected_features: List[str] = self.bundle["selected_features"]
        self.metadata: Dict[str, Any] = self.bundle["metadata"]

    def validate_input(self, df: pd.DataFrame) -> Tuple[bool, List[str], List[str]]:
        """
        Validates input DataFrame against required feature schema.
        Returns:
            (is_valid, missing_features, extra_features)
        """
        cols = set(df.columns.str.strip())
        req_cols = set(self.selected_features)

        missing = sorted(list(req_cols - cols))
        extra = sorted(list(cols - req_cols))
        is_valid = len(missing) == 0
        return is_valid, missing, extra

    def predict(
        self,
        df_input: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Runs batch prediction on input DataFrame.
        Returns original input preserved, augmented with:
        - 'Predicted_Class': predicted string label (Normal, DDoS, etc.)
        - 'Prediction_Confidence': probability score (0.0 to 1.0)
        - 'Prediction_Score_<Class>': class-specific probability columns
        """
        if not isinstance(df_input, pd.DataFrame):
            raise TypeError("Expected input to be a pandas DataFrame")

        df = df_input.copy()
        df.columns = df.columns.str.strip()

        # If a Label column exists (e.g., from evaluation dataset), separate it
        if "Label" in df.columns:
            df["Label"].copy()
            df_features = df.drop(columns=["Label"])
        else:
            df_features = df

        # Schema validation
        is_valid, missing, _ = self.validate_input(df_features)
        if not is_valid:
            raise ValueError(
                f"Validation failed. Input is missing {len(missing)} required features: {missing[:10]}..."
            )

        # Select exact features required
        X_selected = df_features[self.selected_features].copy()

        # Clean infinities to NaN
        vals = X_selected.select_dtypes(include=[np.number]).columns
        X_selected[vals] = X_selected[vals].replace([np.inf, -np.inf], np.nan)

        # Preprocess features (impute + scale if configured)
        X_proc = self.preprocessor.transform(X_selected)

        # Run inference and measure time
        start = time.perf_counter()
        preds = self.model.predict(X_proc)
        inference_time = time.perf_counter() - start

        # Probabilities
        proba = None
        if hasattr(self.model, "predict_proba"):
            try:
                proba = self.model.predict_proba(X_proc)
            except Exception as e:
                logger.warning(f"Failed to obtain prediction probabilities: {e}")

        # Assemble output
        df_result = df.copy()

        # Handle numeric vs string predictions
        if isinstance(preds[0], (int, np.integer)):
            pred_labels = [self.label_classes[p] for p in preds]
        else:
            pred_labels = [str(p) for p in preds]

        df_result["Predicted_Class"] = pred_labels

        if proba is not None and proba.shape[1] == len(self.label_classes):
            df_result["Prediction_Confidence"] = np.max(proba, axis=1).round(4)
            for idx, cname in enumerate(self.label_classes):
                df_result[f"Score_{cname}"] = proba[:, idx].round(4)
        else:
            df_result["Prediction_Confidence"] = 1.0

        throughput = len(df_result) / max(inference_time, 1e-6)
        logger.info(
            f"Predicted {len(df_result):,} records in {inference_time:.4f}s "
            f"({throughput:,.1f} records/sec)"
        )
        return df_result
