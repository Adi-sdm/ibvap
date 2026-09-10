import os
import cv2
import json
import hashlib
import time
from pathlib import Path
from typing import Dict, Any, Optional

EVIDENCE_DIR = Path(__file__).resolve().parents[3] / 'database' / 'evidence'
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

class EvidenceService:
    def __init__(self, storage_dir: Path = EVIDENCE_DIR):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
    def cleanup_old_evidence(self, max_items: int = 1000):
        files = []
        for item in self.storage_dir.iterdir():
            if item.is_file():
                files.append(item)
                
        files.sort(key=lambda x: x.stat().st_mtime)
        if len(files) > max_items:
            files_to_remove = files[:-max_items]
            for f in files_to_remove:
                try:
                    f.unlink()
                except Exception:
                    pass

    def calculate_sha256(self, filepath: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def capture_evidence(self, event_id: str, frame, camera_id: str, 
                         event_data: Dict[str, Any], recent_frames=None) -> Dict[str, str]:
                         
        self.cleanup_old_evidence(max_items=1000)
        
        snapshot_filename = f"{event_id}_snapshot.jpg"
        snapshot_path = self.storage_dir / snapshot_filename
        cv2.imwrite(str(snapshot_path), frame)

        clip_filename = f"{event_id}_clip.mp4"
        clip_path = self.storage_dir / clip_filename
        if recent_frames and len(recent_frames) > 5:
            h, w = frame.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(clip_path), fourcc, 20.0, (w, h))
            for f in recent_frames:
                writer.write(f)
            writer.release()
        else:
            h, w = frame.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(clip_path), fourcc, 10.0, (w, h))
            for _ in range(10):
                writer.write(frame)
            writer.release()

        sha256_sum = self.calculate_sha256(str(snapshot_path))

        meta_filename = f"{event_id}_meta.json"
        meta_path = self.storage_dir / meta_filename
        metadata = {
            "event_id": event_id,
            "camera_id": camera_id,
            "timestamp": time.time(),
            "sha256_hash": sha256_sum,
            "snapshot_file": snapshot_filename,
            "clip_file": clip_filename,
            "event_data": event_data
        }
        with open(meta_path, "w") as mf:
            json.dump(metadata, mf, indent=2)

        return {
            "snapshot_path": f"/evidence/{snapshot_filename}",
            "clip_path": f"/evidence/{clip_filename}",
            "metadata_path": f"/evidence/{meta_filename}",
            "sha256_hash": sha256_sum
        }

evidence_service = EvidenceService()