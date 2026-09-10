import cv2
import numpy as np
import os
import math

out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "videos"))
os.makedirs(out_dir, exist_ok=True)

def draw_person(frame, x, y, scale=1.0, color=(50, 80, 200), label=None):
    # Head
    head_r = int(12 * scale)
    cv2.circle(frame, (x, y - int(65 * scale)), head_r, color, -1)
    cv2.circle(frame, (x, y - int(65 * scale)), head_r, (20, 20, 20), 2)
    # Torso
    cv2.rectangle(frame, 
                  (x - int(14 * scale), y - int(52 * scale)), 
                  (x + int(14 * scale), y - int(20 * scale)), 
                  color, -1)
    cv2.rectangle(frame, 
                  (x - int(14 * scale), y - int(52 * scale)), 
                  (x + int(14 * scale), y - int(20 * scale)), 
                  (20, 20, 20), 2)
    # Arms
    cv2.line(frame, (x - int(14 * scale), y - int(48 * scale)), (x - int(22 * scale), y - int(25 * scale)), color, int(5 * scale))
    cv2.line(frame, (x + int(14 * scale), y - int(48 * scale)), (x + int(22 * scale), y - int(25 * scale)), color, int(5 * scale))
    # Legs
    cv2.line(frame, (x - int(8 * scale), y - int(20 * scale)), (x - int(10 * scale), y), color, int(6 * scale))
    cv2.line(frame, (x + int(8 * scale), y - int(20 * scale)), (x + int(10 * scale), y), color, int(6 * scale))

def draw_car(frame, x, y, scale=1.2, plate_text="DL 01 AB 1234"):
    # Car body
    w, h = int(180 * scale), int(70 * scale)
    x1, y1 = x - w // 2, y - h
    # Bottom chassis
    cv2.rectangle(frame, (x1, y1 + int(25 * scale)), (x1 + w, y), (40, 100, 180), -1)
    cv2.rectangle(frame, (x1, y1 + int(25 * scale)), (x1 + w, y), (20, 20, 20), 2)
    # Cabin / roof
    pts = np.array([
        [x1 + int(30 * scale), y1 + int(25 * scale)],
        [x1 + int(50 * scale), y1],
        [x1 + w - int(50 * scale), y1],
        [x1 + w - int(30 * scale), y1 + int(25 * scale)]
    ], np.int32)
    cv2.fillPoly(frame, [pts], (60, 140, 220))
    cv2.polylines(frame, [pts], True, (20, 20, 20), 2)
    # Windows
    win_pts = np.array([
        [x1 + int(52 * scale), y1 + 4],
        [x1 + w - int(52 * scale), y1 + 4],
        [x1 + w - int(35 * scale), y1 + int(23 * scale)],
        [x1 + int(35 * scale), y1 + int(23 * scale)]
    ], np.int32)
    cv2.fillPoly(frame, [win_pts], (220, 240, 255))
    # Wheels
    r = int(18 * scale)
    cv2.circle(frame, (x1 + int(40 * scale), y), r, (30, 30, 30), -1)
    cv2.circle(frame, (x1 + int(40 * scale), y), int(8 * scale), (180, 180, 180), -1)
    cv2.circle(frame, (x1 + w - int(40 * scale), y), r, (30, 30, 30), -1)
    cv2.circle(frame, (x1 + w - int(40 * scale), y), int(8 * scale), (180, 180, 180), -1)
    # License Plate
    pw, ph = int(76 * scale), int(22 * scale)
    px1, py1 = x - pw // 2, y - int(18 * scale)
    cv2.rectangle(frame, (px1, py1), (px1 + pw, py1 + ph), (255, 255, 255), -1)
    cv2.rectangle(frame, (px1, py1), (px1 + pw, py1 + ph), (0, 0, 0), 2)
    cv2.putText(frame, plate_text, (px1 + 4, py1 + ph - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.35 * scale, (0, 0, 0), 1, cv2.LINE_AA)

def create_border_background(w=800, h=600, night=False):
    bg = np.zeros((h, w, 3), dtype=np.uint8)
    if night:
        # Dark night sky & desert
        bg[0:int(h*0.45), :] = [30, 20, 15]   # Dark night sky
        bg[int(h*0.45):, :] = [45, 38, 30]   # Desert ground
        # Moonlight
        cv2.circle(bg, (w - 120, 80), 35, (160, 180, 190), -1)
    else:
        # Daytime sky & ground
        bg[0:int(h*0.45), :] = [210, 175, 130] # Sunny sky
        bg[int(h*0.45):, :] = [110, 150, 175]  # Border terrain
        # Sun
        cv2.circle(bg, (100, 80), 40, (120, 220, 255), -1)

    # Perimeter Fence (at y = 340)
    fence_y = int(h * 0.56)
    # Posts
    for px in range(20, w, 60):
        cv2.line(bg, (px, fence_y - 60), (px, fence_y + 30), (70, 70, 70), 4)
    # Barbed wire horizontal strands
    for wy in [fence_y - 50, fence_y - 30, fence_y - 10, fence_y + 10]:
        cv2.line(bg, (0, wy), (w, wy), (100, 100, 100), 2)
        # Barbs
        for bx in range(10, w, 25):
            cv2.line(bg, (bx - 4, wy - 4), (bx + 4, wy + 4), (80, 80, 80), 1)
            cv2.line(bg, (bx - 4, wy + 4), (bx + 4, wy - 4), (80, 80, 80), 1)

    # Perimeter road / zone marker
    cv2.line(bg, (0, fence_y + 80), (w, fence_y + 80), (80, 120, 140), 2, cv2.LINE_AA)
    return bg

print("Generating border_intrusion.mp4...")
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
w, h = 800, 600
fps = 20
num_frames = 120 # 6 seconds

# 1. Intrusion Video: Person walks from top-left (outside fence) through a gap across to bottom-right (restricted zone)
out_path1 = os.path.join(out_dir, "border_intrusion.mp4")
writer1 = cv2.VideoWriter(out_path1, fourcc, fps, (w, h))
bg1 = create_border_background(w, h, night=False)

for i in range(num_frames):
    frame = bg1.copy()
    # Person starts at (150, 280) and moves diagonally across to (550, 480)
    t = i / float(num_frames)
    px = int(150 + (550 - 150) * t)
    py = int(270 + (490 - 270) * t)
    scale = 0.8 + 0.5 * t
    draw_person(frame, px, py, scale=scale, color=(30, 40, 190))
    writer1.write(frame)
writer1.release()

# 2. Perimeter Patrol: Person walks outside fence horizontally (no crossing)
print("Generating perimeter_patrol.mp4...")
out_path2 = os.path.join(out_dir, "perimeter_patrol.mp4")
writer2 = cv2.VideoWriter(out_path2, fourcc, fps, (w, h))
bg2 = create_border_background(w, h, night=False)
for i in range(num_frames):
    frame = bg2.copy()
    t = i / float(num_frames)
    px = int(80 + (700 - 80) * t)
    py = 280 # Stays well outside fence
    draw_person(frame, px, py, scale=0.85, color=(40, 120, 50))
    writer2.write(frame)
writer2.release()

# 3. Night Movement: Night scene, person crawling/walking across
print("Generating night_movement.mp4...")
out_path3 = os.path.join(out_dir, "night_movement.mp4")
writer3 = cv2.VideoWriter(out_path3, fourcc, fps, (w, h))
bg3 = create_border_background(w, h, night=True)
for i in range(num_frames):
    frame = bg3.copy()
    t = i / float(num_frames)
    px = int(600 - (600 - 200) * t)
    py = int(280 + (460 - 280) * t)
    # add synthetic noise for night sensor simulation
    noise = np.random.normal(0, 8, frame.shape).astype(np.int16)
    noisy_frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    draw_person(noisy_frame, px, py, scale=0.9, color=(80, 90, 110))
    writer3.write(noisy_frame)
writer3.release()

# 4. Vehicle Checkpoint: Road with vehicle approaching and stopping
print("Generating vehicle_checkpoint.mp4...")
out_path4 = os.path.join(out_dir, "vehicle_checkpoint.mp4")
writer4 = cv2.VideoWriter(out_path4, fourcc, fps, (w, h))
for i in range(num_frames):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    # Checkpoint gate road
    frame[0:int(h*0.3), :] = [180, 160, 140] # background
    frame[int(h*0.3):, :] = [80, 80, 80]     # Asphalt road
    # Road markings
    for dy in range(int(h*0.35), h, 50):
        cv2.rectangle(frame, (w // 2 - 6, dy), (w // 2 + 6, dy + 25), (255, 255, 255), -1)
    # Checkpoint barrier
    cv2.rectangle(frame, (60, int(h*0.5)), (120, int(h*0.8)), (50, 50, 200), -1)
    cv2.putText(frame, "CHECKPOINT", (65, int(h*0.6)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    
    t = min(1.0, (i / float(num_frames)) * 1.3) # slows down to stop
    car_x = int(120 + (500 - 120) * t)
    car_y = int(350 + (480 - 350) * t)
    scale = 0.9 + 0.4 * t
    draw_car(frame, car_x, car_y, scale=scale, plate_text="DL 01 AB 1234")
    writer4.write(frame)
writer4.release()

print("All 4 demo videos successfully generated!")
