import io

import pandas as pd
import streamlit as st

from app.components.charts import (
    create_attack_breakdown_bar,
    create_class_distribution_pie,
    create_confidence_histogram,
)
from app.components.metrics import render_metric_card
from nids.prediction.predict import PredictionPipeline
from nids.utils.config import get_project_root


def render_traffic_analysis():
    st.markdown(
        """
        <div style="margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 2rem; color: #F8FAFC;">Network Traffic Analysis</h1>
            <p style="color: #94A3B8; font-size: 1rem; margin-top: 4px;">
                Ingest flow CSV files or bundled authentic CICIDS2017 demonstration data to run batch inference.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    root = get_project_root()
    bundle_dir = root / "models" / "selected_model"
    if not (bundle_dir / "model.joblib").exists():
        st.warning(
            "⚠️ Trained model bundle not detected. Please train models first using `scripts/train_models.py`."
        )
        return

    # Ingestion Source Selector
    source_choice = st.radio(
        "Select Data Ingestion Source:",
        ["Bundled Authentic CICIDS2017 Demo (10,000 Records)", "Upload Custom Flow CSV File"],
        horizontal=True,
    )

    df_to_analyze = None

    if "Bundled" in source_choice:
        demo_path = root / "data" / "demo" / "cicids2017_demo.csv"
        if not demo_path.exists():
            st.error(
                f"Demo file not found at: {demo_path}. Run `scripts/generate_demo_data.py` first."
            )
            return
        df_to_analyze = pd.read_csv(demo_path)
        st.info(
            f"Loaded bundled demo dataset containing {len(df_to_analyze):,} genuine flow records."
        )
    else:
        st.markdown(
            """
            <div style="background-color: #182235; border: 1px dashed #4F46E5; border-radius: 8px; padding: 14px 18px; margin-bottom: 15px;">
                <strong style="color: #22D3EE;">💡 Need a test file?</strong>
                <p style="color: #94A3B8; font-size: 0.88rem; margin: 4px 0 10px 0;">
                    Download one of our pre-packaged genuine flow CSV templates below and upload it directly back to test batch detection:
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

        dl_col1, dl_col2 = st.columns(2)
        sample_path = root / "data" / "demo" / "custom_unlabelled_test.csv"
        minimal_path = root / "data" / "demo" / "minimal_features_test.csv"

        with dl_col1:
            if sample_path.exists():
                with open(sample_path, "rb") as f:
                    st.download_button(
                        label="📥 Download Full Flow Test CSV (500 Rows)",
                        data=f.read(),
                        file_name="sample_network_flows.csv",
                        mime="text/csv",
                        use_container_width=True,
                    )

        with dl_col2:
            if minimal_path.exists():
                with open(minimal_path, "rb") as f:
                    st.download_button(
                        label="📥 Download Minimal 25-Feature Template",
                        data=f.read(),
                        file_name="minimal_nids_schema.csv",
                        mime="text/csv",
                        use_container_width=True,
                    )

        st.markdown("<br>", unsafe_allow_html=True)
        uploaded_file = st.file_uploader(
            "Upload Network Flow CSV (CICFlowMeter schema compatible)",
            type=["csv"],
            help="Upload a CSV with network traffic flow statistics.",
        )
        if uploaded_file is not None:
            try:
                df_to_analyze = pd.read_csv(uploaded_file, low_memory=False)
                st.success(
                    f"Successfully uploaded: {uploaded_file.name} ({len(df_to_analyze):,} rows)"
                )
            except Exception as e:
                st.error(f"Failed to parse uploaded CSV: {e}")
                return

    if df_to_analyze is None:
        st.info("Please select or upload a dataset to begin analysis.")
        return

    # Execute Analysis Button
    if st.button("🚀 Execute Flow Threat Analysis", use_container_width=True):
        with st.spinner(
            "Executing pipeline: schema validation, feature transformation, inference..."
        ):
            pipeline = PredictionPipeline(bundle_dir)
            try:
                df_results = pipeline.predict(df_to_analyze)
                st.session_state["traffic_results"] = df_results
                st.success(f"Analysis complete! Processed {len(df_results):,} records.")
            except Exception as e:
                st.error(f"Prediction Pipeline Error: {e}")
                return

    # Display Results if available in session_state
    if "traffic_results" in st.session_state:
        df_res = st.session_state["traffic_results"]

        st.markdown("---")
        total_records = len(df_res)
        class_counts = df_res["Predicted_Class"].value_counts().to_dict()
        normal_count = class_counts.get("Normal", 0)
        attack_count = total_records - normal_count
        attack_rate = (attack_count / total_records) * 100 if total_records > 0 else 0

        # KPI Metrics
        m1, m2, m3, m4 = st.columns(4)
        with m1:
            render_metric_card(
                "Total Analyzed", f"{total_records:,}", "Network Flow Records", icon="📊"
            )
        with m2:
            render_metric_card(
                "Normal Traffic",
                f"{normal_count:,}",
                f"{100 - attack_rate:.1f}% of total",
                icon="🟢",
            )
        with m3:
            render_metric_card(
                "Detected Threats",
                f"{attack_count:,}",
                f"{attack_rate:.1f}% attack rate",
                icon="🚨",
            )
        with m4:
            avg_conf = (
                df_res["Prediction_Confidence"].mean() * 100
                if "Prediction_Confidence" in df_res.columns
                else 100.0
            )
            render_metric_card(
                "Mean Confidence", f"{avg_conf:.1f}%", "Prediction Certainty", icon="🎯"
            )

        st.markdown("<br>", unsafe_allow_html=True)

        # Charts Row
        col_c1, col_c2 = st.columns(2)
        with col_c1:
            st.markdown("#### Traffic Composition Distribution")
            fig_pie = create_class_distribution_pie(class_counts)
            st.plotly_chart(fig_pie, use_container_width=True)

        with col_c2:
            st.markdown("#### Detected Attack Vector Breakdown")
            attack_counts = {k: v for k, v in class_counts.items() if k != "Normal"}
            if attack_counts:
                fig_bar = create_attack_breakdown_bar(attack_counts)
                st.plotly_chart(fig_bar, use_container_width=True)
            else:
                st.info("No malicious attack vectors detected in analyzed traffic.")

        # Confidence Histogram
        if "Prediction_Confidence" in df_res.columns:
            st.markdown("#### Prediction Confidence Distribution")
            fig_hist = create_confidence_histogram(df_res["Prediction_Confidence"].tolist())
            st.plotly_chart(fig_hist, use_container_width=True)

        # Download Export
        st.markdown("---")
        st.markdown("### Export Predictions")
        csv_buffer = io.StringIO()
        df_res.to_csv(csv_buffer, index=False)
        st.download_button(
            label="📥 Download Annotated Predictions CSV",
            data=csv_buffer.getvalue(),
            file_name="nids_predicted_traffic.csv",
            mime="text/csv",
        )
