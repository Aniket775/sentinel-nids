from pathlib import Path

import pandas as pd

from nids.data.loader import load_dataset_from_csv
from nids.utils.config import get_project_root
from nids.utils.logging import get_logger

logger = get_logger(__name__)


def generate_demo_dataset(target_total_rows: int = 10000) -> Path:
    """
    Extracts a balanced demonstration dataset directly from genuine CICIDS2017 files.
    Preserves realistic packet flow statistics across all 4 target classes:
    - Normal (~40%)
    - DDoS (~25%)
    - PortScan (~20%)
    - BruteForce (~15%)
    """
    root = get_project_root()
    raw_dir = root / "data" / "raw"
    demo_file = root / "data" / "demo" / "cicids2017_demo.csv"
    demo_file.parent.mkdir(parents=True, exist_ok=True)

    logger.info("Extracting genuine demo records from raw CICIDS2017 files...")
    dfs = []

    # File 1: Friday DDoS (contains DDoS & BENIGN)
    ddos_file = raw_dir / "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv"
    if ddos_file.exists():
        df_ddos = load_dataset_from_csv(ddos_file, nrows=100000)
        df_ddos.columns = df_ddos.columns.str.strip()
        ddos_records = df_ddos[df_ddos["Label"].astype(str).str.strip() == "DDoS"].sample(
            n=min(2500, int((df_ddos["Label"].astype(str).str.strip() == "DDoS").sum())),
            random_state=42,
        )
        benign_1 = df_ddos[df_ddos["Label"].astype(str).str.strip() == "BENIGN"].sample(
            n=min(2000, int((df_ddos["Label"].astype(str).str.strip() == "BENIGN").sum())),
            random_state=42,
        )
        dfs.extend([ddos_records, benign_1])

    # File 2: Friday PortScan (contains PortScan & BENIGN)
    ps_file = raw_dir / "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv"
    if ps_file.exists():
        df_ps = load_dataset_from_csv(ps_file, nrows=100000)
        df_ps.columns = df_ps.columns.str.strip()
        ps_records = df_ps[df_ps["Label"].astype(str).str.strip() == "PortScan"].sample(
            n=min(2000, int((df_ps["Label"].astype(str).str.strip() == "PortScan").sum())),
            random_state=42,
        )
        benign_2 = df_ps[df_ps["Label"].astype(str).str.strip() == "BENIGN"].sample(
            n=min(2000, int((df_ps["Label"].astype(str).str.strip() == "BENIGN").sum())),
            random_state=42,
        )
        dfs.extend([ps_records, benign_2])

    # File 3: Tuesday (contains FTP-Patator, SSH-Patator & BENIGN)
    tues_file = raw_dir / "Tuesday-WorkingHours.pcap_ISCX.csv"
    if tues_file.exists():
        df_tues = load_dataset_from_csv(tues_file, nrows=150000)
        df_tues.columns = df_tues.columns.str.strip()
        tues_labels = df_tues["Label"].astype(str).str.strip()
        bf_mask = tues_labels.isin(["FTP-Patator", "SSH-Patator"])
        if bf_mask.sum() > 0:
            bf_records = df_tues[bf_mask].sample(n=min(1500, int(bf_mask.sum())), random_state=42)
            dfs.append(bf_records)

    if not dfs:
        raise RuntimeError("No raw CICIDS2017 files available to extract demo dataset from.")

    combined = pd.concat(dfs, ignore_index=True)
    # Shuffle
    combined = combined.sample(frac=1.0, random_state=42).reset_index(drop=True)

    # Save to demo directory
    combined.to_csv(demo_file, index=False)
    logger.info(f"Generated demo dataset with {len(combined):,} genuine records at: {demo_file}")
    logger.info(f"Raw Label counts in demo file: {combined['Label'].value_counts().to_dict()}")
    return demo_file


if __name__ == "__main__":
    generate_demo_dataset()
