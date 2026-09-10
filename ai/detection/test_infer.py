from ultralytics import YOLO
import os

print("Testing YOLO model loading...")
# Load YOLOv8n (default lightweight model)
model = YOLO("yolov8n.pt")
print(f"Model loaded successfully: {model.model.__class__.__name__}")

video_path = r"C:\Users\Adi\.gemini\antigravity\scratch\ibvap\demo\videos\border_intrusion.mp4"
print(f"Running tracking inference on {video_path}...")

# Run tracking on first 10 frames
results = model.track(source=video_path, persist=True, tracker="bytetrack.yaml", stream=True, verbose=False)

frame_count = 0
for r in results:
    frame_count += 1
    boxes = r.boxes
    if boxes is not None and len(boxes) > 0:
        for box in boxes:
            cls_id = int(box.cls[0].item())
            cls_name = model.names[cls_id]
            conf = float(box.conf[0].item())
            track_id = int(box.id[0].item()) if box.id is not None else None
            xyxy = [round(x, 1) for x in box.xyxy[0].tolist()]
            print(f"Frame {frame_count}: Detected {cls_name} (ID: {track_id}, Conf: {conf:.2f}, BBox: {xyxy})")
    else:
        print(f"Frame {frame_count}: No detections")
    if frame_count >= 15:
        break

print(f"Inference test completed for {frame_count} frames.")