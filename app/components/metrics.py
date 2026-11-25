import streamlit as st


def render_metric_card(
    title: str,
    value: str,
    delta: str = "",
    delta_color: str = "normal",
    icon: str = "🛡️",
) -> None:
    """Renders a styled cybersecurity KPI card with dark navy background and glowing border."""
    card_html = f"""
    <div style="
        background: #182235;
        border: 1px solid #2D3748;
        border-radius: 10px;
        padding: 18px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        margin-bottom: 12px;
    ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94A3B8; font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">{title}</span>
            <span style="font-size: 1.25rem;">{icon}</span>
        </div>
        <div style="font-size: 1.85rem; font-weight: 700; color: #F8FAFC; margin-top: 8px;">
            {value}
        </div>
        {f'<div style="font-size: 0.8rem; color: #22D3EE; margin-top: 4px;">{delta}</div>' if delta else ""}
    </div>
    """
    st.markdown(card_html, unsafe_allow_html=True)


def render_status_badge(status: str) -> str:
    """Returns color-coded HTML badge for threat classes."""
    color_map = {
        "Normal": ("#065F46", "#34D399"),  # bg, text
        "DDoS": ("#7F1D1D", "#F87171"),
        "PortScan": ("#78350F", "#FBBF24"),
        "BruteForce": ("#581C87", "#C084FC"),
    }
    bg, fg = color_map.get(status, ("#1E293B", "#94A3B8"))
    return f"""
    <span style="
        background-color: {bg};
        color: {fg};
        padding: 3px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.78rem;
        display: inline-block;
    ">{status}</span>
    """
