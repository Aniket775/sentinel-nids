import streamlit as st

from nids.utils.config import get_project_root


def render_methodology():
    st.markdown(
        """
        <div style="margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 2rem; color: #F8FAFC;">Dataset & Methodology</h1>
            <p style="color: #94A3B8; font-size: 1rem; margin-top: 4px;">
                End-to-end data pipeline, feature selection, split protocols, and experimental controls.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    root = get_project_root()
    dataset_md = root / "data" / "DATASET.md"

    if dataset_md.exists():
        with open(dataset_md, "r", encoding="utf-8") as f:
            st.markdown(f.read())
    else:
        st.markdown(
            """
            ### Pipeline Highlights
            1. **Dataset Sourcing:** CICIDS2017 benchmark dataset containing authentic network attacks.
            2. **4-Class Mapping:** Strict taxonomy focusing on Normal, DDoS, PortScan, and BruteForce.
            3. **Feature Preprocessing:** Median imputation, zero-variance filtering, and identifier column dropping.
            4. **Feature Selection:** Random Forest Mean Decrease in Impurity (MDI) ranking selects top 25 features.
            5. **Stratified Split:** 70% Train, 15% Validation, 15% Test.
            """
        )
