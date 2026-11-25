import argparse

import pandas as pd

from nids.data.loader import load_multiple_csvs
from nids.models.train import train_and_evaluate_pipeline
from nids.utils.config import get_project_root, load_config
from nids.utils.logging import get_logger

logger = get_logger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Train NIDS Models (RF, SVM, XGBoost)")
    parser.add_argument("--config", type=str, default=None, help="Path to config file")
    parser.add_argument(
        "--nrows-per-file", type=int, default=80000, help="Max rows per raw CSV file to load"
    )
    args = parser.parse_args()

    root = get_project_root()
    config = load_config(args.config)
    raw_dir = root / config["paths"]["raw_data_dir"]

    files = [
        raw_dir / "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv",
        raw_dir / "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
        raw_dir / "Tuesday-WorkingHours.pcap_ISCX.csv",
    ]

    existing_files = [f for f in files if f.exists()]
    if not existing_files:
        raise FileNotFoundError(f"None of the required raw CSV files found in {raw_dir}")

    logger.info(
        f"Loading raw datasets from {len(existing_files)} files (nrows={args.nrows_per_file} each)..."
    )
    df_raw = load_multiple_csvs(existing_files, nrows_per_file=args.nrows_per_file)

    logger.info("Executing end-to-end model training and evaluation...")
    summary = train_and_evaluate_pipeline(df_raw, config=config)

    print("\n==========================================")
    print("      NIDS MODEL TRAINING COMPLETE       ")
    print("==========================================")
    print(f"Total Records Processed: {len(df_raw):,}")
    print(f"Selected Best Model: {summary['best_model']}")
    print("\n--- Model Comparison on Test Set ---")
    comp_df = pd.DataFrame(summary["comparison_table"])
    print(comp_df.to_string(index=False))


if __name__ == "__main__":
    main()
