"""
Vision Reasoning Provider Interface
Abstract base class for secondary multimodal AI verification layers.
Decouples IBVAP from specific cloud or local vision LLM providers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np

@dataclass
class VisionAnalysisResult:
    status: str  # "COMPLETED", "OFFLINE", "TIMEOUT", "RATE_LIMITED", "DISABLED", "ERROR"
    model: str
    situational_assessment: str = ""
    ambiguity_explanation: str = ""
    confidence_assessment: str = "Moderate"  # "High", "Moderate", "Low"
    recommended_operator_response: str = ""
    threat_indicators: List[str] = field(default_factory=list)
    latency_ms: float = 0.0
    error_message: Optional[str] = None
    disclaimer: str = "Advisory intelligence only. Operational dispatch decisions remain under operator control."

    # Defence Evaluation Structured Categories
    scene_summary: str = ""
    observed_entities: List[Dict[str, Any]] = field(default_factory=list)
    observed_actions: List[Dict[str, Any]] = field(default_factory=list)
    behavior_assessment: List[Dict[str, Any]] = field(default_factory=list)
    local_ai_consistency: Dict[str, Any] = field(default_factory=dict)
    uncertainties: List[Dict[str, Any]] = field(default_factory=list)
    not_visible_aspects: List[str] = field(default_factory=list)
    recommended_checks: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "model": self.model,
            "situational_assessment": self.situational_assessment or self.scene_summary,
            "ambiguity_explanation": self.ambiguity_explanation,
            "confidence_assessment": self.confidence_assessment,
            "recommended_operator_response": self.recommended_operator_response,
            "threat_indicators": self.threat_indicators,
            "latency_ms": round(self.latency_ms, 1),
            "error_message": self.error_message,
            "disclaimer": self.disclaimer,
            "scene_summary": self.scene_summary,
            "observed_entities": self.observed_entities,
            "observed_actions": self.observed_actions,
            "behavior_assessment": self.behavior_assessment,
            "local_ai_consistency": self.local_ai_consistency,
            "uncertainties": self.uncertainties,
            "not_visible_aspects": self.not_visible_aspects,
            "recommended_checks": self.recommended_checks
        }

class VisionReasoningProvider(ABC):
    """Abstract interface for secondary vision-language reasoning engines."""

    @abstractmethod
    async def analyze_frame(
        self, 
        frame_bgr: np.ndarray, 
        event_context: Dict[str, Any]
    ) -> VisionAnalysisResult:
        """Asynchronously analyze an image frame with event telemetry context."""
        pass

    @abstractmethod
    async def test_connection(self, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Test reachability and authentication with the upstream provider."""
        pass
