import time
from typing import Optional

import numpy as np
from sklearn.ensemble import RandomForestClassifier

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class NIDSRandomForest:
    """Random Forest model wrapper for NIDS 4-class intrusion detection."""

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: Optional[int] = 20,
        min_samples_split: int = 5,
        min_samples_leaf: int = 2,
        class_weight: str = "balanced",
        random_state: int = 42,
        n_jobs: int = -1,
    ):
        self.params = {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "min_samples_split": min_samples_split,
            "min_samples_leaf": min_samples_leaf,
            "class_weight": class_weight,
            "random_state": random_state,
            "n_jobs": n_jobs,
        }
        self.model = RandomForestClassifier(**self.params)
        self.train_time_sec: float = 0.0
        self.inference_time_sec: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "NIDSRandomForest":
        logger.info(f"Training Random Forest on {len(X)} samples with {X.shape[1]} features...")
        start = time.perf_counter()
        self.model.fit(X, y)
        self.train_time_sec = round(time.perf_counter() - start, 4)
        logger.info(f"Random Forest training finished in {self.train_time_sec}s")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        start = time.perf_counter()
        preds = self.model.predict(X)
        self.inference_time_sec = round(time.perf_counter() - start, 5)
        return preds

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)
