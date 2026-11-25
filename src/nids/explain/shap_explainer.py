from typing import Any, Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import shap

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class NIDSShapExplainer:
    """
    SHAP-based Explainable AI module for Network Intrusion Detection.
    - Uses TreeExplainer for Random Forest and XGBoost.
    - Generates global feature importance attribution.
    - Generates individual prediction attributions with actual feature values.
    - Handles multiclass dimensions robustly.
    """

    def __init__(
        self,
        model: Any,
        feature_names: List[str],
        class_names: List[str],
        max_background_samples: int = 100,
    ):
        self.model = model
        self.feature_names = feature_names
        self.class_names = class_names
        self.max_background_samples = max_background_samples
        self.explainer: Optional[shap.TreeExplainer] = None

    def fit_explainer(self, background_data: np.ndarray) -> "NIDSShapExplainer":
        """Initializes TreeExplainer with background sample."""
        logger.info("Initializing SHAP TreeExplainer...")
        if len(background_data) > self.max_background_samples:
            indices = np.random.choice(
                len(background_data), self.max_background_samples, replace=False
            )
            bg = background_data[indices]
        else:
            bg = background_data

        try:
            self.explainer = shap.TreeExplainer(self.model, data=bg)
        except Exception:
            logger.warning(
                "TreeExplainer with data background failed, falling back to model-only TreeExplainer."
            )
            self.explainer = shap.TreeExplainer(self.model)

        logger.info("SHAP TreeExplainer successfully initialized.")
        return self

    def explain_instance(
        self,
        instance_features: np.ndarray,
        predicted_class_idx: int,
        top_n: int = 5,
    ) -> Dict[str, Any]:
        """
        Computes SHAP feature attribution for a single prediction instance.
        Returns:
            - predicted_class
            - top contributing features (names, values, shap_values)
            - attribution disclaimer
        """
        if self.explainer is None:
            raise ValueError("SHAP explainer is not initialized. Call fit_explainer() first.")

        if instance_features.ndim == 1:
            X_inst = instance_features.reshape(1, -1)
        else:
            X_inst = instance_features

        raw_shap = self.explainer.shap_values(X_inst)

        # Handle multiclass SHAP structures:
        # Format A: list of length [n_classes], each (1, n_features)
        # Format B: 3D ndarray of shape (1, n_features, n_classes)
        # Format C: 2D ndarray (binary or single class)
        if isinstance(raw_shap, list):
            class_shap = raw_shap[predicted_class_idx][0]
        elif isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 3:
            class_shap = raw_shap[0, :, predicted_class_idx]
        elif isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 2:
            class_shap = raw_shap[0]
        else:
            class_shap = np.array(raw_shap).flatten()

        raw_values = X_inst[0]

        # Sort features by absolute SHAP contribution descending
        sorted_indices = np.argsort(np.abs(class_shap))[::-1][:top_n]

        top_features = []
        for idx in sorted_indices:
            top_features.append(
                {
                    "feature": self.feature_names[idx],
                    "actual_value": round(float(raw_values[idx]), 4),
                    "shap_value": round(float(class_shap[idx]), 4),
                    "impact": "Increases Attack Likelihood"
                    if class_shap[idx] > 0
                    else "Decreases Attack Likelihood",
                }
            )

        class_name = (
            self.class_names[predicted_class_idx]
            if predicted_class_idx < len(self.class_names)
            else str(predicted_class_idx)
        )

        return {
            "predicted_class": class_name,
            "predicted_class_idx": int(predicted_class_idx),
            "top_features": top_features,
            "disclaimer": (
                "NOTE: SHAP values represent statistical feature contributions toward the model's "
                "mathematical prediction. They do NOT establish causal network proof."
            ),
        }

    def generate_global_importance(
        self,
        X_sample: np.ndarray,
        output_plot_path: Optional[str] = None,
        top_n: int = 15,
    ) -> Dict[str, float]:
        """Computes mean absolute SHAP values across a representative sample."""
        if self.explainer is None:
            raise ValueError("Explainer not fitted.")

        logger.info(f"Computing global SHAP values on {len(X_sample)} sample records...")
        raw_shap = self.explainer.shap_values(X_sample)

        # Compute mean |SHAP| across all classes and samples
        if isinstance(raw_shap, list):
            # list of (n_samples, n_features)
            abs_shap = np.mean(
                [np.abs(cls_s) for cls_s in raw_shap], axis=0
            )  # (n_samples, n_features)
            mean_abs = np.mean(abs_shap, axis=0)
        elif isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 3:
            # (n_samples, n_features, n_classes)
            mean_abs = np.mean(np.mean(np.abs(raw_shap), axis=2), axis=0)
        else:
            mean_abs = np.mean(np.abs(raw_shap), axis=0)

        importance_dict = {
            self.feature_names[i]: float(mean_abs[i]) for i in range(len(self.feature_names))
        }
        sorted_imp = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))

        if output_plot_path:
            top_items = list(sorted_imp.items())[:top_n]
            names = [k for k, _ in top_items]
            vals = [v for _, v in top_items]

            fig, ax = plt.subplots(figsize=(10, 6))
            y_pos = np.arange(len(names))
            ax.barh(y_pos, vals[::-1], color="#22D3EE", edgecolor="#0891B2", alpha=0.9)
            ax.set_yticks(y_pos)
            ax.set_yticklabels(names[::-1], fontsize=9)
            ax.set_xlabel("Mean |SHAP Value| (Average Impact on Model Output)")
            ax.set_title(
                f"Global Feature Attributions (SHAP TreeExplainer — Top {top_n})",
                fontsize=11,
                fontweight="bold",
            )
            plt.tight_layout()
            fig.savefig(output_plot_path, dpi=300, bbox_inches="tight")
            logger.info(f"Global SHAP importance plot saved to: {output_plot_path}")

        return sorted_imp
