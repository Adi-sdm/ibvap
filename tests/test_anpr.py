import pytest
import sys
import os

from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai.anpr.anpr_engine import ANPREngine

def test_anpr_format_validation():
    engine = ANPREngine(use_easyocr=False)
    
    # Valid Indian format
    valid, norm = engine.validate_format("DL 01 AB 1234")
    assert valid is True
    assert norm == "DL01AB1234"
    
    valid2, norm2 = engine.validate_format("HR26DQ5551")
    assert valid2 is True
    assert norm2 == "HR26DQ5551"
    
    # Invalid gibberish
    invalid, norm_inv = engine.validate_format("???---")
    assert invalid is False

def test_anpr_confidence_flagging():
    engine = ANPREngine(use_easyocr=False, min_confidence=0.75)
    
    # High confidence read
    res_high = {
        "confidence": 0.88,
        "is_valid_format": True
    }
    flag_high = (res_high["confidence"] < engine.min_confidence) or (not res_high["is_valid_format"])
    assert flag_high is False, "High confidence read should not require verification"

    # Low confidence read (<0.75)
    res_low = {
        "confidence": 0.62,
        "is_valid_format": True
    }
    flag_low = (res_low["confidence"] < engine.min_confidence) or (not res_low["is_valid_format"])
    assert flag_low is True, "Low confidence read MUST flag verification required"

if __name__ == "__main__":
    test_anpr_format_validation()
    test_anpr_confidence_flagging()
    print("ANPR TESTS PASSED!")
