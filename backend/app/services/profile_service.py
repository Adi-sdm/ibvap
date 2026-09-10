"""
Surveillance Profile Service
Defines pre-configured operational surveillance profiles for various border deployment scenarios.
Provides parameter templates and class whitelists for dynamic pipeline configuration.
"""

from typing import Dict, Any, List

PROFILE_PRESETS: Dict[str, Dict[str, Any]] = {
    "Border Fence Monitoring": {
        "id": "border_fence",
        "name": "Border Fence Monitoring",
        "description": "Optimized for physical perimeter barriers, zero-tolerance intrusions, and boundary wire crossings.",
        "target_classes": ["person", "backpack", "handbag", "suitcase"],
        "class_ids": [0, 24, 26, 28],
        "enabled_modules": {
            "intrusion": True,
            "loitering": True,
            "direction": True,
            "group": True,
            "animal_filter": True,
            "anpr": False,
            "small_arms": False,
            "day_night": True
        },
        "default_alert_threshold": 60,
        "default_detection_conf": 0.25,
        "loitering_seconds": 8.0,
        "running_threshold": 0.02,
        "overlay_defaults": {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": False,
            "debug": False
        }
    },
    "Checkpoint Monitoring": {
        "id": "checkpoint",
        "name": "Checkpoint Monitoring",
        "description": "Combined personnel entry and vehicle lane control with automated plate recognition.",
        "target_classes": ["person", "car", "motorcycle", "bus", "truck", "backpack", "suitcase"],
        "class_ids": [0, 2, 3, 5, 7, 24, 28],
        "enabled_modules": {
            "intrusion": True,
            "loitering": True,
            "direction": True,
            "group": True,
            "animal_filter": True,
            "anpr": True,
            "small_arms": False,
            "day_night": True
        },
        "default_alert_threshold": 50,
        "default_detection_conf": 0.30,
        "loitering_seconds": 15.0,
        "running_threshold": 0.025,
        "overlay_defaults": {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": True,
            "debug": False
        }
    },
    "Vehicle Inspection": {
        "id": "vehicle_inspection",
        "name": "Vehicle Inspection",
        "description": "Dedicated vehicular portal focused on plate extraction, wrong-way driving, and queue dwell times.",
        "target_classes": ["car", "motorcycle", "bus", "truck"],
        "class_ids": [2, 3, 5, 7],
        "enabled_modules": {
            "intrusion": False,
            "loitering": False,
            "direction": True,
            "group": False,
            "animal_filter": False,
            "anpr": True,
            "small_arms": False,
            "day_night": True
        },
        "default_alert_threshold": 40,
        "default_detection_conf": 0.30,
        "loitering_seconds": 20.0,
        "running_threshold": 0.03,
        "overlay_defaults": {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": True,
            "debug": False
        }
    },
    "Sensitive Sector": {
        "id": "sensitive_area",
        "name": "Sensitive Sector",
        "description": "High-security assets with heightened sensitivity, rapid dwell alarms, and proactive secondary analysis.",
        "target_classes": ["person", "backpack", "handbag", "suitcase", "car"],
        "class_ids": [0, 2, 24, 26, 28],
        "enabled_modules": {
            "intrusion": True,
            "loitering": True,
            "direction": True,
            "group": True,
            "animal_filter": True,
            "anpr": True,
            "small_arms": False,
            "day_night": True
        },
        "default_alert_threshold": 40,
        "default_detection_conf": 0.20,
        "loitering_seconds": 5.0,
        "running_threshold": 0.015,
        "overlay_defaults": {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": True,
            "debug": True
        }
    },
    "Custom": {
        "id": "custom",
        "name": "Custom",
        "description": "Fully operator-defined parameters, module matrix, and detection sensitivities.",
        "target_classes": ["person", "car", "motorcycle", "bus", "truck", "backpack"],
        "class_ids": [0, 2, 3, 5, 7, 24],
        "enabled_modules": {
            "intrusion": True,
            "loitering": True,
            "direction": True,
            "group": True,
            "animal_filter": True,
            "anpr": True,
            "small_arms": False,
            "day_night": True
        },
        "default_alert_threshold": 60,
        "default_detection_conf": 0.25,
        "loitering_seconds": 8.0,
        "running_threshold": 0.02,
        "overlay_defaults": {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": False,
            "debug": False
        }
    }
}

class ProfileService:
    @staticmethod
    def list_profiles() -> List[Dict[str, Any]]:
        return list(PROFILE_PRESETS.values())

    @staticmethod
    def get_profile(name_or_id: str) -> Dict[str, Any]:
        for profile in PROFILE_PRESETS.values():
            if profile["name"] == name_or_id or profile["id"] == name_or_id:
                return profile
        return PROFILE_PRESETS["Border Fence Monitoring"]

profile_service = ProfileService()
