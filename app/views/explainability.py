import json

import pandas as pd
import streamlit as st

from app.components.charts import create_shap_waterfall_bar
from nids.utils.config import get_project_root


def render_explainability():
    st.markdown(
        """
        <div style="margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 2rem; color: #F8FAFC;">Explainable AI (SHAP)</h1>
            <p style="color: #94A3B8; font-size: 1rem; margin-top: 4px;">
                Model interpretability powered by Shapley Additive Explanations (SHAP TreeExplainer).
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Disclaimer Alert
    st.markdown(
        """
        <div style="background-color: #1E1B4B; border-left: 4px solid #818CF8; padding: 14px 18px; border-radius: 6px; margin-bottom: 22px;">
            <strong style="color: #C7D2FE;">⚠️ Interpretability vs. Causation Guardrail:</strong>
            <p style="color: #A5B4FC; font-size: 0.88rem; margin: 4px 0 0 0;">
                SHAP feature attributions describe how much each mathematical feature pushed the model’s prediction
                higher or lower relative to the baseline training distribution.
                They do <strong>not</strong> prove physical or causal intrusion origin.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    root = get_project_root()
    exp_dir = root / "reports" / "explanations"
    concrete_file = exp_dir / "concrete_prediction_explanations.json"
    global_shap_img = exp_dir / "global_shap_importance.png"

    tab1, tab2 = st.tabs(["Individual Prediction Attribution", "Global Feature Importance"])

    with tab1:
        st.markdown("### Pre-Computed Real Threat Case Studies")
        if concrete_file.exists():
            with open(concrete_file, "r") as f:
                cases = json.load(f)

            case_options = [
                f"Case #{i + 1}: True [{c.get('true_label', 'Unknown')}] -> Predicted [{c['predicted_class']}] (Sample #{c.get('sample_index', i)})"
                for i, c in enumerate(cases)
            ]

            selected_case_str = st.selectbox("Select Case Study:", case_options)
            sel_idx = case_options.index(selected_case_str)
            case_data = cases[sel_idx]

            st.markdown(f"**Predicted Threat Class:** `{case_data['predicted_class']}`")

            # Waterfall Bar Chart
            st.markdown("#### Local Feature Attribution (SHAP Contributions)")
            fig = create_shap_waterfall_bar(case_data["top_features"])
            st.plotly_chart(fig, use_container_width=True)

            # Table of values
            st.markdown("#### Contributing Flow Features")
            table_data = []
            for item in case_data["top_features"]:
                table_data.append(
                    {
                        "Feature Name": item["feature"],
                        "Observed Flow Value": item["actual_value"],
                        "SHAP Attribution Score": item["shap_value"],
                        "Influence on Prediction": item["impact"],
                    }
                )
            st.dataframe(pd.DataFrame(table_data), use_container_width=True, hide_index=True)
        else:
            st.info(
                "Pre-computed case study explanations not found. Run model training to generate them."
            )

    with tab2:
        st.markdown("### Global Feature Importance (TreeExplainer)")
        st.markdown(
            "Global feature importance measures the average magnitude of impact each flow statistic exerts across the evaluation test set."
        )
        if global_shap_img.exists():
            st.image(
                str(global_shap_img),
                caption="Global Mean |SHAP| Attributions across Test Set",
                use_container_width=True,
            )
        else:
            st.info(
                "Global SHAP importance figure will appear here after running `scripts/train_models.py`."
            )
