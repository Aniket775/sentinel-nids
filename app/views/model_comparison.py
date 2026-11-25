import json

import pandas as pd
import streamlit as st

from nids.utils.config import get_project_root


def render_model_comparison():
    st.markdown(
        """
        <div style="margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 2rem; color: #F8FAFC;">Algorithm Comparison & Evaluation</h1>
            <p style="color: #94A3B8; font-size: 1rem; margin-top: 4px;">
                Rigorous empirical comparison across Random Forest, Support Vector Machine (SVM), and XGBoost.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    root = get_project_root()
    comp_file = root / "reports" / "model_comparison.csv"
    metrics_file = root / "reports" / "metrics.json"
    cm_dir = root / "reports" / "confusion_matrices"

    if not comp_file.exists():
        st.warning(
            "Model comparison results not available yet. Please execute `scripts/train_models.py`."
        )
        return

    df_comp = pd.read_csv(comp_file)

    st.markdown("### Empirical Performance on Holdout Test Set (15% Stratified)")
    st.dataframe(
        df_comp.style.format(
            {
                "Accuracy": "{:.4f}",
                "Macro-F1": "{:.4f}",
                "Weighted-F1": "{:.4f}",
                "Precision": "{:.4f}",
                "Recall": "{:.4f}",
                "Training Time (s)": "{:.2f}",
                "Inference Time (s)": "{:.4f}",
            }
        ),
        use_container_width=True,
        hide_index=True,
    )

    # Download CSV
    st.download_button(
        "📥 Download Model Comparison CSV",
        df_comp.to_csv(index=False),
        file_name="nids_model_comparison.csv",
        mime="text/csv",
    )

    st.markdown("---")
    st.markdown("### Confusion Matrices across Evaluated Models")

    cm_cols = st.columns(3)
    models = ["Random Forest", "SVM", "XGBoost"]

    for col, mname in zip(cm_cols, models):
        with col:
            st.markdown(f"#### {mname}")
            cm_img_path = cm_dir / f"confusion_matrix_{mname.lower().replace(' ', '_')}.png"
            if cm_img_path.exists():
                st.image(str(cm_img_path), use_container_width=True)
            else:
                st.info(f"Matrix plot for {mname} not generated yet.")

    # Per-Class Metrics Breakdown
    if metrics_file.exists():
        with open(metrics_file, "r") as f:
            evals = json.load(f)

        st.markdown("---")
        st.markdown("### Per-Class Detection Recall & Precision")
        st.markdown(
            "In cybersecurity intrusion detection, high accuracy alone can mask failure on minority attack vectors. "
            "Examine per-class recall to ensure no attack category goes undetected."
        )

        rows = []
        for mname, data in evals.items():
            per_class = data["test"].get("per_class", {})
            for cname, cmetrics in per_class.items():
                rows.append(
                    {
                        "Model": mname,
                        "Class": cname,
                        "Precision": cmetrics["precision"],
                        "Recall": cmetrics["recall"],
                        "F1-Score": cmetrics["f1_score"],
                    }
                )

        if rows:
            df_per_class = pd.DataFrame(rows)
            st.dataframe(df_per_class, use_container_width=True, hide_index=True)
