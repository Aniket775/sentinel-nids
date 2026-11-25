from nids.data.audit import audit_dataframe
from nids.data.label_mapping import DEFAULT_MAPPING
from nids.data.loader import load_dataset_from_csv
from nids.utils.config import get_project_root
from nids.utils.logging import get_logger

logger = get_logger(__name__)


def main():
    root = get_project_root()
    raw_dir = root / "data" / "raw"
    files = list(raw_dir.glob("*.csv"))

    if not files:
        logger.error(f"No CSV files found in {raw_dir}")
        return

    logger.info(f"Found {len(files)} raw dataset files to audit.")
    audit_results = {}

    for f in sorted(files):
        logger.info(f"Auditing file: {f.name}")
        # Sample or full read for audit
        df = load_dataset_from_csv(f, nrows=None)
        rep = audit_dataframe(df)
        audit_results[f.name] = rep

    # Generate DATASET.md
    dataset_md_path = root / "data" / "DATASET.md"
    logger.info(f"Writing dataset documentation to: {dataset_md_path}")

    md_content = ["# Dataset Audit and Provenance Documentation\n"]
    md_content.append("## Overview\n")
    md_content.append(
        "- **Primary Benchmark Dataset**: CICIDS2017 (Canadian Institute for Cybersecurity)"
    )
    md_content.append("- **Official Source URL**: https://www.unb.ca/cic/datasets/ids-2017.html")
    md_content.append("- **Download Mirror**: HuggingFace (`c01dsnap/CIC-IDS2017`)")
    md_content.append("- **Version**: Final Cleaned CICFlowMeter CSVs (2017 Release)")
    md_content.append(
        "- **Licence**: Academic and Research Evaluation Permitted (UNB CIC Citation Terms)\n"
    )

    md_content.append("## Downloaded Dataset Files and Checksums\n")
    md_content.append(
        "| File Name | Total Rows | Columns | Duplicates | Missing Values | Infinite Values |"
    )
    md_content.append("|---|---|---|---|---|---|")

    total_all_rows = 0
    total_all_dups = 0
    total_all_missing = 0
    total_all_inf = 0
    aggregated_labels = {}

    for fname, rep in audit_results.items():
        total_all_rows += rep["total_rows"]
        total_all_dups += rep["duplicate_rows"]
        total_all_missing += rep["total_missing_values"]
        total_all_inf += rep["total_infinite_values"]

        md_content.append(
            f"| `{fname}` | {rep['total_rows']:,} | {rep['total_columns']} | "
            f"{rep['duplicate_rows']:,} ({rep['duplicate_percentage']}%) | "
            f"{rep['total_missing_values']:,} | {rep['total_infinite_values']:,} |"
        )

        for lk, lv in rep.get("label_distribution", {}).items():
            aggregated_labels[lk] = aggregated_labels.get(lk, 0) + lv

    md_content.append("\n## Aggregated Raw Label Distribution across Downloaded Files\n")
    md_content.append("| Raw Label | Raw Record Count | Target 4-Class Mapping | Project Status |")
    md_content.append("|---|---|---|---|")

    for rlab, count in sorted(aggregated_labels.items(), key=lambda x: x[1], reverse=True):
        clean_rlab = rlab.strip()
        mapped = DEFAULT_MAPPING.get(clean_rlab, None)
        status = f"Retained -> **{mapped}**" if mapped else "Excluded (Unsupported)"
        md_content.append(f"| `{clean_rlab}` | {count:,} | {mapped or 'None'} | {status} |")

    md_content.append("\n## Four-Class Label Taxonomy\n")
    md_content.append("Strict mapping enforced in `src/nids/data/label_mapping.py`:\n")
    md_content.append("| Target Class | Original CICIDS2017 Labels | Threat Type |")
    md_content.append("|---|---|---|")
    md_content.append("| **Normal** | `BENIGN` | Legitimate baseline network activity |")
    md_content.append("| **DDoS** | `DDoS` | Distributed volumetric flood exhaustion |")
    md_content.append("| **PortScan** | `PortScan` | Reconnaissance probing of network ports |")
    md_content.append(
        "| **BruteForce** | `FTP-Patator`, `SSH-Patator` | Automated credential enumeration |"
    )

    md_content.append("\n## Cleaning and Integrity Rules\n")
    md_content.append(
        "1. **Whitespace Normalization**: Leading and trailing whitespaces stripped from all 78+ column headers."
    )
    md_content.append(
        "2. **Identifier Pruning**: Flow ID, Source/Destination IPs, Source Ports, and Timestamps are removed prior to training to prevent synthetic overfitting and label leakage."
    )
    md_content.append(
        "3. **Infinity and NaN Imputation**: Numeric infinity (`inf`, `-inf`) is safely converted to NaN and imputed with median values fitted strictly on training folds."
    )
    md_content.append(
        "4. **Deduplication**: Exact duplicate flow records are audited and eliminated."
    )
    md_content.append(
        "5. **Zero-Variance Filtering**: Constant features across all records are systematically purged.\n"
    )

    with open(dataset_md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_content) + "\n")

    logger.info(f"Dataset audit complete. Generated {dataset_md_path}")


if __name__ == "__main__":
    main()
