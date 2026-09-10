"""Model Registry — manages AI model loading and availability.

Architecture supports plugging in specialized models (e.g., small-arms detection)
without modifying the core pipeline.
"""
import threading
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"

class ModelRegistry:
    """Thread-safe registry for AI models used by IBVAP."""
    
    def __init__(self):
        self._models = {}
        self._lock = threading.Lock()
        self._registry = {
            "general_detector": {
                "filename": "yolov8n.pt",
                "description": "YOLOv8 Nano — General object detection (COCO 80 classes)",
                "supported_classes": ["person", "bicycle", "car", "motorcycle", "bus", "truck"],
                "coco_ids": [0, 1, 2, 3, 5, 7],
            },
            "small_arms_detector": {
                "filename": "small_arms_yolov8.pt",  # Does not exist yet
                "description": "Specialized small-arms/weapon detection model (NOT INCLUDED — requires custom training)",
                "supported_classes": ["handgun", "rifle", "knife"],
                "coco_ids": [],
            },
            "anpr_engine": {
                "filename": None,  # EasyOCR, not a YOLO model
                "description": "EasyOCR-based Automatic Number Plate Recognition",
                "supported_classes": ["license_plate"],
                "coco_ids": [],
            },
        }
    
    def is_available(self, model_name: str) -> bool:
        """Check if a model's weight file exists on disk."""
        info = self._registry.get(model_name)
        if not info or not info["filename"]:
            return model_name == "anpr_engine"  # EasyOCR is always available if installed
        return (MODELS_DIR / info["filename"]).exists()
    
    def get_model(self, model_name: str):
        """Load and cache a YOLO model. Thread-safe."""
        with self._lock:
            if model_name in self._models:
                return self._models[model_name]
            
            info = self._registry.get(model_name)
            if not info:
                raise ValueError(f"Unknown model: {model_name}")
            
            if not info["filename"]:
                return None  # Non-YOLO model (e.g., EasyOCR)
            
            model_path = MODELS_DIR / info["filename"]
            if not model_path.exists():
                print(f"[MODEL REGISTRY] Model file not found: {model_path}")
                return None
            
            from ultralytics import YOLO
            model = YOLO(str(model_path))
            self._models[model_name] = model
            print(f"[MODEL REGISTRY] Loaded: {model_name} from {model_path}")
            return model
    
    def list_models(self) -> list:
        """Return info about all registered models."""
        result = []
        for name, info in self._registry.items():
            result.append({
                "name": name,
                "description": info["description"],
                "supported_classes": info["supported_classes"],
                "available": self.is_available(name),
            })
        return result
    
    def get_supported_classes(self, model_name: str) -> list:
        info = self._registry.get(model_name, {})
        return info.get("supported_classes", [])


# Singleton
model_registry = ModelRegistry()
