"""Small-Arms Detection Module — Architecture Stub

IMPORTANT: The standard YOLOv8n model (trained on COCO) does NOT support
firearm/weapon detection. The COCO dataset classes include:
  person, bicycle, car, motorcycle, bus, truck, etc.
But do NOT include: handgun, rifle, firearm, weapon.

To enable small-arms detection, you need to:
1. Train a YOLOv8 model on a weapon detection dataset
   (e.g., from Roboflow, IMFDB, or custom-collected data)
2. Export the trained model as 'small_arms_yolov8.pt'
3. Place it in the models/ directory
4. The ModelRegistry will automatically detect and load it

Until a trained model is available, this module returns empty results
and logs a clear message. It does NOT fake detections.
"""

from ai.inference.model_registry import model_registry


class SmallArmsDetector:
    """Placeholder for weapon detection. Returns empty results until a model is provided."""
    
    def __init__(self):
        self.available = model_registry.is_available("small_arms_detector")
        self.model = None
        if self.available:
            self.model = model_registry.get_model("small_arms_detector")
            print("[SMALL-ARMS] Weapon detection model loaded.")
        else:
            print("[SMALL-ARMS] No weapon detection model available. "
                  "To enable, place 'small_arms_yolov8.pt' in models/ directory.")
    
    def detect(self, frame):
        """Run weapon detection on a frame.
        
        Returns:
            list: Empty list if no model available. Otherwise list of dicts:
                  [{"class": "handgun", "confidence": 0.85, "bbox": [x1,y1,x2,y2]}]
        """
        if not self.available or not self.model:
            return []
        
        # When a real model is plugged in, this would run:
        # results = self.model(frame, conf=0.40)
        # return [parse each detection...]
        return []
    
    def is_operational(self) -> bool:
        return self.available and self.model is not None
