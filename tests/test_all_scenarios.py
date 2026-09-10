"""
IBVAP Verification Suite Runner
Executes all unit, integration, and end-to-end test scenarios.
"""
import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

TESTS = [
    ("Core Services & Heuristics", "tests/test_core_services.py"),
    ("Ray-Casting Virtual Zones", "tests/test_zones.py"),
    ("Offline ANPR Engine", "tests/test_anpr.py"),
    ("FastAPI REST Endpoints", "tests/test_backend_api.py"),
    ("End-to-End Surveillance Flow", "tests/test_end_to_end.py"),
]

def run_all():
    print("=" * 65)
    print("  IBVAP - Intelligent Border Video Analytics Platform  ")
    print("        Verification & Compliance Test Suite           ")
    print("=" * 65)
    
    passed = 0
    failed = 0
    
    for title, test_file in TESTS:
        test_path = PROJECT_ROOT / test_file
        print(f"\n[RUNNING] {title} ({test_file})...")
        cmd = [sys.executable, str(test_path)]
        res = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
        if res.returncode == 0:
            print(f"  --> PASSED: {title}")
            passed += 1
        else:
            print(f"  --> FAILED: {title} (Exit code: {res.returncode})")
            failed += 1

    print("\n" + "=" * 65)
    print(f"  TOTAL TESTS: {len(TESTS)} | PASSED: {passed} | FAILED: {failed}")
    print("=" * 65)
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(run_all())
