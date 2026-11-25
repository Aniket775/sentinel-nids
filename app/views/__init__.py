from app.views.about import render_about
from app.views.explainability import render_explainability
from app.views.methodology import render_methodology
from app.views.model_comparison import render_model_comparison
from app.views.overview import render_overview
from app.views.threat_detection import render_threat_detection
from app.views.traffic_analysis import render_traffic_analysis

__all__ = [
    "render_overview",
    "render_traffic_analysis",
    "render_threat_detection",
    "render_explainability",
    "render_model_comparison",
    "render_methodology",
    "render_about",
]
