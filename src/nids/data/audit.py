from typing import Any, Dict

import numpy as np
import pandas as pd

from nids.utils.logging import get_logger

logger = get_logger(__name__)


def audit_dataframe(df: pd.DataFrame, label_col: str = "Label") -> Dict[str, Any]:
    """
    Performs a thorough dataset audit:
    - Shape, memory usage
    - Duplicate count
    - Missing / NaN values count
    - Infinite values count (pos/neg inf)
    - Constant / zero-variance columns
    - Data types
    - Target label distribution (if present)
    """
    logger.info("Auditing DataFrame...")
    total_rows = len(df)
    total_cols = len(df.columns)

    # 1. Duplicates
    dup_count = int(df.duplicated().sum())

    # 2. Missing and Infinite values
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    missing_per_col = df.isnull().sum()
    total_missing = int(missing_per_col.sum())

    inf_counts = {}
    total_inf = 0
    for col in numeric_cols:
        col_inf = int(np.isinf(df[col]).sum())
        if col_inf > 0:
            inf_counts[col] = col_inf
            total_inf += col_inf

    # 3. Constant columns (nunique <= 1)
    constant_cols = [col for col in df.columns if df[col].nunique(dropna=False) <= 1]

    # 4. Target distribution
    has_label = label_col in df.columns
    label_dist = {}
    if has_label:
        label_dist = df[label_col].value_counts(dropna=False).to_dict()
        label_dist = {str(k): int(v) for k, v in label_dist.items()}

    audit_report = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "duplicate_rows": dup_count,
        "duplicate_percentage": round(100.0 * dup_count / max(total_rows, 1), 2),
        "total_missing_values": total_missing,
        "columns_with_missing": {k: int(v) for k, v in missing_per_col.items() if v > 0},
        "total_infinite_values": total_inf,
        "columns_with_infinite": inf_counts,
        "constant_columns": constant_cols,
        "numeric_columns_count": len(numeric_cols),
        "has_label_column": has_label,
        "label_distribution": label_dist,
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
    }

    logger.info(
        f"Audit completed: {total_rows:,} rows, {total_cols} cols, "
        f"{dup_count:,} duplicates, {total_missing:,} missing, {total_inf:,} infs, "
        f"{len(constant_cols)} constant cols."
    )
    return audit_report
