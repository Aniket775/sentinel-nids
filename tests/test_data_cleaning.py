import numpy as np
import pandas as pd

from nids.data.cleaning import clean_dataframe


def test_clean_dataframe_drops_identifiers_and_strips_columns():
    df = pd.DataFrame(
        {
            " Flow ID ": ["1", "2", "3"],
            " Destination Port": [80, 443, 22],
            "Flow Duration ": [1000, 2000, 3000],
            "Label": ["BENIGN", "BENIGN", "DDoS"],
        }
    )
    cleaned, log = clean_dataframe(
        df,
        label_col="Label",
        drop_duplicates=True,
        drop_constant_cols=True,
        excluded_columns=["Flow ID"],
    )
    assert "Flow ID" not in cleaned.columns
    assert "Destination Port" in cleaned.columns
    assert "Flow Duration" in cleaned.columns
    assert len(cleaned) == 3


def test_clean_dataframe_handles_infinite_and_nan_values():
    df = pd.DataFrame(
        {
            "Flow Duration": [100.0, np.inf, 300.0, -np.inf, 500.0],
            "Total Fwd Packets": [1.0, 2.0, np.nan, 4.0, 5.0],
            "Label": ["BENIGN", "DDoS", "PortScan", "BENIGN", "Normal"],
        }
    )
    cleaned, log = clean_dataframe(df, label_col="Label")
    # Rows with inf, -inf, or nan must be safely removed
    assert len(cleaned) == 2
    assert not np.isinf(cleaned["Flow Duration"]).any()
    assert not cleaned["Total Fwd Packets"].isna().any()
    assert log["nan_or_inf_rows_removed"] == 3


def test_clean_dataframe_removes_duplicates():
    df = pd.DataFrame(
        {
            "Flow Duration": [100.0, 100.0, 200.0],
            "Total Fwd Packets": [1.0, 1.0, 2.0],
            "Label": ["BENIGN", "BENIGN", "DDoS"],
        }
    )
    cleaned, log = clean_dataframe(df, label_col="Label", drop_duplicates=True)
    assert len(cleaned) == 2
    assert log["duplicate_rows_removed"] == 1


def test_clean_dataframe_removes_constant_columns():
    df = pd.DataFrame(
        {
            "Feature A": [10.0, 20.0, 30.0],
            "Constant Feature": [0.0, 0.0, 0.0],
            "Label": ["BENIGN", "BENIGN", "DDoS"],
        }
    )
    cleaned, log = clean_dataframe(df, label_col="Label", drop_constant_cols=True)
    assert "Constant Feature" not in cleaned.columns
    assert "Feature A" in cleaned.columns
    assert "Constant Feature" in log["constant_columns_dropped"]
