import time
from typing import Optional

import numpy as np
from sklearn.svm import SVC

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class NIDSSVM:
    """
    Support Vector Machine (SVC) wrapper for NIDS.
    Includes support for documented representative sampling to maintain bounded training time
    on large datasets.
    """

    def __init__(
        self,
        C: float = 1.0,
        kernel: str = "rbf",
        gamma: str = "scale",
        class_weight: str = "balanced",
        probability: bool = True,
        max_iter: int = 4000,
        random_state: int = 42,
        sample_limit: Optional[int] = 25000,
    ):
        self.params = {
            "C": C,
            "kernel": kernel,
            "gamma": gamma,
            "class_weight": class_weight,
            "probability": probability,
            "max_iter": max_iter,
            "random_state": random_state,
        }
        self.sample_limit = sample_limit
        self.model = SVC(**self.params)
        self.train_time_sec: float = 0.0
        self.inference_time_sec: float = 0.0
        self.actual_train_samples: int = 0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "NIDSSVM":
        n_samples = len(X)
        self.actual_train_samples = n_samples

        # Subsample if necessary for SVM computational feasibility
        if self.sample_limit and n_samples > self.sample_limit:
            logger.info(
                f"Subsampling training data for SVM from {n_samples:,} to {self.sample_limit:,} "
                f"using stratified sampling."
            )
            from sklearn.model_selection import StratifiedShuffleSplit

            sss = StratifiedShuffleSplit(
                n_splits=1,
                train_size=self.sample_limit,
                random_state=self.params["random_state"],
            )
            idx, _ = next(sss.split(X, y))
            X_train_sub = X[idx]
            y_train_sub = y[idx]
            self.actual_train_samples = len(X_train_sub)
        else:
            X_train_sub, y_train_sub = X, y

        logger.info(
            f"Training SVM on {self.actual_train_samples} samples with {X.shape[1]} features..."
        )
        start = time.perf_counter()
        self.model.fit(X_train_sub, y_train_sub)
        self.train_time_sec = round(time.perf_counter() - start, 4)
        logger.info(f"SVM training finished in {self.train_time_sec}s")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        start = time.perf_counter()
        preds = self.model.predict(X)
        self.inference_time_sec = round(time.perf_counter() - start, 5)
        return preds

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)
