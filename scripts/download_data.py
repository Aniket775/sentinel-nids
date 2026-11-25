import hashlib
import urllib.request
from pathlib import Path

from tqdm import tqdm

from nids.utils.logging import get_logger

logger = get_logger(__name__)

# Primary CICIDS2017 files containing the 4 required classes:
# 1. Friday DDoS: DDoS + BENIGN
# 2. Friday PortScan: PortScan + BENIGN
# 3. Tuesday: FTP-Patator + SSH-Patator (BruteForce) + BENIGN
REMOTE_FILES = {
    "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv": "https://huggingface.co/datasets/c01dsnap/CIC-IDS2017/resolve/main/Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv",
    "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv": "https://huggingface.co/datasets/c01dsnap/CIC-IDS2017/resolve/main/Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
    "Tuesday-WorkingHours.pcap_ISCX.csv": "https://huggingface.co/datasets/c01dsnap/CIC-IDS2017/resolve/main/Tuesday-WorkingHours.pcap_ISCX.csv",
}


def compute_sha256(file_path: Path) -> str:
    """Computes SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192 * 1024):
            h.update(chunk)
    return h.hexdigest()


class DownloadProgressBar(tqdm):
    def update_to(self, b=1, bsize=1, tsize=None):
        if tsize is not None:
            self.total = tsize
        self.update(b * bsize - self.n)


def download_file(url: str, output_path: Path) -> None:
    """Downloads a remote file with progress reporting."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and output_path.stat().st_size > 1000000:
        logger.info(
            f"File already exists: {output_path} ({output_path.stat().st_size / (1024 * 1024):.1f} MB), skipping download."
        )
        return

    logger.info(f"Downloading {url} to {output_path}...")
    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", "Mozilla/5.0")]
    urllib.request.install_opener(opener)

    with DownloadProgressBar(unit="B", unit_scale=True, miniters=1, desc=output_path.name) as t:
        urllib.request.urlretrieve(url, filename=output_path, reporthook=t.update_to)
    logger.info(f"Successfully downloaded {output_path.name}")


def main():
    root = Path(__file__).resolve().parent.parent
    raw_dir = root / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    checksums = {}
    for filename, url in REMOTE_FILES.items():
        dest = raw_dir / filename
        download_file(url, dest)
        logger.info(f"Computing SHA-256 for {dest.name}...")
        sha = compute_sha256(dest)
        checksums[filename] = {
            "size_bytes": dest.stat().st_size,
            "sha256": sha,
        }
        logger.info(f"{dest.name}: {sha}")

    # Output checksum summary
    print("\n=== DATASET DOWNLOAD COMPLETE ===")
    for fn, info in checksums.items():
        print(f"File: {fn}")
        print(f"  Size: {info['size_bytes'] / (1024 * 1024):.2f} MB")
        print(f"  SHA-256: {info['sha256']}")


if __name__ == "__main__":
    main()
