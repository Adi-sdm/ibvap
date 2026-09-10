import uvicorn
import os
import sys

sys.path.insert(0, r"C:\Users\Adi\.gemini\antigravity\scratch\ibvap")

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, log_level="info", access_log=False)