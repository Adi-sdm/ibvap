from typing import Dict, Any, List, Tuple

class RiskEngine:
    def __init__(self):
        # Configurable rule weights
        self.weights = {
            "BASE_DETECTION": 10,
            "RESTRICTED_ZONE_ENTRY": 35,
            "WARNING_ZONE_ENTRY": 15,
            "BOUNDARY_CROSSING": 30,
            "NIGHT_CONDITION": 15,
            "LOITERING": 15,
            "SUSPICIOUS_VEHICLE": 20,
            "RAPID_APPROACH": 10,
            "RUNNING": 10,
            "SUDDEN_DIRECTION_CHANGE": 15,
            "GROUP_MOVEMENT": 10,
            "UNATTENDED_OBJECT": 25,
            "CARRIED_OBJECT": 15
        }

    def evaluate(self, event_type: str, zone_type: str, class_name: str,
                 is_night: bool = False, loitering_seconds: float = 0.0,
                 is_speeding: bool = False, is_running: bool = False,
                 has_direction_change: bool = False, is_group_movement: bool = False,
                 is_unattended_object: bool = False, is_suspicious_vehicle: bool = False,
                 has_carried_bag: bool = False) -> Tuple[int, str, List[str]]:
        score = 0

        rules_fired = []

        # Rule: Base detection
        score += self.weights["BASE_DETECTION"]
        rules_fired.append(f"✓ Target identified as '{class_name}' (+{self.weights['BASE_DETECTION']} pts)")

        # Rule: Zone type
        if zone_type == "RESTRICTED":
            score += self.weights["RESTRICTED_ZONE_ENTRY"]
            rules_fired.append(f"✓ Target entered Restricted Perimeter Zone (+{self.weights['RESTRICTED_ZONE_ENTRY']} pts)")
        elif zone_type == "WARNING":
            score += self.weights["WARNING_ZONE_ENTRY"]
            rules_fired.append(f"✓ Target entered Warning Buffer Zone (+{self.weights['WARNING_ZONE_ENTRY']} pts)")

        # Rule: Crossing direction
        if "ENTRY" in event_type or "INTRUSION" in event_type:
            score += self.weights["BOUNDARY_CROSSING"]
            rules_fired.append(f"✓ Physical boundary perimeter crossing detected (+{self.weights['BOUNDARY_CROSSING']} pts)")

        # Rule: Night mode
        if is_night:
            score += self.weights["NIGHT_CONDITION"]
            rules_fired.append(f"✓ Low-light / nocturnal border condition detected (+{self.weights['NIGHT_CONDITION']} pts)")

        # Rule: Loitering
        if loitering_seconds >= 8.0:
            score += self.weights["LOITERING"]
            rules_fired.append(f"✓ Prolonged dwell / loitering inside zone for {loitering_seconds:.1f}s (+{self.weights['LOITERING']} pts)")

        # Rule: Speed / Rapid approach
        if is_speeding:
            score += self.weights["RAPID_APPROACH"]
            rules_fired.append(f"✓ Target accelerating rapidly towards boundary line (+{self.weights['RAPID_APPROACH']} pts)")
            
        # Rule: Running
        if is_running:
            score += self.weights["RUNNING"]
            rules_fired.append(f"✓ Target is running (+{self.weights['RUNNING']} pts)")
            
        # Rule: Sudden Direction Change
        if has_direction_change:
            score += self.weights["SUDDEN_DIRECTION_CHANGE"]
            rules_fired.append(f"✓ Target suddenly changed direction (+{self.weights['SUDDEN_DIRECTION_CHANGE']} pts)")
            
        # Rule: Group Movement
        if is_group_movement:
            score += self.weights["GROUP_MOVEMENT"]
            rules_fired.append(f"✓ Target is part of a moving group (+{self.weights['GROUP_MOVEMENT']} pts)")
            
        # Rule: Unattended Object
        if is_unattended_object:
            score += self.weights["UNATTENDED_OBJECT"]
            rules_fired.append(f"✓ Unattended object detected (+{self.weights['UNATTENDED_OBJECT']} pts)")
            
        # Rule: Suspicious Vehicle
        if is_suspicious_vehicle:
            score += self.weights["SUSPICIOUS_VEHICLE"]
            rules_fired.append(f"✓ Suspicious vehicle detected (+{self.weights['SUSPICIOUS_VEHICLE']} pts)")

        # Rule: Object / Bag Carried
        if has_carried_bag:
            score += self.weights["CARRIED_OBJECT"]
            rules_fired.append(f"✓ Carried object / bag detected (+{self.weights['CARRIED_OBJECT']} pts)")


        # Clamp score between 0 and 100
        score = min(100, max(0, score))

        # Severity categorization
        if score >= 75:
            severity = "Critical"
        elif score >= 50:
            severity = "High"
        elif score >= 25:
            severity = "Medium"
        else:
            severity = "Info"

        return score, severity, rules_fired

risk_engine = RiskEngine()