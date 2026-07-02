#!/usr/bin/env python3
"""
のっぺらぼう画像自動生成スクリプト

顔の目、眉、口、鼻の領域を検出し、周囲の肌色で塗りつぶすことで「のっぺらぼう」画像を生成して保存する。
"""

import sys
import json
import argparse
import urllib.request
from pathlib import Path
import numpy as np
import cv2

# detect_face_mask.py と同じモデル取得ロジックを使用
_MODELS_DIR = Path(__file__).parent / "models"
_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"

ANIMEFACE_CASCADE_PATH = _MODELS_DIR / "lbpcascade_animeface.xml"
ANIMEFACE_CASCADE_URL = "https://raw.githubusercontent.com/nagadomi/lbpcascade_animeface/master/lbpcascade_animeface.xml"

def ensure_animeface_model() -> bool:
    if ANIMEFACE_CASCADE_PATH.exists():
        return True
    try:
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(ANIMEFACE_CASCADE_URL, ANIMEFACE_CASCADE_PATH)
        return True
    except Exception as e:
        print(f"AnimeFace Cascade download failed: {e}", file=sys.stderr)
        return False

def load_rgba(path: str) -> np.ndarray | None:
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img

def get_skin_color(img: np.ndarray, x: int, y: int) -> tuple:
    """指定座標の周辺ピクセルから肌色を取得（透明でなければそのBGR、透明なら白）"""
    h, w = img.shape[:2]
    if x < 0 or x >= w or y < 0 or y >= h:
        return (255, 255, 255)
    
    # 3x3ピクセルの平均
    x1, x2 = max(0, x-1), min(w, x+2)
    y1, y2 = max(0, y-1), min(h, y+2)
    roi = img[y1:y2, x1:x2]
    
    # アルファチャンネルが0より大きいピクセルのみを抽出
    mask = roi[:, :, 3] > 0
    if not np.any(mask):
        return (255, 255, 255)
    
    avg_color = roi[mask][:, :3].mean(axis=0)
    return (int(avg_color[0]), int(avg_color[1]), int(avg_color[2]))

def fill_parts_fallback(img: np.ndarray) -> np.ndarray:
    """顔検出が失敗した場合のフォールバック。
    画像を大きく破壊しないよう、自動でベタ塗りせず、そのままの画像を返してユーザーの手動レタッチに委ねます。"""
    print("[generate_noface] Face detection failed. Returning original image for manual retouch.", file=sys.stderr)
    return img

def detect_animeface(bgr: np.ndarray, W: int, H: int) -> dict | None:
    if not ensure_animeface_model():
        return None
    try:
        cascade = cv2.CascadeClassifier(str(ANIMEFACE_CASCADE_PATH))
        
        c_left = int(W * 0.10)
        c_right = int(W * 0.90)
        c_top = 0
        c_bottom = int(H * 0.50)
        crop = bgr[c_top:c_bottom, c_left:c_right]
        
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        faces = cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=2,
            minSize=(int(W * 0.03), int(H * 0.03))
        )
        if len(faces) > 0:
            sorted_faces = sorted(faces, key=lambda f: abs((f[0] + f[2]/2.0) - (c_right - c_left)/2.0))
            x, y, w, h = sorted_faces[0]
            cx = x + w / 2.0 + c_left
            cy = y + h / 2.0 + c_top

            return {
                "oval_cx": float(cx),
                "oval_cy": float(cy),
                "oval_w": float(w),
                "oval_h": float(h),
                "lx": float(cx - w * 0.23), "ly": float(cy - h * 0.10),
                "rx": float(cx + w * 0.23), "ry": float(cy - h * 0.10),
                "nx": float(cx), "ny": float(cy),
                "mx": float(cx), "my": float(cy + h * 0.25)
            }
    except Exception as e:
        print(f"AnimeFace detection error: {e}", file=sys.stderr)
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_path", help="ベースとなる顔画像の絶対パス")
    parser.add_argument("output_path", help="のっぺらぼう画像の出力先絶対パス")
    parser.add_argument("--mode", default="ai", choices=["ai", "anime"], help="顔検出モード")
    args = parser.parse_args()

    input_path = args.input_path
    output_path = args.output_path
    mode = args.mode

    img = load_rgba(input_path)
    if img is None:
        print(json.dumps({"success": False, "error": f"Failed to load image: {input_path}"}))
        sys.exit(1)

    h, w = img.shape[:2]

    success = False

    # ai モード、またはまず MediaPipe での検出を試みる
    if mode == "ai":
        try:
            import mediapipe as mp
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision

            if not _MODEL_PATH.exists():
                raise FileNotFoundError("Model face_landmarker.task not found")

            options = vision.FaceLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=str(_MODEL_PATH)),
                running_mode=vision.RunningMode.IMAGE,
                min_face_detection_confidence=0.05,
                min_face_presence_confidence=0.05,
                num_faces=1
            )
            
            with vision.FaceLandmarker.create_from_options(options) as landmarker:
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2RGB))
                detection_result = landmarker.detect(mp_image)
                
                if not detection_result.face_landmarks:
                    raise ValueError("No face detected by MediaPipe")
                    
                landmarks = detection_result.face_landmarks[0]
                
                # 顔の中心付近（鼻の頭）の座標から肌色を取得
                nose_landmark = landmarks[1]
                nx, ny = int(nose_landmark.x * w), int(nose_landmark.y * h)
                skin_color = get_skin_color(img, nx, ny)
                b, g, r = skin_color
                
                left_eye_indices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
                right_eye_indices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
                left_brow_indices = [70, 63, 105, 66, 107, 55, 117, 118, 119, 120, 121]
                right_brow_indices = [300, 293, 334, 296, 336, 285, 346, 347, 348, 349, 350]
                mouth_indices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]

                def fill_poly_from_indices(indices):
                    pts = np.array([[int(landmarks[idx].x * w), int(landmarks[idx].y * h)] for idx in indices], np.int32)
                    cv2.fillPoly(img, [pts], (b, g, r, 255))

                fill_poly_from_indices(left_eye_indices)
                fill_poly_from_indices(right_eye_indices)
                fill_poly_from_indices(left_brow_indices)
                fill_poly_from_indices(right_brow_indices)
                fill_poly_from_indices(mouth_indices)
                
                cv2.circle(img, (nx, ny), int(w * 0.02), (b, g, r, 255), -1)
                success = True
        except Exception as e:
            print(f"[generate_noface] MediaPipe failed, checking animeface: {e}", file=sys.stderr)

    # anime モードまたは MediaPipe が失敗した場合に AnimeFace Cascade で試みる
    if not success:
        bgr = img[:, :, :3]
        feat = detect_animeface(bgr, w, h)
        if feat is not None:
            try:
                # 鼻の位置（顔の中心付近）から肌色を取得
                nx, ny = int(feat["nx"]), int(feat["ny"])
                skin_color = get_skin_color(img, nx, ny)
                b, g, r = skin_color

                oval_w = feat["oval_w"]

                # 目、口、鼻の周辺を肌色で塗りつぶす
                # 目の消去 (lx, ly / rx, ry) - 範囲を小さく調整
                lx, ly = int(feat["lx"]), int(feat["ly"])
                rx, ry = int(feat["rx"]), int(feat["ry"])
                eye_radius = int(oval_w * 0.08)
                cv2.circle(img, (lx, ly), eye_radius, (b, g, r, 255), -1)
                cv2.circle(img, (rx, ry), eye_radius, (b, g, r, 255), -1)

                # 口の消去 (mx, my) - 範囲を小さく調整
                mx, my = int(feat["mx"]), int(feat["my"])
                mouth_radius = int(oval_w * 0.09)
                cv2.circle(img, (mx, my), mouth_radius, (b, g, r, 255), -1)

                # 鼻・鼻の穴の消去 (nx, ny) - 範囲を小さく調整
                nose_radius = int(oval_w * 0.03)
                cv2.circle(img, (nx, ny), nose_radius, (b, g, r, 255), -1)

                success = True
                print("[generate_noface] Successfully processed using AnimeFace Cascade.", file=sys.stderr)
            except Exception as e:
                print(f"[generate_noface] AnimeFace processing failed: {e}", file=sys.stderr)

    if not success:
        img = fill_parts_fallback(img)

    # のっぺらぼう画像を保存
    cv2.imwrite(output_path, img)
    print(json.dumps({"success": True, "outputPath": output_path}))

if __name__ == "__main__":
    main()
