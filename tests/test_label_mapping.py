import pandas as pd

from nids.data.label_mapping import map_labels


def test_map_labels_four_classes():
    df = pd.DataFrame(
        {
            "Feature1": [1, 2, 3, 4, 5],
            "Label": ["BENIGN", "DDoS", "PortScan", "FTP-Patator", "SSH-Patator"],
        }
    )
    mapped_df, report = map_labels(df, label_col="Label")
    expected = ["Normal", "DDoS", "PortScan", "BruteForce", "BruteForce"]
    assert mapped_df["Label"].tolist() == expected
    assert report["excluded_rows_count"] == 0
    assert len(report["missing_target_classes"]) == 0


def test_map_labels_handles_whitespace_and_case():
    df = pd.DataFrame(
        {
            "Feature1": [1, 2, 3],
            "Label": [" benign  ", "ddos", "  PortScan "],
        }
    )
    mapped_df, report = map_labels(df, label_col="Label")
    assert mapped_df["Label"].tolist() == ["Normal", "DDoS", "PortScan"]


def test_map_labels_excludes_unsupported_attacks():
    df = pd.DataFrame(
        {
            "Feature1": [1, 2, 3, 4],
            "Label": ["BENIGN", "Web Attack  Brute Force", "Heartbleed", "DDoS"],
        }
    )
    mapped_df, report = map_labels(df, label_col="Label")
    assert len(mapped_df) == 2
    assert set(mapped_df["Label"].unique()) == {"Normal", "DDoS"}
    assert report["excluded_rows_count"] == 2
    assert "Heartbleed" in report["excluded_labels_breakdown"]
