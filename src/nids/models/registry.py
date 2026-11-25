import json
from pathlib import Path
from typing import Any, Dict, List

import joblib

from nids.utils.logging import get_logger

logger = get_logger(__name__)


class ModelRegistry:
    """Manages saving and loading of model artifact bundles."""

    @staticmethod
    def save_bundle(
        output_dir: Path | str,
        model_obj: Any,
        preprocessor: Any,
        feature_selector: Any,
        label_classes: List[str],
        selected_features: List[str],
        metadata: Dict[str, Any],
    ) -> Path:
        """Saves a complete self-contained inference bundle."""
        save_path = Path(output_dir)
        save_path.mkdir(parents=True, exist_ok=True)

        joblib.dump(model_obj, save_path / "model.joblib")
        joblib.dump(preprocessor, save_path / "preprocessor.joblib")
        joblib.dump(feature_selector, save_path / "feature_selector.joblib")

        bundle_meta = {
            "label_classes": label_classes,
            "selected_features": selected_features,
            "feature_count": len(selected_features),
            **metadata,
        }

        with open(save_path / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(bundle_meta, f, indent=2)

        logger.info(f"Saved complete model bundle to: {save_path}")
        return save_path

    @staticmethod
    def load_bundle(bundle_dir: Path | str) -> Dict[str, Any]:
        """Loads model bundle."""
        path = Path(bundle_dir)
        if not path.exists():
            raise FileNotFoundError(f"Model bundle path does not exist: {path}")

        meta_file = path / "metadata.json"
        if not meta_file.exists():
            raise FileNotFoundError(f"Metadata file missing in: {path}")

        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

        model = joblib.load(path / "model.joblib")
        preprocessor = joblib.load(path / "preprocessor.joblib")
        feature_selector = joblib.load(path / "feature_selector.joblib")

        logger.info(
            f"Loaded model bundle from: {path} (Features: {len(meta['selected_features'])})"
        )
        return {
            "model": model,
            "preprocessor": preprocessor,
            "feature_selector": feature_selector,
            "metadata": meta,
            "label_classes": meta["label_classes"],
            "selected_features": meta["selected_features"],
        }
