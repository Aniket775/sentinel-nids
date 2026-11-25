# Dataset Audit and Provenance Documentation

## Overview

- **Primary Benchmark Dataset**: CICIDS2017 (Canadian Institute for Cybersecurity)
- **Official Source URL**: https://www.unb.ca/cic/datasets/ids-2017.html
- **Download Mirror**: HuggingFace (`c01dsnap/CIC-IDS2017`)
- **Version**: Final Cleaned CICFlowMeter CSVs (2017 Release)
- **Licence**: Academic and Research Evaluation Permitted (UNB CIC Citation Terms)

## Downloaded Dataset Files and Checksums

| File Name | Total Rows | Columns | Duplicates | Missing Values | Infinite Values |
|---|---|---|---|---|---|
| `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv` | 225,745 | 79 | 2,633 (1.17%) | 4 | 64 |
| `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv` | 286,467 | 79 | 72,353 (25.26%) | 15 | 727 |
| `Tuesday-WorkingHours.pcap_ISCX.csv` | 445,909 | 79 | 24,065 (5.4%) | 201 | 327 |

## Aggregated Raw Label Distribution across Downloaded Files

| Raw Label | Raw Record Count | Target 4-Class Mapping | Project Status |
|---|---|---|---|
| `BENIGN` | 657,329 | Normal | Retained -> **Normal** |
| `PortScan` | 158,930 | PortScan | Retained -> **PortScan** |
| `DDoS` | 128,027 | DDoS | Retained -> **DDoS** |
| `FTP-Patator` | 7,938 | BruteForce | Retained -> **BruteForce** |
| `SSH-Patator` | 5,897 | BruteForce | Retained -> **BruteForce** |

## Four-Class Label Taxonomy

Strict mapping enforced in `src/nids/data/label_mapping.py`:

| Target Class | Original CICIDS2017 Labels | Threat Type |
|---|---|---|
| **Normal** | `BENIGN` | Legitimate baseline network activity |
| **DDoS** | `DDoS` | Distributed volumetric flood exhaustion |
| **PortScan** | `PortScan` | Reconnaissance probing of network ports |
| **BruteForce** | `FTP-Patator`, `SSH-Patator` | Automated credential enumeration |

## Cleaning and Integrity Rules

1. **Whitespace Normalization**: Leading and trailing whitespaces stripped from all 78+ column headers.
2. **Identifier Pruning**: Flow ID, Source/Destination IPs, Source Ports, and Timestamps are removed prior to training to prevent synthetic overfitting and label leakage.
3. **Infinity and NaN Imputation**: Numeric infinity (`inf`, `-inf`) is safely converted to NaN and imputed with median values fitted strictly on training folds.
4. **Deduplication**: Exact duplicate flow records are audited and eliminated.
5. **Zero-Variance Filtering**: Constant features across all records are systematically purged.

