#!/usr/bin/env python3
"""
のっぺらぼう画像自動生成スクリプト

顔の目、眉、口、鼻の領域を検出し、周囲の肌色で塗りつぶすことで「のっぺらぼう」画像を生成して保存する。
"""

import sys
import json
import argparse
from pathlib import Path
import numpy as np
import cv2

# detect_face_mask.py と同じモデル取得ロジックを使用
_MODELS_DIR = Path(__file__).parent / "models"
_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"

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

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_path", help="ベースとなる顔画像の絶対パス")
    parser.add_argument("output_path", help="のっぺらぼう画像の出力先絶対パス")
    args = parser.parse_args()

    input_path = args.input_path
    output_path = args.output_path

    img = load_rgba(input_path)
    if img is None:
        print(json.dumps({"success": False, "error": f"Failed to load image: {input_path}"}))
        sys.exit(1)

    h, w = img.shape[:2]

    # MediaPipe を用いた高精度な顔ランドマーク検出を試みる
    try:
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision

        if not _MODEL_PATH.exists():
            # モデルがない場合はフォールバック
            raise FileNotFoundError("Model face_landmarker.task not found")

        # MediaPipeで顔ランドマークを取得
        options = vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(_MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1
        )
        
        with vision.FaceLandmarker.create_from_options(options) as landmarker:
            # 1ch グレースケールにしてから 3ch にして MediaPipe 用画像に
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
            
            # 塗りつぶす領域の定義
            # 眉・目・口などを構成するランドマークのインデックス群
            # 眉: 左(70, 107など), 右(300, 336など)
            # 目: 左(33, 133など), 右(362, 263など)
            # 口: 外周(78, 308など)
            left_eye_indices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
            right_eye_indices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
            left_brow_indices = [70, 63, 105, 66, 107, 55, 117, 118, 119, 120, 121]
            right_brow_indices = [300, 293, 334, 296, 336, 285, 346, 347, 348, 349, 350]
            mouth_indices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]

            def fill_poly_from_indices(indices):
                pts = np.array([[int(landmarks[idx].x * w), int(landmarks[idx].y * h)] for idx in indices], np.int32)
                cv2.fillPoly(img, [pts], (b, g, r, 255))

            # 各パーツを肌色で塗りつぶす
            fill_poly_from_indices(left_eye_indices)
            fill_poly_from_indices(right_eye_indices)
            fill_poly_from_indices(left_brow_indices)
            fill_poly_from_indices(right_brow_indices)
            fill_poly_from_indices(mouth_indices)
            
            # 鼻の穴の消去（必要に応じて簡易的に塗りつぶし）
            cv2.circle(img, (nx, ny), int(w * 0.02), (b, g, r, 255), -1)

    except Exception as e:
        # エラー時はフォールバック
        print(f"[generate_noface] Fallback active: {e}", file=sys.stderr)
        img = fill_parts_fallback(img)

    # のっぺらぼう画像を保存
    cv2.imwrite(output_path, img)
    print(json.dumps({"success": True, "outputPath": output_path}))

if __name__ == "__main__":
    main()
