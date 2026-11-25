from typing import Any, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class FeaturePreprocessor(BaseEstimator, TransformerMixin):
    """
    Production-grade tabular feature preprocessor for network flow traffic.
    - Preserves exact feature names and column ordering.
    - Handles numeric imputation of missing / NaN values.
    - Applies feature scaling (optional, essential for SVM).
    - Validates inference schema against fitted schema.
    """

    def __init__(
        self,
        scale_features: bool = False,
        impute_strategy: str = "median",
    ):
        self.scale_features = scale_features
        self.impute_strategy = impute_strategy
        self.imputer = SimpleImputer(strategy=impute_strategy)
        self.scaler = StandardScaler() if scale_features else None
        self.feature_names_in_: List[str] = []
        self.n_features_in_: int = 0
        self.is_fitted_: bool = False

    def fit(self, X: pd.DataFrame, y: Optional[Any] = None) -> "FeaturePreprocessor":
        if not isinstance(X, pd.DataFrame):
            raise TypeError("FeaturePreprocessor expects X to be a pandas DataFrame")

        self.feature_names_in_ = list(X.columns)
        self.n_features_in_ = len(self.feature_names_in_)

        # Fit imputer
        self.imputer.fit(X.values)
        X_imputed = self.imputer.transform(X.values)

        # Fit scaler if enabled
        if self.scaler is not None:
            self.scaler.fit(X_imputed)

        self.is_fitted_ = True
        logger.info(
            f"Fitted FeaturePreprocessor on {self.n_features_in_} features. "
            f"Scaling={self.scale_features}, Impute={self.impute_strategy}"
        )
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted_:
            raise ValueError("FeaturePreprocessor is not fitted yet. Call fit() first.")

        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X, columns=self.feature_names_in_)

        # Validate schema & reorder columns strictly
        missing_cols = [c for c in self.feature_names_in_ if c not in X.columns]
        if missing_cols:
            raise ValueError(
                f"Input data is missing {len(missing_cols)} required features: {missing_cols[:10]}..."
            )

        # Strictly align column ordering
        X_aligned = X[self.feature_names_in_].copy()

        # Handle infinite values by casting to NaN before imputer
        vals = X_aligned.values.astype(float)
        vals[np.isinf(vals)] = np.nan

        # Impute
        vals_imputed = self.imputer.transform(vals)

        # Scale if enabled
        if self.scaler is not None:
            return self.scaler.transform(vals_imputed)

        return vals_imputed

    def fit_transform(self, X: pd.DataFrame, y: Optional[Any] = None) -> np.ndarray:
        return self.fit(X, y).transform(X)

    def save(self, file_path: str) -> None:
        """Saves fitted preprocessor to disk using joblib."""
        joblib.dump(self, file_path)
        logger.info(f"Saved FeaturePreprocessor to: {file_path}")

    @classmethod
    def load(cls, file_path: str) -> "FeaturePreprocessor":
        """Loads fitted preprocessor from disk."""
        obj = joblib.load(file_path)
        if not isinstance(obj, cls):
            raise TypeError(f"Loaded object is not {cls.__name__}, got {type(obj)}")
        logger.info(f"Loaded FeaturePreprocessor from: {file_path}")
        return obj
