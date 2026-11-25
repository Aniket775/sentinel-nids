from pathlib import Path
from typing import List, Optional, Union

import pandas as pd

from nids.utils.logging import get_logger

logger = get_logger(__name__)


def load_dataset_from_csv(
    file_path: Union[str, Path],
    nrows: Optional[int] = None,
    usecols: Optional[List[str]] = None,
    encoding: str = "utf-8",
) -> pd.DataFrame:
    """Loads a single CSV dataset file safely, stripping whitespace from column names."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found at: {path}")

    logger.info(f"Loading dataset from: {path} (nrows={nrows})")
    try:
        df = pd.read_csv(
            path,
            nrows=nrows,
            usecols=usecols,
            encoding=encoding,
            low_memory=False,
            on_bad_lines="skip",
        )
    except UnicodeDecodeError:
        logger.warning(f"UTF-8 decode failed for {path}, falling back to latin1/cp1252")
        df = pd.read_csv(
            path,
            nrows=nrows,
            usecols=usecols,
            encoding="latin1",
            low_memory=False,
            on_bad_lines="skip",
        )

    # Clean header whitespace immediately
    df.columns = df.columns.str.strip()
    logger.info(
        f"Successfully loaded {len(df):,} rows and {len(df.columns)} columns from {path.name}"
    )
    return df


def load_multiple_csvs(
    file_paths: List[Union[str, Path]],
    nrows_per_file: Optional[int] = None,
) -> pd.DataFrame:
    """Loads and concatenates multiple CSV files safely."""
    dfs = []
    for fp in file_paths:
        df = load_dataset_from_csv(fp, nrows=nrows_per_file)
        dfs.append(df)
    if not dfs:
        raise ValueError("No CSV files provided to load_multiple_csvs")
    combined = pd.concat(dfs, ignore_index=True)
    logger.info(
        f"Combined {len(dfs)} files: total {len(combined):,} rows, {len(combined.columns)} columns"
    )
    return combined
