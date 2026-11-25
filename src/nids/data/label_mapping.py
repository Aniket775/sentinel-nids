from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from nids.utils.logging import get_logger

logger = get_logger(__name__)

# Standard 4-class mapping for CICIDS2017
DEFAULT_MAPPING = {
    "BENIGN": "Normal",
    "DDoS": "DDoS",
    "PortScan": "PortScan",
    "FTP-Patator": "BruteForce",
    "SSH-Patator": "BruteForce",
}

TARGET_CLASSES = ["Normal", "DDoS", "PortScan", "BruteForce"]


def map_labels(
    df: pd.DataFrame,
    label_col: str = "Label",
    mapping: Optional[Dict[str, str]] = None,
    target_classes: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Applies strict 4-class label mapping to dataframe:
    - Normal (from BENIGN)
    - DDoS (from DDoS)
    - PortScan (from PortScan)
    - BruteForce (from FTP-Patator, SSH-Patator)

    Any other attack types are documented as excluded and filtered out.
    Handles leading/trailing whitespace and case insensitivity.
    """
    if label_col not in df.columns:
        raise ValueError(f"Label column '{label_col}' not found in DataFrame.")

    if mapping is None:
        mapping = DEFAULT_MAPPING
    if target_classes is None:
        target_classes = TARGET_CLASSES

    # Normalize lookup dictionary: uppercase keys stripped
    norm_mapping = {k.strip().upper(): v for k, v in mapping.items()}

    # Clean label series
    raw_labels = df[label_col].astype(str).str.strip()
    raw_counts = raw_labels.value_counts().to_dict()

    # Map labels
    mapped_series = raw_labels.apply(lambda x: norm_mapping.get(x.upper(), None))

    df_out = df.copy()
    df_out[label_col] = mapped_series

    # Identify excluded rows
    excluded_mask = df_out[label_col].isna()
    excluded_rows = int(excluded_mask.sum())
    excluded_label_counts = raw_labels[excluded_mask].value_counts().to_dict()

    # Filter strictly to target 4 classes
    df_filtered = df_out[~excluded_mask].copy()

    final_distribution = df_filtered[label_col].value_counts().to_dict()

    # Verify all 4 target classes are present
    missing_classes = [c for c in target_classes if c not in final_distribution]

    mapping_report = {
        "original_label_counts": {str(k): int(v) for k, v in raw_counts.items()},
        "excluded_rows_count": excluded_rows,
        "excluded_labels_breakdown": {str(k): int(v) for k, v in excluded_label_counts.items()},
        "final_distribution": {str(k): int(v) for k, v in final_distribution.items()},
        "target_classes": target_classes,
        "missing_target_classes": missing_classes,
    }

    if missing_classes:
        logger.warning(f"Dataset does not contain all 4 target classes! Missing: {missing_classes}")
    else:
        logger.info(f"4-Class mapping successful: {final_distribution}")

    return df_filtered, mapping_report
