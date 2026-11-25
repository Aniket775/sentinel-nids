import numpy as np
import pandas as pd
import pytest

from nids.features.preprocessing import FeaturePreprocessor
from nids.features.selection import FeatureSelector


def test_feature_preprocessor_preserves_schema_and_order():
    df_train = pd.DataFrame(
        {
            "feat_b": [10.0, 20.0, 30.0],
            "feat_a": [1.0, 2.0, 3.0],
        }
    )
    preprocessor = FeaturePreprocessor(scale_features=False)
    preprocessor.fit(df_train)
    assert preprocessor.feature_names_in_ == ["feat_b", "feat_a"]

    # Invert order on test input
    df_test = pd.DataFrame(
        {
            "feat_a": [5.0, 6.0],
            "feat_b": [50.0, 60.0],
        }
    )
    X_trans = preprocessor.transform(df_test)
    # Output array must be ordered according to fitted feature_names_in_: feat_b then feat_a
    assert X_trans[0, 0] == 50.0
    assert X_trans[0, 1] == 5.0


def test_feature_preprocessor_missing_features_raises_error():
    df_train = pd.DataFrame(
        {
            "feat_a": [1.0, 2.0],
            "feat_b": [10.0, 20.0],
        }
    )
    preprocessor = FeaturePreprocessor()
    preprocessor.fit(df_train)

    df_invalid = pd.DataFrame({"feat_a": [5.0, 6.0]})
    with pytest.raises(ValueError, match="missing.*required features"):
        preprocessor.transform(df_invalid)


def test_feature_preprocessor_imputes_nan_and_inf():
    df_train = pd.DataFrame(
        {
            "feat_a": [10.0, 20.0, 30.0],
        }
    )
    preprocessor = FeaturePreprocessor(impute_strategy="median")
    preprocessor.fit(df_train)

    df_test = pd.DataFrame(
        {
            "feat_a": [np.nan, np.inf, 10.0],
        }
    )
    X_trans = preprocessor.transform(df_test)
    # NaN and inf should be imputed with train median (20.0)
    assert X_trans[0, 0] == 20.0
    assert X_trans[1, 0] == 20.0
    assert X_trans[2, 0] == 10.0


def test_feature_selector_selects_top_k():
    np.random.seed(42)
    X = pd.DataFrame(
        {
            "f_informative": np.concatenate(
                [np.random.normal(0, 1, 50), np.random.normal(10, 1, 50)]
            ),
            "f_noise1": np.random.normal(0, 1, 100),
            "f_noise2": np.random.normal(0, 1, 100),
        }
    )
    y = np.array(["Normal"] * 50 + ["DDoS"] * 50)

    selector = FeatureSelector(top_k=1, random_state=42)
    selector.fit(X, y)
    assert len(selector.selected_features_) == 1
    assert selector.selected_features_[0] == "f_informative"
