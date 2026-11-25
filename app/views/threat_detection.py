import pandas as pd
import streamlit as st

from app.components.metrics import render_status_badge
from app.components.tables import render_threat_table


def render_threat_detection():
    st.markdown(
        """
        <div style="margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 2rem; color: #F8FAFC;">Threat Detection Console</h1>
            <p style="color: #94A3B8; font-size: 1rem; margin-top: 4px;">
                Filter, inspect, and drill down into individual malicious network flows.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if "traffic_results" not in st.session_state:
        st.info(
            "No analyzed traffic found in memory. Please execute an analysis on the **Traffic Analysis** page first."
        )
        return

    df_res = st.session_state["traffic_results"]
    df_threats = df_res[df_res["Predicted_Class"] != "Normal"].copy()

    if df_threats.empty:
        st.success(
            "✅ Zero threats detected! All analyzed records were classified as Normal baseline traffic."
        )
        return

    # Filter Controls
    f_col1, f_col2, f_col3 = st.columns([2, 2, 2])
    with f_col1:
        available_attacks = ["All Attack Vectors"] + sorted(
            list(df_threats["Predicted_Class"].unique())
        )
        selected_attack = st.selectbox("Filter by Threat Vector:", available_attacks)

    with f_col2:
        min_conf = st.slider("Minimum Confidence Threshold:", 0.0, 1.0, 0.5, 0.05)

    with f_col3:
        st.text_input("Search in features:", "")

    # Apply filters
    filtered_df = df_threats.copy()
    if selected_attack != "All Attack Vectors":
        filtered_df = filtered_df[filtered_df["Predicted_Class"] == selected_attack]

    if "Prediction_Confidence" in filtered_df.columns:
        filtered_df = filtered_df[filtered_df["Prediction_Confidence"] >= min_conf]

    st.markdown(
        f"**Showing {len(filtered_df):,} matching threat records (from {len(df_threats):,} total threats):**"
    )

    # Threat Table
    render_threat_table(filtered_df, max_rows=50)

    # Detailed Record Inspector
    st.markdown("---")
    st.markdown("### 🔍 Individual Threat Inspector")

    if not filtered_df.empty:
        record_idx = st.selectbox(
            "Select Threat Record to Inspect:",
            filtered_df.index.tolist()[:100],
            format_func=lambda idx: (
                f"Flow #{idx} — [{filtered_df.loc[idx, 'Predicted_Class']}] (Confidence: {filtered_df.loc[idx, 'Prediction_Confidence'] if 'Prediction_Confidence' in filtered_df.columns else 1.0})"
            ),
        )

        selected_row = filtered_df.loc[record_idx]
        st.session_state["selected_record_index"] = record_idx

        # Inspector Columns
        i_col1, i_col2 = st.columns([1, 2])
        with i_col1:
            st.markdown(
                f"""
                <div class="cyber-card">
                    <h4 style="margin-top:0; color: #22D3EE !important;">Threat Summary</h4>
                    <p><strong>Predicted Vector:</strong> {render_status_badge(selected_row["Predicted_Class"])}</p>
                    <p><strong>Confidence:</strong> {selected_row.get("Prediction_Confidence", 1.0):.4f}</p>
                    <p><strong>Flow Index:</strong> #{record_idx}</p>
                </div>
                """,
                unsafe_allow_html=True,
            )
            st.info(
                "Tip: Head over to **Explainability (XAI)** to see full SHAP feature attributions for this record."
            )

        with i_col2:
            st.markdown("#### Flow Attributes")
            attr_df = pd.DataFrame(
                {
                    "Attribute": selected_row.index,
                    "Value": selected_row.values.astype(str),
                }
            )
            st.dataframe(attr_df, use_container_width=True, height=260)
