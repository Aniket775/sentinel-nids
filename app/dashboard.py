import sys
from pathlib import Path

import streamlit as st

# Ensure project root and src are in sys.path
root_dir = Path(__file__).resolve().parent.parent
src_dir = root_dir / "src"
app_dir = root_dir / "app"

for p in [str(root_dir), str(src_dir), str(app_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.views.about import render_about
from app.views.explainability import render_explainability
from app.views.methodology import render_methodology
from app.views.model_comparison import render_model_comparison
from app.views.overview import render_overview
from app.views.threat_detection import render_threat_detection
from app.views.traffic_analysis import render_traffic_analysis
from nids.prediction.predict import PredictionPipeline

# Global Styling
CUSTOM_CSS = """
<style>
    /* Main App Background */
    .stApp {
        background-color: #0B1120;
        color: #F8FAFC;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #111827;
        border-right: 1px solid #1E293B;
    }

    /* Headers */
    h1, h2, h3, h4, h5, h6 {
        color: #F8FAFC !important;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    /* Cards and containers */
    .cyber-card {
        background-color: #182235;
        border: 1px solid #2D3748;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }

    /* Buttons */
    .stButton>button {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        color: #FFFFFF;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        padding: 8px 20px;
        transition: all 0.2s ease;
    }
    .stButton>button:hover {
        background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%);
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
    }

    /* Download Button */
    .stDownloadButton>button {
        background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
        color: #FFFFFF;
        font-weight: 600;
        border: none;
        border-radius: 8px;
    }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        background-color: #182235;
        border-radius: 6px 6px 0 0;
        color: #94A3B8;
        padding: 10px 18px;
    }
    .stTabs [aria-selected="true"] {
        background-color: #1E293B !important;
        color: #22D3EE !important;
        border-bottom: 2px solid #22D3EE !important;
    }
</style>
"""


@st.cache_resource
def get_prediction_pipeline():
    """Loads prediction pipeline from disk."""
    bundle_dir = root_dir / "models" / "selected_model"
    if not (bundle_dir / "model.joblib").exists():
        bundle_dir = root_dir / "models" / "registry" / "random_forest"
    if not (bundle_dir / "model.joblib").exists():
        return None
    return PredictionPipeline(bundle_dir)


def main():
    # Inject CSS
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

    # Sidebar Header Branding
    st.sidebar.markdown(
        """
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0 15px 0;">
            <span style="font-size: 2rem;">🛡️</span>
            <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: #22D3EE !important;">SENTINEL NIDS</h3>
                <span style="color: #94A3B8; font-size: 0.75rem;">Intrusion Detection System</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Modern Streamlit Page Navigation
    p_overview = st.Page(render_overview, title="Overview", icon="🛡️", default=True)
    p_traffic = st.Page(render_traffic_analysis, title="Traffic Analysis", icon="📊")
    p_threats = st.Page(render_threat_detection, title="Threat Detection", icon="🚨")
    p_xai = st.Page(render_explainability, title="Explainability (XAI)", icon="🧠")
    p_models = st.Page(render_model_comparison, title="Model Comparison", icon="⚖️")
    p_method = st.Page(render_methodology, title="Dataset & Methodology", icon="🔬")
    p_about = st.Page(render_about, title="About System", icon="ℹ️")

    nav = st.navigation(
        {
            "Security Operations": [p_overview, p_traffic, p_threats, p_xai],
            "System Evaluation": [p_models, p_method, p_about],
        }
    )

    # Sidebar Status Card
    st.sidebar.markdown("---")
    st.sidebar.markdown(
        """
        <div style="padding: 10px; background-color: #182235; border-radius: 8px; border: 1px solid #2D3748; margin-bottom: 15px;">
            <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">System Status</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                <span style="height: 10px; width: 10px; background-color: #10B981; border-radius: 50%; display: inline-block;"></span>
                <span style="font-size: 0.85rem; color: #F8FAFC; font-weight: 600;">Engine Operational</span>
            </div>
            <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 6px;">Champion: <strong>XGBoost (99.99%)</strong></div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Run Active Page
    nav.run()


if __name__ == "__main__":
    main()
