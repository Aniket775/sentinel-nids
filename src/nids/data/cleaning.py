from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from nids.utils.logging import get_logger

logger = get_logger(__name__)


def clean_dataframe(
    df: pd.DataFrame,
    label_col: str = "Label",
    drop_duplicates: bool = True,
    drop_constant_cols: bool = True,
    excluded_columns: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Cleans raw network flow dataframe:
    1. Strips leading/trailing whitespace from column names.
    2. Drops non-feature identifier columns (IPs, Timestamps, IDs).
    3. Replaces +/- infinity with NaN.
    4. Drops rows with missing / infinite values in critical numeric columns.
    5. Removes duplicate rows.
    6. Identifies and removes constant (zero variance) features.
    Returns cleaned dataframe and a cleaning audit log dict.
    """
    initial_rows = len(df)
    initial_cols = len(df.columns)
    cleaning_log: Dict[str, Any] = {
        "initial_rows": initial_rows,
        "initial_cols": initial_cols,
    }

    cleaned = df.copy()

    # 1. Strip column names
    cleaned.columns = cleaned.columns.str.strip()

    # 2. Exclude identifiers if requested
    if excluded_columns:
        to_drop = [c for c in excluded_columns if c in cleaned.columns]
        if to_drop:
            cleaned = cleaned.drop(columns=to_drop)
            cleaning_log["dropped_identifier_columns"] = to_drop
            logger.info(f"Dropped {len(to_drop)} identifier columns: {to_drop}")

    # 3. Handle infinities in numeric columns
    numeric_cols = cleaned.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        # Try converting object columns that look numeric
        for col in cleaned.columns:
            if col != label_col:
                cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")
        numeric_cols = cleaned.select_dtypes(include=[np.number]).columns.tolist()

    cleaned[numeric_cols] = cleaned[numeric_cols].replace([np.inf, -np.inf], np.nan)

    # 4. Drop rows with NaNs
    nan_rows_before = cleaned.isnull().any(axis=1).sum()
    cleaned = cleaned.dropna()
    rows_after_nan = len(cleaned)
    cleaning_log["nan_or_inf_rows_removed"] = int(initial_rows - rows_after_nan)
    logger.info(f"Removed {nan_rows_before:,} rows containing NaN or Infinite values.")

    # 5. Drop duplicate rows
    if drop_duplicates:
        dups = cleaned.duplicated().sum()
        cleaned = cleaned.drop_duplicates()
        cleaning_log["duplicate_rows_removed"] = int(dups)
        logger.info(f"Removed {dups:,} duplicate rows.")

    # 6. Drop constant columns
    if drop_constant_cols:
        feature_cols = [c for c in cleaned.columns if c != label_col]
        constant_cols = [c for c in feature_cols if cleaned[c].nunique(dropna=False) <= 1]
        if constant_cols:
            cleaned = cleaned.drop(columns=constant_cols)
            cleaning_log["constant_columns_dropped"] = constant_cols
            logger.info(f"Dropped {len(constant_cols)} constant columns: {constant_cols}")

    cleaning_log["final_rows"] = len(cleaned)
    cleaning_log["final_cols"] = len(cleaned.columns)
    cleaning_log["total_rows_removed"] = initial_rows - len(cleaned)

    logger.info(
        f"Cleaning complete: {initial_rows:,} -> {len(cleaned):,} rows "
        f"({cleaning_log['total_rows_removed']:,} removed), "
        f"{initial_cols} -> {len(cleaned.columns)} columns."
    )
    return cleaned, cleaning_log
