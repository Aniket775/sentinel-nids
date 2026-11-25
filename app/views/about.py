import streamlit as st


def render_about():
    st.markdown(
        """
        <div style="margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 2rem; color: #F8FAFC;">About Sentinel NIDS</h1>
            <p style="color: #94A3B8; font-size: 1rem; margin-top: 4px;">
                Academic Network Intrusion Detection System Prototype.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        """
        <div class="cyber-card">
            <h3 style="color: #22D3EE !important; font-size: 1.25rem; margin-top: 0;">Project Scope & Defensive Guardrails</h3>
            <p style="color: #CBD5E1; line-height: 1.7;">
                This software is an educational and research offline intrusion detection platform.
                It demonstrates the practical efficacy and trade-offs of applying contemporary supervised machine learning algorithms
                (Random Forest, Support Vector Machines, and XGBoost) along with Explainable AI (SHAP) to network flow analytics.
            </p>
            <h4 style="color: #EF4444 !important; margin-top: 15px;">Explicit Operational Boundaries:</h4>
            <ul style="color: #94A3B8; line-height: 1.7;">
                <li><strong>No Live Packet Sniffing:</strong> Does not attach to raw sockets or NIC promiscuous modes.</li>
                <li><strong>No Inline Firewall Interception:</strong> Does not insert iptables, pf, or nftables rules.</li>
                <li><strong>No Automated Blocking:</strong> Does not drop live packets or sever TCP connections.</li>
                <li><strong>No Zero-Day Guarantee:</strong> Detection capabilities are bounded by patterns present in training distributions.</li>
                <li><strong>No Payload Decryption:</strong> Flow features describe statistical transport behavior, not decrypted application payloads.</li>
            </ul>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        """
        <div class="cyber-card">
            <h3 style="color: #F8FAFC; font-size: 1.15rem; margin-top: 0;">Technology Stack</h3>
            <table style="width: 100%; border-collapse: collapse; color: #CBD5E1; font-size: 0.9rem;">
                <tr style="border-bottom: 1px solid #1E293B;"><td style="padding: 8px 0; color: #94A3B8;">Language</td><td>Python 3.14 (CPython)</td></tr>
                <tr style="border-bottom: 1px solid #1E293B;"><td style="padding: 8px 0; color: #94A3B8;">Machine Learning</td><td>Scikit-learn, XGBoost, Imbalanced-learn</td></tr>
                <tr style="border-bottom: 1px solid #1E293B;"><td style="padding: 8px 0; color: #94A3B8;">Explainable AI</td><td>SHAP (TreeExplainer)</td></tr>
                <tr style="border-bottom: 1px solid #1E293B;"><td style="padding: 8px 0; color: #94A3B8;">Interactive UI</td><td>Streamlit, Plotly, HTML/CSS</td></tr>
                <tr style="border-bottom: 1px solid #1E293B;"><td style="padding: 8px 0; color: #94A3B8;">Testing & Linting</td><td>Pytest, Ruff</td></tr>
                <tr><td style="padding: 8px 0; color: #94A3B8;">Persistence</td><td>Joblib, PyYAML</td></tr>
            </table>
        </div>
        """,
        unsafe_allow_html=True,
    )
