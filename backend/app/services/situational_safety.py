"""
IBVAP Situational Safety Intelligence Engine
Evaluates tactical safety context independently of biometric identity.

Principle:
- IDENTITY != THREAT ASSESSMENT
- Unknown person != automatically dangerous
- Known person != automatically safe
- Threat is derived from spatial geofencing, temporal window, kinematic vector,
  behavioral dwell/loitering, and watchlist status.
"""

from typing import Dict, Any, List, Optional
import time

class SituationalSafetyEngine:
    def __init__(self):
        pass

    def evaluate(
        self,
        identity_state: str,
        person_profile: Optional[Dict[str, Any]] = None,
        zone_type: str = "RESTRICTED",
        zone_name: str = "Perimeter Zone",
        behavior: str = "Walking",
        is_night: bool = False,
        is_approaching_boundary: bool = False,
        loitering_seconds: float = 0.0,
        carried_bag: Optional[str] = None,
        camera_id: str = "CAM-01",
        sector: str = "Perimeter Sector",
        sighting_count: int = 1,
        unique_cameras: int = 1
    ) -> Dict[str, Any]:
        """
        Evaluates context and outputs:
        - situation: 'SAFE' | 'ATTENTION' | 'UNSAFE'
        - severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        - reason: Natural language tactical briefing
        - signals: observed, inferred, unavailable
        """
        observed = []
        inferred = []
        unavailable = []

        is_watchlist = False
        if person_profile:
            cat = person_profile.get("category", "").upper()
            stat = person_profile.get("status", "").upper()
            is_watchlist = (cat == "WATCHLIST" or stat == "WATCHLIST")

        # 1. Identity Observations
        if identity_state == "KNOWN":
            pname = person_profile.get("name", "Authorized Personnel") if person_profile else "Authorized Personnel"
            prank = person_profile.get("rank", "Staff") if person_profile else "Staff"
            if is_watchlist:
                observed.append(f"Watchlist Target Identified: {pname}")
            else:
                observed.append(f"Enrolled Personnel: {pname} ({prank})")
        elif identity_state == "UNKNOWN_PREVIOUSLY_SEEN":
            cid = person_profile.get("candidate_id", "Unknown Candidate") if person_profile else "Unknown Candidate"
            observed.append(f"Previously Observed Anonymous Candidate: {cid} (Sightings: {sighting_count}, Across {unique_cameras} Cameras)")
        elif identity_state == "UNKNOWN_NEW":
            cid = person_profile.get("candidate_id", "New Unknown") if person_profile else "New Unknown"
            observed.append(f"New Anonymous Face Detected: {cid}")
        elif identity_state == "UNCERTAIN":
            observed.append("Face detected, match confidence below definite threshold")
            unavailable.append("Definite identity confirmation (confidence insufficient)")
        elif identity_state in ["FACE_DETECTED_ONLY", "RECOGNITION_UNAVAILABLE"]:
            observed.append("Face detected")
            unavailable.append("Biometric identity (quality/resolution below processing threshold)")

        # 2. Environmental & Spatial Observations
        if zone_type == "RESTRICTED":
            observed.append(f"Subject located inside Sterile Exclusion Zone ({zone_name})")
        elif zone_type == "WARNING":
            observed.append(f"Subject located inside Buffer Zone ({zone_name})")
        else:
            observed.append(f"Subject located in Permitted / Civilian Sector ({zone_name})")

        if is_night:
            observed.append("Nocturnal / low-ambient lighting conditions")
        else:
            observed.append("Daylight operational window")

        # 3. Kinematic & Behavioral Observations
        if behavior == "Running":
            observed.append("Rapid movement / running speed detected")
        elif behavior == "Loitering":
            observed.append(f"Prolonged stationary dwell: {loitering_seconds:.1f}s")
        elif behavior == "Direction Reversal":
            observed.append("Sudden trajectory reversal")
        elif behavior == "Group Movement":
            observed.append("Coordinated group kinematic vector")
        else:
            observed.append("Normal walking pace")

        if is_approaching_boundary:
            observed.append("Trajectory vector oriented perpendicularly toward international boundary line")

        if carried_bag:
            observed.append(f"Carried payload / object: {carried_bag}")

        # =====================================================================
        # SITUATION ASSESSMENT DECISION MATRIX
        # =====================================================================

        # Condition 1: Watchlist Target (Instant UNSAFE / CRITICAL)
        if is_watchlist:
            inferred.append("Subject flagged on active security watchlist")
            inferred.append("High probability of coordinated perimeter reconnaissance or penetration")
            return {
                "situation": "UNSAFE",
                "severity": "CRITICAL",
                "confidence": 0.95,
                "reason": f"CRITICAL WATCHLIST TARGET: {person_profile.get('name', 'POI')} confirmed in {sector}. Immediate containment protocol required.",
                "signals": {
                    "observed": observed,
                    "inferred": inferred,
                    "unavailable": unavailable
                }
            }

        # Condition 2: Sterile / Restricted Exclusion Zone
        if zone_type == "RESTRICTED":
            if identity_state == "KNOWN" and person_profile and person_profile.get("category") in ["OPERATIONAL", "SECURITY"]:
                # Authorized Guard / Border Patrol in Restricted Zone
                if behavior in ["Running", "Direction Reversal"] or is_approaching_boundary:
                    inferred.append("Authorized personnel exhibiting rapid tactical reaction or anomaly in perimeter")
                    return {
                        "situation": "ATTENTION",
                        "severity": "MEDIUM",
                        "confidence": 0.88,
                        "reason": f"Authorized personnel {person_profile.get('name', 'Officer')} displaying {behavior.lower()} inside restricted perimeter.",
                        "signals": {
                            "observed": observed,
                            "inferred": inferred,
                            "unavailable": unavailable
                        }
                    }
                else:
                    inferred.append("Authorized patrol conducting routine perimeter security sweep")
                    return {
                        "situation": "SAFE",
                        "severity": "LOW",
                        "confidence": 0.92,
                        "reason": f"Authorized personnel {person_profile.get('name', 'Officer')} conducting authorized routine patrol in {sector}.",
                        "signals": {
                            "observed": observed,
                            "inferred": inferred,
                            "unavailable": unavailable
                        }
                    }
            else:
                # Unknown person or unauthorized civilian in Sterile Restricted Zone
                if behavior == "Running" or is_approaching_boundary or (is_night and loitering_seconds > 5.0):
                    inferred.append("Unauthorized entity penetrating sterile exclusion zone with evasive/rapid velocity")
                    inferred.append("Elevated breach risk based on combined spatial zone and movement vector")
                    return {
                        "situation": "UNSAFE",
                        "severity": "HIGH",
                        "confidence": 0.91,
                        "reason": f"Unknown subject entered Sterile Restricted Zone moving with {behavior.lower()} velocity during {'night' if is_night else 'day'} in {sector}.",
                        "signals": {
                            "observed": observed,
                            "inferred": inferred,
                            "unavailable": unavailable
                        }
                    }
                else:
                    inferred.append("Unauthorized presence in sterile exclusion zone requiring visual interception")
                    return {
                        "situation": "ATTENTION",
                        "severity": "MEDIUM",
                        "confidence": 0.85,
                        "reason": f"Unknown subject detected inside Sterile Perimeter Zone ({sector}) without verified clearance.",
                        "signals": {
                            "observed": observed,
                            "inferred": inferred,
                            "unavailable": unavailable
                        }
                    }

        # Condition 3: Warning / Buffer Zone
        elif zone_type == "WARNING":
            if behavior == "Loitering" or (is_night and behavior != "Walking") or carried_bag:
                inferred.append("Unusual dwell time or payload near perimeter buffer zone")
                return {
                    "situation": "ATTENTION",
                    "severity": "MEDIUM",
                    "confidence": 0.82,
                    "reason": f"Subject exhibiting {behavior.lower()} in buffer zone ({sector}) under {'night' if is_night else 'daylight'} conditions.",
                    "signals": {
                        "observed": observed,
                        "inferred": inferred,
                        "unavailable": unavailable
                    }
                }
            else:
                inferred.append("Transit within secondary buffer zone within acceptable movement limits")
                return {
                    "situation": "SAFE",
                    "severity": "LOW",
                    "confidence": 0.85,
                    "reason": f"Routine movement observed within secondary buffer zone ({sector}).",
                    "signals": {
                        "observed": observed,
                        "inferred": inferred,
                        "unavailable": unavailable
                    }
                }

        # Condition 4: Permitted / Civilian Sector
        else:
            inferred.append("Subject located within designated civilian/permitted movement zone")
            return {
                "situation": "SAFE",
                "severity": "LOW",
                "confidence": 0.90,
                "reason": f"Normal civilian presence observed in permitted corridor ({sector}).",
                "signals": {
                    "observed": observed,
                    "inferred": inferred,
                    "unavailable": unavailable
                }
            }

situational_safety_engine = SituationalSafetyEngine()
