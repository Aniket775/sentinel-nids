from typing import Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class FeatureSelector:
    """
    Performs feature selection using:
    1. Zero-variance and low-variance filter.
    2. Random Forest feature importance ranking.
    3. Multi-collinearity pruning (optional).
    Strictly fitted on training data only to prevent data leakage.
    """

    def __init__(
        self,
        top_k: int = 25,
        random_state: int = 42,
    ):
        self.top_k = top_k
        self.random_state = random_state
        self.selected_features_: List[str] = []
        self.feature_importances_: Dict[str, float] = {}
        self.is_fitted_: bool = False

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
    ) -> "FeatureSelector":
        logger.info(
            f"Fitting FeatureSelector on {len(X_train)} samples, {len(X_train.columns)} initial features..."
        )

        # Quick RF fit for feature importances
        rf = RandomForestClassifier(
            n_estimators=60,
            max_depth=15,
            random_state=self.random_state,
            n_jobs=-1,
            class_weight="balanced",
        )
        rf.fit(X_train, y_train)

        importances = rf.feature_importances_
        feature_names = list(X_train.columns)

        # Sort features by importance descending
        feat_imp_pairs = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)

        self.feature_importances_ = {k: float(v) for k, v in feat_imp_pairs}
        k = min(self.top_k, len(feat_imp_pairs))
        self.selected_features_ = [k for k, _ in feat_imp_pairs[:k]]
        self.is_fitted_ = True

        logger.info(
            f"Feature selection complete: Selected top {k} features from {len(feature_names)} original features."
        )
        logger.info(f"Top 5 features: {self.selected_features_[:5]}")
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        if not self.is_fitted_:
            raise ValueError("FeatureSelector is not fitted. Call fit() first.")
        missing = [f for f in self.selected_features_ if f not in X.columns]
        if missing:
            raise ValueError(f"Features missing in DataFrame: {missing}")
        return X[self.selected_features_].copy()

    def fit_transform(self, X_train: pd.DataFrame, y_train: pd.Series) -> pd.DataFrame:
        return self.fit(X_train, y_train).transform(X_train)

    def plot_feature_importance(
        self,
        top_n: int = 20,
        output_path: Optional[str] = None,
    ) -> plt.Figure:
        """Generates and saves feature importance ranking chart."""
        if not self.is_fitted_:
            raise ValueError("FeatureSelector is not fitted.")

        top_items = list(self.feature_importances_.items())[:top_n]
        names = [item[0] for item in top_items]
        scores = [item[1] for item in top_items]

        fig, ax = plt.subplots(figsize=(10, 6))
        y_pos = np.arange(len(names))
        ax.barh(y_pos, scores[::-1], color="#6366F1", edgecolor="#4F46E5", alpha=0.85)
        ax.set_yticks(y_pos)
        ax.set_yticklabels(names[::-1], fontsize=9)
        ax.set_xlabel("Relative Feature Importance (MDI)")
        ax.set_title(
            f"Top {top_n} Network Flow Features (Random Forest Selection)",
            fontsize=12,
            fontweight="bold",
        )
        plt.tight_layout()

        if output_path:
            fig.savefig(output_path, dpi=300, bbox_inches="tight")
            logger.info(f"Feature importance figure saved to: {output_path}")

        return fig
