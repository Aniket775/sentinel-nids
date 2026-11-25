import time

import numpy as np
from xgboost import XGBClassifier

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class NIDSXGBoost:
    """XGBoost Classifier wrapper for NIDS 4-class intrusion detection."""

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        eval_metric: str = "mlogloss",
        random_state: int = 42,
        n_jobs: int = -1,
    ):
        self.params = {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "learning_rate": learning_rate,
            "subsample": subsample,
            "colsample_bytree": colsample_bytree,
            "eval_metric": eval_metric,
            "random_state": random_state,
            "n_jobs": n_jobs,
            "tree_method": "hist",
        }
        self.model = XGBClassifier(**self.params)
        self.train_time_sec: float = 0.0
        self.inference_time_sec: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "NIDSXGBoost":
        logger.info(f"Training XGBoost on {len(X)} samples with {X.shape[1]} features...")
        start = time.perf_counter()
        self.model.fit(X, y)
        self.train_time_sec = round(time.perf_counter() - start, 4)
        logger.info(f"XGBoost training finished in {self.train_time_sec}s")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        start = time.perf_counter()
        preds = self.model.predict(X)
        self.inference_time_sec = round(time.perf_counter() - start, 5)
        return preds

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)
