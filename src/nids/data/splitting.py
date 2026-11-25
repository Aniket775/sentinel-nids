from typing import Any, Dict, Tuple

import pandas as pd
from sklearn.model_selection import train_test_split

from nids.utils.logging import get_logger

logger = get_logger(__name__)


def split_dataset(
    df: pd.DataFrame,
    label_col: str = "Label",
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_state: int = 42,
    stratify: bool = True,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Splits DataFrame into Train (70%), Validation (15%), and Test (15%) subsets.
    Uses stratified sampling to preserve target class proportions.
    Returns:
        train_df, val_df, test_df, split_summary_dict
    """
    total_ratio = train_ratio + val_ratio + test_ratio
    if not (0.99 <= total_ratio <= 1.01):
        raise ValueError(f"Ratios must sum to 1.0, got: {total_ratio}")

    strat_target = df[label_col] if stratify and label_col in df.columns else None

    # Step 1: Split out test set (15%)
    train_val_df, test_df = train_test_split(
        df,
        test_size=test_ratio,
        random_state=random_state,
        stratify=strat_target,
    )

    # Step 2: Split remaining (85%) into train (70%) and val (15%)
    # val_ratio relative to train_val is val_ratio / (train_ratio + val_ratio)
    val_rel_ratio = val_ratio / (train_ratio + val_ratio)
    strat_train_val = (
        train_val_df[label_col] if stratify and label_col in train_val_df.columns else None
    )

    train_df, val_df = train_test_split(
        train_val_df,
        test_size=val_rel_ratio,
        random_state=random_state,
        stratify=strat_train_val,
    )

    split_summary = {
        "total_records": len(df),
        "train_records": len(train_df),
        "train_pct": round(100.0 * len(train_df) / len(df), 2),
        "val_records": len(val_df),
        "val_pct": round(100.0 * len(val_df) / len(df), 2),
        "test_records": len(test_df),
        "test_pct": round(100.0 * len(test_df) / len(df), 2),
        "train_distribution": (
            train_df[label_col].value_counts().to_dict() if label_col in df.columns else {}
        ),
        "val_distribution": (
            val_df[label_col].value_counts().to_dict() if label_col in df.columns else {}
        ),
        "test_distribution": (
            test_df[label_col].value_counts().to_dict() if label_col in df.columns else {}
        ),
    }

    logger.info(
        f"Data split complete: Train={len(train_df):,} ({split_summary['train_pct']}%), "
        f"Val={len(val_df):,} ({split_summary['val_pct']}%), "
        f"Test={len(test_df):,} ({split_summary['test_pct']}%)"
    )
    return train_df, val_df, test_df, split_summary
