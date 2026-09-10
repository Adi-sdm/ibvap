import pytest
import sys
import os

# Add scratch root to sys.path
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.zones.zone_manager import VirtualZone, ZoneTracker

def test_point_in_polygon():
    # Square zone: [0.2, 0.2] to [0.8, 0.8]
    poly = [(0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8)]
    zone = VirtualZone("z1", "cam1", "Test Zone", poly, "RESTRICTED")
    
    # Inside points
    assert zone.is_inside(0.5, 0.5) is True
    assert zone.is_inside(0.3, 0.3) is True
    
    # Outside points
    assert zone.is_inside(0.1, 0.5) is False
    assert zone.is_inside(0.9, 0.5) is False
    assert zone.is_inside(0.5, 0.1) is False
    assert zone.is_inside(0.5, 0.9) is False

def test_directional_crossing_entry_and_exit():
    poly = [(0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8)]
    zone = VirtualZone("z1", "cam1", "Perimeter Zone", poly, "RESTRICTED")
    tracker = ZoneTracker(loitering_threshold_seconds=5.0)
    tracker.register_zone(zone)
    
    # Frame 1: Track 101 starts outside at (0.1, 0.5)
    evs1 = tracker.update_track("cam1", 101, "person", 0.1, 0.5, 0.9, [80, 250, 100, 300], timestamp=100.0)
    assert len(evs1) == 0, "No event while outside"
    
    # Frame 2: Track 101 moves outside along perimeter to (0.15, 0.5)
    evs2 = tracker.update_track("cam1", 101, "person", 0.15, 0.5, 0.9, [120, 250, 140, 300], timestamp=101.0)
    assert len(evs2) == 0, "Still outside, no event"
    
    # Frame 3: Track 101 enters zone at (0.3, 0.5) -> OUTSIDE TO INSIDE (ENTRY)
    evs3 = tracker.update_track("cam1", 101, "person", 0.3, 0.5, 0.92, [240, 250, 260, 300], timestamp=102.0)
    assert len(evs3) == 1, "Should trigger ENTRY event"
    assert evs3[0]["event_type"] == "INTRUSION_ENTRY"
    assert evs3[0]["direction"] == "OUTSIDE_TO_INSIDE"
    assert evs3[0]["track_id"] == 101
    
    # Frame 4: Track 101 moves deeper inside at (0.5, 0.5) -> INSIDE (no new entry event)
    evs4 = tracker.update_track("cam1", 101, "person", 0.5, 0.5, 0.95, [400, 250, 420, 300], timestamp=103.0)
    assert len(evs4) == 0, "Should not re-trigger entry while still inside"
    
    # Frame 5: Track 101 exits zone to (0.85, 0.5) -> INSIDE TO OUTSIDE (EXIT)
    evs5 = tracker.update_track("cam1", 101, "person", 0.85, 0.5, 0.88, [680, 250, 700, 300], timestamp=104.0)
    assert len(evs5) == 1, "Should trigger EXIT event"
    assert evs5[0]["event_type"] == "ZONE_EXIT"
    assert evs5[0]["direction"] == "INSIDE_TO_OUTSIDE"

def test_loitering_escalation():
    poly = [(0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8)]
    zone = VirtualZone("z1", "cam1", "Perimeter Zone", poly, "RESTRICTED")
    tracker = ZoneTracker(loitering_threshold_seconds=5.0)
    tracker.register_zone(zone)
    
    # Enter at t=0
    tracker.update_track("cam1", 202, "person", 0.5, 0.5, 0.9, [400, 250, 420, 300], timestamp=0.0)
    
    # Still inside at t=3s (< 5s threshold)
    evs_mid = tracker.update_track("cam1", 202, "person", 0.51, 0.51, 0.9, [405, 250, 425, 300], timestamp=3.0)
    assert len(evs_mid) == 0
    
    # Still inside at t=6s (>= 5s threshold) -> LOITERING
    evs_loiter = tracker.update_track("cam1", 202, "person", 0.52, 0.52, 0.9, [410, 250, 430, 300], timestamp=6.0)
    assert len(evs_loiter) == 1
    assert evs_loiter[0]["event_type"] == "LOITERING"
    assert evs_loiter[0]["loitering_seconds"] == 6.0

if __name__ == "__main__":
    test_point_in_polygon()
    test_directional_crossing_entry_and_exit()
    test_loitering_escalation()
    print("ALL ZONE TESTS PASSED!")
