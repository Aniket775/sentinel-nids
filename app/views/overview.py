import json

import streamlit as st

from app.components.metrics import render_metric_card
from nids.utils.config import get_project_root


def render_overview():
    st.markdown(
        """
        <div style="margin-bottom: 25px;">
            <h1 style="margin: 0; font-size: 2.2rem; color: #F8FAFC;">Network Intrusion Detection System (NIDS)</h1>
            <p style="color: #94A3B8; font-size: 1.05rem; margin-top: 6px;">
                Defensive Machine Learning architecture for automated detection, classification, and SHAP-explainability of network-flow threats.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    root = get_project_root()
    metrics_file = root / "reports" / "metrics.json"
    root / "reports" / "model_comparison.csv"

    # KPI Row
    col1, col2, col3, col4 = st.columns(4)

    best_acc = "N/A"
    best_f1 = "N/A"
    best_model = "Awaiting Training"
    best_time = "N/A"

    if metrics_file.exists():
        with open(metrics_file, "r") as f:
            evals = json.load(f)
            # Find highest test macro_f1
            best_m = max(evals.keys(), key=lambda k: evals[k]["test"]["macro_f1"])
            best_model = best_m
            best_acc = f"{evals[best_m]['test']['accuracy'] * 100:.2f}%"
            best_f1 = f"{evals[best_m]['test']['macro_f1']:.4f}"
            best_time = f"{evals[best_m]['inference_time_sec'] * 1000:.2f} ms"

    with col1:
        render_metric_card("Active Engine", best_model, "Selected Best Model", icon="⚡")
    with col2:
        render_metric_card("Test Accuracy", best_acc, "Holdout Benchmark", icon="🎯")
    with col3:
        render_metric_card("Macro F1-Score", best_f1, "Balanced 4-Class Score", icon="⚖️")
    with col4:
        render_metric_card("Inference Latency", best_time, "Per Batch Evaluation", icon="⏱️")

    st.markdown("<br>", unsafe_allow_html=True)

    # Architectural Overview Cards
    left_col, right_col = st.columns([3, 2])

    with left_col:
        st.markdown(
            """
            <div class="cyber-card">
                <h3 style="color: #22D3EE !important; font-size: 1.25rem; margin-top: 0;">🛡️ System Operational Concept</h3>
                <p style="color: #CBD5E1; line-height: 1.6;">
                    The Sentinel NIDS inspects tabular network bidirectional flow characteristics extracted by flow meters (such as CICFlowMeter).
                    Each network connection is analyzed across packet lengths, inter-arrival times, header flags, and volumetric statistics to detect signatures of malicious activity.
                </p>
                <div style="background-color: #0F172A; border-left: 4px solid #6366F1; padding: 12px 16px; border-radius: 4px; margin-top: 15px;">
                    <strong style="color: #F8FAFC;">Critical Scope Boundary:</strong>
                    <span style="color: #94A3B8; font-size: 0.9rem;">
                        This system operates strictly as an offline dataset-driven detection prototype. It does not perform live packet sniffing, promiscuous NIC capture, or automated firewall blocking.
                    </span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown(
            """
            <div class="cyber-card">
                <h3 style="color: #F8FAFC; font-size: 1.15rem; margin-top: 0;">Target Attack Taxonomy (4-Class Matrix)</h3>
                <table style="width: 100%; border-collapse: collapse; color: #CBD5E1; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid #334155; text-align: left;">
                            <th style="padding: 8px 12px; color: #94A3B8;">Target Class</th>
                            <th style="padding: 8px 12px; color: #94A3B8;">Source Taxonomy</th>
                            <th style="padding: 8px 12px; color: #94A3B8;">Threat Vector Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #1E293B;">
                            <td style="padding: 8px 12px;"><span style="color: #10B981; font-weight: 600;">● Normal</span></td>
                            <td style="padding: 8px 12px;">BENIGN</td>
                            <td style="padding: 8px 12px;">Baseline legitimate user sessions, browsing, streaming.</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #1E293B;">
                            <td style="padding: 8px 12px;"><span style="color: #EF4444; font-weight: 600;">● DDoS</span></td>
                            <td style="padding: 8px 12px;">DDoS LOIC / Volumetric</td>
                            <td style="padding: 8px 12px;">High-rate packet floods designed to exhaust server bandwidth.</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #1E293B;">
                            <td style="padding: 8px 12px;"><span style="color: #F59E0B; font-weight: 600;">● PortScan</span></td>
                            <td style="padding: 8px 12px;">PortScan Probing</td>
                            <td style="padding: 8px 12px;">Reconnaissance sweeps discovering exposed services.</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px;"><span style="color: #8B5CF6; font-weight: 600;">● BruteForce</span></td>
                            <td style="padding: 8px 12px;">FTP-Patator / SSH-Patator</td>
                            <td style="padding: 8px 12px;">Automated dictionary password attacks against authentication daemons.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with right_col:
        st.markdown(
            """
            <div class="cyber-card">
                <h3 style="color: #22D3EE !important; font-size: 1.15rem; margin-top: 0;">Dataset Provenance</h3>
                <ul style="color: #94A3B8; font-size: 0.9rem; line-height: 1.8; padding-left: 20px;">
                    <li><strong>Benchmark:</strong> CICIDS2017 (Canadian Institute for Cybersecurity)</li>
                    <li><strong>Flow Generator:</strong> CICFlowMeter (80+ network statistical features)</li>
                    <li><strong>Target Taxonomy:</strong> 4 Supervised Classes</li>
                    <li><strong>Data Integrity:</strong> Deduplication, Inf/NaN handling, zero-variance filtering</li>
                    <li><strong>Split Strategy:</strong> 70% Train, 15% Validation, 15% Holdout Test</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown(
            """
            <div class="cyber-card">
                <h3 style="color: #F8FAFC; font-size: 1.15rem; margin-top: 0;">Evaluated Machine Learning Models</h3>
                <div style="margin-bottom: 12px;">
                    <strong style="color: #6366F1;">1. Random Forest Classifier</strong><br>
                    <span style="color: #94A3B8; font-size: 0.85rem;">Ensemble bagging model using balanced subsampling and Gini impurity.</span>
                </div>
                <div style="margin-bottom: 12px;">
                    <strong style="color: #EC4899;">2. Support Vector Machine (SVM)</strong><br>
                    <span style="color: #94A3B8; font-size: 0.85rem;">RBF-kernel maximal margin classifier with standard numeric feature scaling.</span>
                </div>
                <div>
                    <strong style="color: #22D3EE;">3. XGBoost Classifier</strong><br>
                    <span style="color: #94A3B8; font-size: 0.85rem;">Histogram-optimized gradient boosted decision trees for non-linear boundary separation.</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
