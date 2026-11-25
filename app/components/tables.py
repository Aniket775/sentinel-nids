import pandas as pd
import streamlit as st


def render_threat_table(df: pd.DataFrame, max_rows: int = 50) -> None:
    """Renders a threat detection table with color-coded badges and clean typography."""
    if df.empty:
        st.info("No suspicious traffic records detected.")
        return

    # Select representative columns
    display_cols = ["Predicted_Class", "Prediction_Confidence"]
    flow_features = [
        c
        for c in df.columns
        if c not in ["Predicted_Class", "Prediction_Confidence"] and not c.startswith("Score_")
    ][:6]

    final_cols = display_cols + flow_features
    available_cols = [c for c in final_cols if c in df.columns]

    st.dataframe(
        df[available_cols].head(max_rows),
        use_container_width=True,
        hide_index=True,
    )
