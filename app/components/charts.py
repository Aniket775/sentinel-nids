from typing import Dict, List

import plotly.express as px
import plotly.graph_objects as go

# Palette definition
COLOR_MAP = {
    "Normal": "#10B981",  # Emerald Green
    "DDoS": "#EF4444",  # Crimson Red
    "PortScan": "#F59E0B",  # Amber
    "BruteForce": "#8B5CF6",  # Purple
}


def create_class_distribution_pie(class_counts: Dict[str, int]) -> go.Figure:
    """Creates a sleek donut chart of network traffic composition."""
    labels = list(class_counts.keys())
    values = list(class_counts.values())
    colors = [COLOR_MAP.get(lbl, "#6366F1") for lbl in labels]

    fig = go.Figure(
        data=[
            go.Pie(
                labels=labels,
                values=values,
                hole=0.55,
                marker=dict(colors=colors, line=dict(color="#0B1120", width=2)),
                textinfo="label+percent",
                hoverinfo="label+value+percent",
            )
        ]
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#F8FAFC", family="Inter, sans-serif"),
        margin=dict(t=20, b=20, l=20, r=20),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.15,
            xanchor="center",
            x=0.5,
            font=dict(color="#94A3B8"),
        ),
        showlegend=True,
    )
    return fig


def create_attack_breakdown_bar(attack_counts: Dict[str, int]) -> go.Figure:
    """Creates horizontal bar chart for detected attack vectors."""
    labels = list(attack_counts.keys())
    values = list(attack_counts.values())
    colors = [COLOR_MAP.get(lbl, "#EF4444") for lbl in labels]

    fig = go.Figure(
        data=[
            go.Bar(
                x=values,
                y=labels,
                orientation="h",
                marker=dict(color=colors, line=dict(color="#111827", width=1)),
                text=values,
                textposition="auto",
            )
        ]
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#F8FAFC", family="Inter, sans-serif"),
        xaxis=dict(showgrid=True, gridcolor="#1E293B", title="Record Count"),
        yaxis=dict(showgrid=False, autorange="reversed"),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    return fig


def create_confidence_histogram(confidences: List[float]) -> go.Figure:
    """Creates a probability confidence distribution histogram."""
    fig = px.histogram(
        x=confidences,
        nbins=25,
        color_discrete_sequence=["#22D3EE"],
        labels={"x": "Prediction Confidence Score"},
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#F8FAFC", family="Inter, sans-serif"),
        xaxis=dict(showgrid=True, gridcolor="#1E293B", range=[0.0, 1.0]),
        yaxis=dict(showgrid=True, gridcolor="#1E293B", title="Count"),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    return fig


def create_shap_waterfall_bar(top_features: List[Dict]) -> go.Figure:
    """Creates an interactive horizontal attribution bar chart for an individual record."""
    names = [f["feature"] for f in top_features]
    shap_vals = [f["shap_value"] for f in top_features]
    actual_vals = [f["actual_value"] for f in top_features]

    colors = ["#EF4444" if val > 0 else "#10B981" for val in shap_vals]
    hover_texts = [
        f"Feature: {name}<br>Value: {val}<br>SHAP: {s:+.4f}"
        for name, val, s in zip(names, actual_vals, shap_vals)
    ]

    fig = go.Figure(
        data=[
            go.Bar(
                x=shap_vals[::-1],
                y=names[::-1],
                orientation="h",
                marker=dict(color=colors[::-1]),
                hovertext=hover_texts[::-1],
                hoverinfo="text",
            )
        ]
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#F8FAFC", family="Inter, sans-serif"),
        xaxis=dict(
            showgrid=True,
            gridcolor="#1E293B",
            title="SHAP Attribution (Impact on Class Likelihood)",
            zeroline=True,
            zerolinecolor="#94A3B8",
        ),
        yaxis=dict(showgrid=False),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    return fig
