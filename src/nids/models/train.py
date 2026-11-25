import json
import time
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from nids.data.cleaning import clean_dataframe
from nids.data.label_mapping import TARGET_CLASSES, map_labels
from nids.data.splitting import split_dataset
from nids.explain.shap_explainer import NIDSShapExplainer
from nids.features.preprocessing import FeaturePreprocessor
from nids.features.selection import FeatureSelector
from nids.models.evaluate import evaluate_predictions, plot_confusion_matrix
from nids.models.random_forest import NIDSRandomForest
from nids.models.registry import ModelRegistry
from nids.models.svm import NIDSSVM
from nids.models.xgboost_model import NIDSXGBoost
from nids.utils.config import get_project_root, load_config
from nids.utils.logging import get_logger

logger = get_logger(__name__)


def train_and_evaluate_pipeline(
    df_raw: pd.DataFrame,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Executes the entire end-to-end training and evaluation pipeline:
    1. Clean raw DataFrame.
    2. Map to 4 target classes: Normal, DDoS, PortScan, BruteForce.
    3. Stratified split: 70% Train, 15% Val, 15% Test.
    4. Feature selection using Random Forest importance on Train only.
    5. Feature preprocessing fitted on Train only.
    6. Train Random Forest, SVM (stratified sample), and XGBoost.
    7. Evaluate all 3 models on Val and Test sets with detailed metrics.
    8. Generate confusion matrices and comparison reports.
    9. Run SHAP explainability on selected tree model.
    10. Persist model bundles and artifacts.
    """
    if config is None:
        config = load_config()

    root = get_project_root()
    reports_dir = root / config["paths"]["reports_dir"]
    cm_dir = root / config["paths"]["confusion_matrix_dir"]
    fig_dir = root / config["paths"]["figures_dir"]
    exp_dir = root / config["paths"]["explanations_dir"]
    registry_dir = root / config["paths"]["registry_dir"]
    selected_dir = root / config["paths"]["selected_model_dir"]

    for d in [reports_dir, cm_dir, fig_dir, exp_dir, registry_dir, selected_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # 1. Cleaning
    logger.info("--- Step 1: Cleaning Raw Dataset ---")
    excluded_cols = config["features"].get("excluded_columns", [])
    df_cleaned, clean_log = clean_dataframe(
        df_raw,
        label_col="Label",
        drop_duplicates=True,
        drop_constant_cols=True,
        excluded_columns=excluded_cols,
    )

    # 2. Label Mapping
    logger.info("--- Step 2: Mapping 4-Class Labels ---")
    df_mapped, map_report = map_labels(
        df_cleaned,
        label_col="Label",
        mapping=config["data"].get("raw_label_mapping"),
        target_classes=config["data"].get("target_classes", TARGET_CLASSES),
    )

    # 3. Train/Val/Test Split
    logger.info("--- Step 3: Stratified Train/Val/Test Split ---")
    train_df, val_df, test_df, split_summary = split_dataset(
        df_mapped,
        label_col="Label",
        train_ratio=config["data"]["split"]["train_ratio"],
        val_ratio=config["data"]["split"]["val_ratio"],
        test_ratio=config["data"]["split"]["test_ratio"],
        random_state=config["data"]["split"]["random_state"],
    )

    # Separate X and y
    target_col = "Label"
    X_train_raw = train_df.drop(columns=[target_col])
    y_train = train_df[target_col].values
    X_val_raw = val_df.drop(columns=[target_col])
    y_val = val_df[target_col].values
    X_test_raw = test_df.drop(columns=[target_col])
    y_test = test_df[target_col].values

    # 4. Feature Selection
    logger.info("--- Step 4: Feature Selection (Train Only) ---")
    top_k = config["features"].get("top_k_features", 25)
    selector = FeatureSelector(top_k=top_k, random_state=config["project"]["random_seed"])
    selector.fit(X_train_raw, y_train)
    selected_features = selector.selected_features_

    # Plot & save feature importances
    selector.plot_feature_importance(
        top_n=20, output_path=str(fig_dir / "feature_importance_ranking.png")
    )

    X_train_sel = selector.transform(X_train_raw)
    X_val_sel = selector.transform(X_val_raw)
    X_test_sel = selector.transform(X_test_raw)

    # 5. Preprocessing Pipelines
    logger.info("--- Step 5: Preprocessing Pipelines ---")
    # Tree preprocessor (no scaling)
    tree_prep = FeaturePreprocessor(scale_features=False, impute_strategy="median")
    tree_prep.fit(X_train_sel)
    X_train_tree = tree_prep.transform(X_train_sel)
    X_val_tree = tree_prep.transform(X_val_sel)
    X_test_tree = tree_prep.transform(X_test_sel)

    # Scaled preprocessor (for SVM)
    scaled_prep = FeaturePreprocessor(scale_features=True, impute_strategy="median")
    scaled_prep.fit(X_train_sel)
    X_train_scaled = scaled_prep.transform(X_train_sel)
    X_val_scaled = scaled_prep.transform(X_val_sel)
    X_test_scaled = scaled_prep.transform(X_test_sel)

    # Integer label encoding for XGBoost
    classes = sorted(list(set(y_train)))
    label_to_idx = {c: i for i, c in enumerate(classes)}
    y_train_idx = np.array([label_to_idx[y] for y in y_train])
    np.array([label_to_idx[y] for y in y_val])
    np.array([label_to_idx[y] for y in y_test])

    models_dict = {}
    evaluations = {}

    # 6. Train Model A: Random Forest
    logger.info("--- Step 6A: Training Random Forest ---")
    rf_cfg = config["models"]["random_forest"]
    rf = NIDSRandomForest(**rf_cfg)
    rf.fit(X_train_tree, y_train)
    models_dict["Random Forest"] = (rf, tree_prep)

    rf_val_preds = rf.predict(X_val_tree)
    rf_val_prob = rf.predict_proba(X_val_tree)
    rf_test_preds = rf.predict(X_test_tree)
    rf_test_prob = rf.predict_proba(X_test_tree)

    evaluations["Random Forest"] = {
        "val": evaluate_predictions(
            y_val, rf_val_preds, rf_val_prob, classes, "Random Forest (Val)"
        ),
        "test": evaluate_predictions(
            y_test, rf_test_preds, rf_test_prob, classes, "Random Forest (Test)"
        ),
        "train_time_sec": rf.train_time_sec,
        "inference_time_sec": rf.inference_time_sec,
    }

    # 7. Train Model B: SVM
    logger.info("--- Step 6B: Training SVM ---")
    svm_cfg = config["models"]["svm"].copy()
    svm_sample_limit = config["data"]["sample_limits"].get("svm_train_sample", 25000)
    svm_cfg["sample_limit"] = svm_sample_limit
    svm = NIDSSVM(**svm_cfg)
    svm.fit(X_train_scaled, y_train)
    models_dict["SVM"] = (svm, scaled_prep)

    svm_val_preds = svm.predict(X_val_scaled)
    svm_val_prob = svm.predict_proba(X_val_scaled)
    svm_test_preds = svm.predict(X_test_scaled)
    svm_test_prob = svm.predict_proba(X_test_scaled)

    evaluations["SVM"] = {
        "val": evaluate_predictions(y_val, svm_val_preds, svm_val_prob, classes, "SVM (Val)"),
        "test": evaluate_predictions(y_test, svm_test_preds, svm_test_prob, classes, "SVM (Test)"),
        "train_time_sec": svm.train_time_sec,
        "inference_time_sec": svm.inference_time_sec,
        "actual_train_samples": svm.actual_train_samples,
    }

    # 8. Train Model C: XGBoost
    logger.info("--- Step 6C: Training XGBoost ---")
    xgb_cfg = config["models"]["xgboost"]
    xgb = NIDSXGBoost(**xgb_cfg)
    xgb.fit(X_train_tree, y_train_idx)
    models_dict["XGBoost"] = (xgb, tree_prep)

    xgb_val_preds_idx = xgb.predict(X_val_tree)
    xgb_val_prob = xgb.predict_proba(X_val_tree)
    xgb_val_preds = np.array([classes[i] for i in xgb_val_preds_idx])

    xgb_test_preds_idx = xgb.predict(X_test_tree)
    xgb_test_prob = xgb.predict_proba(X_test_tree)
    xgb_test_preds = np.array([classes[i] for i in xgb_test_preds_idx])

    evaluations["XGBoost"] = {
        "val": evaluate_predictions(y_val, xgb_val_preds, xgb_val_prob, classes, "XGBoost (Val)"),
        "test": evaluate_predictions(
            y_test, xgb_test_preds, xgb_test_prob, classes, "XGBoost (Test)"
        ),
        "train_time_sec": xgb.train_time_sec,
        "inference_time_sec": xgb.inference_time_sec,
    }

    # 9. Model Comparison Table & Plots
    logger.info("--- Step 7: Model Comparison & Artifact Generation ---")
    rows = []
    for mname, ev in evaluations.items():
        t_eval = ev["test"]
        rows.append(
            {
                "Model": mname,
                "Accuracy": t_eval["accuracy"],
                "Macro-F1": t_eval["macro_f1"],
                "Weighted-F1": t_eval["weighted_f1"],
                "Precision": t_eval["precision"],
                "Recall": t_eval["recall"],
                "ROC-AUC": t_eval.get("roc_auc", "N/A"),
                "Training Time (s)": ev["train_time_sec"],
                "Inference Time (s)": ev["inference_time_sec"],
            }
        )
        # Plot confusion matrix
        plot_confusion_matrix(
            t_eval["confusion_matrix"],
            classes,
            mname,
            output_path=str(cm_dir / f"confusion_matrix_{mname.lower().replace(' ', '_')}.png"),
        )

    df_comp = pd.DataFrame(rows)
    df_comp.to_csv(root / config["paths"]["comparison_file"], index=False)
    logger.info(f"Model comparison saved to: {config['paths']['comparison_file']}")

    # Save metrics JSON
    with open(root / config["paths"]["metrics_file"], "w", encoding="utf-8") as f:
        json.dump(evaluations, f, indent=2)

    # 10. Model Selection
    # Select best model based on Test Macro-F1 (prioritizes balanced detection across minority classes)
    best_model_name = max(evaluations.keys(), key=lambda k: evaluations[k]["test"]["macro_f1"])
    logger.info(
        f"Selected Best Model: {best_model_name} (Macro-F1: {evaluations[best_model_name]['test']['macro_f1']})"
    )

    # 11. SHAP Explainability on Selected Model (or Tree Model)
    logger.info("--- Step 8: SHAP Explainability ---")
    shap_model_wrapper, shap_prep = models_dict[
        best_model_name if best_model_name != "SVM" else "Random Forest"
    ]
    inner_model = shap_model_wrapper.model

    explainer = NIDSShapExplainer(
        model=inner_model,
        feature_names=selected_features,
        class_names=classes,
    )
    # Background sample for explainer
    explainer.fit_explainer(X_train_tree[:100])

    # Global importance
    global_shap_path = exp_dir / "global_shap_importance.png"
    explainer.generate_global_importance(X_test_tree[:200], output_plot_path=str(global_shap_path))

    # 3 Concrete Example Prediction Explanations
    concrete_examples = []
    # Find 1 normal, 1 DDoS, 1 PortScan or BruteForce
    sample_indices = []
    for cls in classes:
        cls_idx = np.where(y_test == cls)[0]
        if len(cls_idx) > 0:
            sample_indices.append(int(cls_idx[0]))

    for s_idx in sample_indices[:4]:
        inst = X_test_tree[s_idx]
        true_label = y_test[s_idx]
        raw_pred = shap_model_wrapper.model.predict(inst.reshape(1, -1))[0]
        # Handle string vs integer model outputs
        if isinstance(raw_pred, (str, np.str_)):
            p_idx = classes.index(str(raw_pred))
        else:
            p_idx = int(raw_pred)

        exp = explainer.explain_instance(inst, predicted_class_idx=p_idx, top_n=5)
        exp["true_label"] = str(true_label)
        exp["sample_index"] = s_idx
        concrete_examples.append(exp)

    with open(exp_dir / "concrete_prediction_explanations.json", "w", encoding="utf-8") as f:
        json.dump(concrete_examples, f, indent=2)

    # 12. Save Model Bundles in Registry
    logger.info("--- Step 9: Persisting Model Bundles ---")
    for mname, (mwrap, mprep) in models_dict.items():
        bundle_dir = registry_dir / mname.lower().replace(" ", "_")
        meta = {
            "model_type": mname,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "test_accuracy": evaluations[mname]["test"]["accuracy"],
            "test_macro_f1": evaluations[mname]["test"]["macro_f1"],
            "test_weighted_f1": evaluations[mname]["test"]["weighted_f1"],
            "train_time_sec": evaluations[mname]["train_time_sec"],
            "inference_time_sec": evaluations[mname]["inference_time_sec"],
        }
        ModelRegistry.save_bundle(
            output_dir=bundle_dir,
            model_obj=mwrap.model,
            preprocessor=mprep,
            feature_selector=selector,
            label_classes=classes,
            selected_features=selected_features,
            metadata=meta,
        )

    # Also save selected best model bundle to selected_model_dir
    best_wrap, best_prep = models_dict[best_model_name]
    best_meta = {
        "selected_best_model": best_model_name,
        "selection_criteria": "Highest Macro-F1 score with robust minority class detection",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "test_accuracy": evaluations[best_model_name]["test"]["accuracy"],
        "test_macro_f1": evaluations[best_model_name]["test"]["macro_f1"],
        "test_weighted_f1": evaluations[best_model_name]["test"]["weighted_f1"],
    }
    ModelRegistry.save_bundle(
        output_dir=selected_dir,
        model_obj=best_wrap.model,
        preprocessor=best_prep,
        feature_selector=selector,
        label_classes=classes,
        selected_features=selected_features,
        metadata=best_meta,
    )

    pipeline_summary = {
        "cleaning": clean_log,
        "label_mapping": map_report,
        "split": split_summary,
        "selected_features": selected_features,
        "evaluations": evaluations,
        "comparison_table": df_comp.to_dict(orient="records"),
        "best_model": best_model_name,
        "concrete_shap_examples": concrete_examples,
    }
    logger.info("=== Training and Evaluation Pipeline Finished Successfully ===")
    return pipeline_summary
