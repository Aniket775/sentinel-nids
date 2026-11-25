from typing import Any, Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from nids.utils.logging import get_logger

logger = get_logger(__name__)


def evaluate_predictions(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray] = None,
    classes: Optional[List[str]] = None,
    model_name: str = "Model",
) -> Dict[str, Any]:
    """
    Computes comprehensive evaluation metrics:
    - Overall Accuracy
    - Macro-F1, Weighted-F1
    - Macro Precision, Recall
    - Per-class Precision, Recall, F1
    - Confusion Matrix
    - ROC-AUC (one-vs-rest) if probabilities provided
    """
    if classes is None:
        classes = sorted(list(set(y_true) | set(y_pred)))

    acc = float(accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))
    macro_precision = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
    macro_recall = float(recall_score(y_true, y_pred, average="macro", zero_division=0))

    # Per-class scores
    per_class_p = precision_score(y_true, y_pred, average=None, labels=classes, zero_division=0)
    per_class_r = recall_score(y_true, y_pred, average=None, labels=classes, zero_division=0)
    per_class_f = f1_score(y_true, y_pred, average=None, labels=classes, zero_division=0)

    per_class_metrics = {}
    for i, cls_name in enumerate(classes):
        per_class_metrics[cls_name] = {
            "precision": round(float(per_class_p[i]), 4),
            "recall": round(float(per_class_r[i]), 4),
            "f1_score": round(float(per_class_f[i]), 4),
        }

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred, labels=classes).tolist()

    # ROC-AUC (OvR)
    roc_auc = None
    if y_prob is not None:
        try:
            # Check if multiclass
            if len(classes) > 2 and y_prob.shape[1] == len(classes):
                roc_auc = float(roc_auc_score(y_true, y_prob, multi_class="ovr", average="macro"))
        except Exception as e:
            logger.warning(f"Could not calculate ROC-AUC: {e}")

    results = {
        "model_name": model_name,
        "accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "precision": round(macro_precision, 4),
        "recall": round(macro_recall, 4),
        "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
        "per_class": per_class_metrics,
        "confusion_matrix": cm,
        "classes": classes,
    }

    logger.info(
        f"Evaluation [{model_name}] -> Accuracy: {acc:.4f}, Macro-F1: {macro_f1:.4f}, "
        f"Weighted-F1: {weighted_f1:.4f}, Macro-Recall: {macro_recall:.4f}"
    )
    return results


def plot_confusion_matrix(
    cm: List[List[int]],
    classes: List[str],
    model_name: str,
    output_path: Optional[str] = None,
) -> plt.Figure:
    """Plots and formats a normalized or raw confusion matrix."""
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_arr = np.array(cm)
    sns.heatmap(
        cm_arr,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=classes,
        yticklabels=classes,
        ax=ax,
        cbar=True,
    )
    ax.set_title(f"Confusion Matrix — {model_name}", fontsize=11, fontweight="bold")
    ax.set_ylabel("True Label")
    ax.set_xlabel("Predicted Label")
    plt.tight_layout()

    if output_path:
        fig.savefig(output_path, dpi=300, bbox_inches="tight")
        logger.info(f"Saved confusion matrix plot to: {output_path}")

    return fig
