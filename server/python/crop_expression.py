#!/usr/bin/env python3
"""
表情スプライトから顔領域（目・口周辺）を検出してクロップするスクリプト。

検出戦略（順に試みる）:
  1. MediaPipe FaceLandmarker — 虹彩中心ランドマーク 468/473 で目の中心を取得
  2. OpenCV Haarcascade (haarcascade_eye.xml) — フォールバック
  3. BFS 暗島ペア法 — TypeScript detectFaceFeatures 相当

クロップ比率は TypeScript autoCropFaceRegion と同一:
  left  = min_eye_x - eyeDist * 0.65
  right = max_eye_x + eyeDist * 0.65
  top   = eye_y    - eyeDist * 0.55
  bottom = eye_y   + eyeDist * 0.85

出力 JSON:
  成功: {"success":true,"croppedBase64":"...","box":{top,left,bottom,right},"method":"..."}
  失敗: {"success":false,"error":"..."}

呼び出し方:
  .venv/bin/python crop_expression.py /absolute/path/to/expr_*.png
"""

import sys
import json
import base64
import argparse
import urllib.request
from pathlib import Path

import numpy as np
import cv2

# ---------------------------------------------------------------------------
# MediaPipe モデル管理（detect_face_mask.py と同じモデルを共有）
# ---------------------------------------------------------------------------

_MODELS_DIR = Path(__file__).parent / "models"
_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)


def ensure_model() -> bool:
    if _MODEL_PATH.exists():
        return True
    try:
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        print("[crop_expression] Downloading face_landmarker.task...", file=sys.stderr)
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        return True
    except Exception as e:
        print(f"[crop_expression] Model download failed: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# 画像ロード / 合成
# ---------------------------------------------------------------------------

def load_rgba(path: str) -> np.ndarray | None:
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def composite_on_white(bgra: np.ndarray) -> np.ndarray:
    """透過 PNG を白背景に合成して BGR を返す（顔特徴が引き立つ）。"""
    alpha = bgra[:, :, 3:4].astype(np.float32) / 255.0
    bgr = bgra[:, :, :3].astype(np.float32)
    bg = np.full_like(bgr, 255.0)
    return (bgr * alpha + bg * (1.0 - alpha)).clip(0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# クロップ比率算出（TypeScript autoCropFaceRegion と同比率）
# ---------------------------------------------------------------------------

def crop_box_from_eyes(
    lx: float, ly: float, rx: float, ry: float, W: int, H: int
) -> dict:
    """左目(lx,ly)・右目(rx,ry)の中心座標からクロップ BoundingBox を算出する。"""
    eye_dist = abs(rx - lx)
    min_ex = min(lx, rx)
    max_ex = max(lx, rx)
    eye_y = (ly + ry) / 2.0
    return {
        "top":    max(0, int(round(eye_y - eye_dist * 0.55))),
        "bottom": min(H, int(round(eye_y + eye_dist * 0.85))),
        "left":   max(0, int(round(min_ex - eye_dist * 0.65))),
        "right":  min(W, int(round(max_ex + eye_dist * 0.65))),
    }


# ---------------------------------------------------------------------------
# 検出 #1: MediaPipe FaceLandmarker
# ---------------------------------------------------------------------------

def detect_mediapipe(bgr: np.ndarray, W: int, H: int) -> tuple | None:
    """(lx, ly, rx, ry) を返す。失敗時は None。"""
    if not ensure_model():
        return None
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision

        base_opts = mp_python.BaseOptions(model_asset_path=str(_MODEL_PATH))
        opts = mp_vision.FaceLandmarkerOptions(
            base_options=base_opts,
            num_faces=1,
            min_face_detection_confidence=0.3,
            min_face_presence_confidence=0.3,
            min_tracking_confidence=0.3,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        landmarker = mp_vision.FaceLandmarker.create_from_options(opts)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect(mp_image)
        landmarker.close()

        if not result.face_landmarks:
            return None
        lm = result.face_landmarks[0]
        if len(lm) < 474:
            return None

        # 468: 右虹彩中心, 473: 左虹彩中心
        rx, ry = lm[468].x * W, lm[468].y * H
        lx, ly = lm[473].x * W, lm[473].y * H
        iod = abs(lx - rx)
        # IOD が幅の 5%〜95% の範囲に収まる場合のみ有効
        if not (W * 0.05 <= iod <= W * 0.95):
            return None
        return (lx, ly, rx, ry)
    except Exception as e:
        print(f"[crop_expression] MediaPipe error: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# 検出 #2: OpenCV Haarcascade
# ---------------------------------------------------------------------------

def detect_haarcascade(bgr: np.ndarray, W: int, H: int) -> tuple | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    eye_xml = cv2.data.haarcascades + "haarcascade_eye.xml"
    eye_cascade = cv2.CascadeClassifier(eye_xml)
    eyes = eye_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=2,
        minSize=(int(W * 0.05), int(H * 0.03))
    )
    if len(eyes) < 2:
        return None

    eyes_sorted = sorted(eyes, key=lambda e: e[2] * e[3], reverse=True)[:6]
    centers = [(int(e[0] + e[2] / 2), int(e[1] + e[3] / 2)) for e in eyes_sorted]

    best = None
    best_score = -1.0
    for i in range(len(centers)):
        for j in range(i + 1, len(centers)):
            cx1, cy1 = centers[i]
            cx2, cy2 = centers[j]
            iod = abs(cx2 - cx1)
            if not (W * 0.10 <= iod <= W * 0.90):
                continue
            y_diff = abs(cy1 - cy2)
            score = iod - y_diff * 2
            if score > best_score:
                best_score = score
                best = (float(cx1), float(cy1), float(cx2), float(cy2))
    return best


# ---------------------------------------------------------------------------
# 検出 #3: BFS 暗島ペア法（TypeScript detectFaceFeatures 移植）
# ---------------------------------------------------------------------------

def detect_bfs(bgra: np.ndarray, W: int, H: int) -> tuple | None:
    """暗連結成分から左右目ペアを検出する。"""
    gray = 0.299 * bgra[:, :, 2] + 0.587 * bgra[:, :, 1] + 0.114 * bgra[:, :, 0]
    lum = gray.astype(np.float32)
    alpha_mask = bgra[:, :, 3] > 10
    near_black = (bgra[:, :, 2] < 30) & (bgra[:, :, 1] < 30) & (bgra[:, :, 0] < 30)
    mask_dark = (lum <= 110) & (~near_black) & alpha_mask

    BORDER = 2
    mask_dark[:BORDER, :] = False
    mask_dark[H - BORDER:, :] = False
    mask_dark[:, :BORDER] = False
    mask_dark[:, W - BORDER:] = False

    dark_u8 = mask_dark.astype(np.uint8)
    num_labels, _labels, stats, centroids = cv2.connectedComponentsWithStats(
        dark_u8, connectivity=4
    )

    candidates = []
    for lbl in range(1, num_labels):
        area = int(stats[lbl, cv2.CC_STAT_AREA])
        cx_f, cy_f = centroids[lbl]
        if area < 5 or area > 2000:
            continue
        if cy_f < H * 0.10 or cy_f > H * 0.80:
            continue
        candidates.append((cx_f, cy_f, area))

    if len(candidates) < 2:
        return None

    best = None
    best_score = -np.inf
    for i in range(len(candidates)):
        for j in range(i + 1, len(candidates)):
            ax, ay, aa = candidates[i]
            bx, by, ba = candidates[j]
            horiz = abs(bx - ax)
            if horiz < W * 0.15 or horiz > W * 0.80:
                continue
            y_diff = abs(ay - by)
            if y_diff > H * 0.20:
                continue
            score = (aa + ba) * (1.0 - y_diff / (H * 0.20 + 1))
            if score > best_score:
                best_score = score
                best = (ax, ay, bx, by)

    return best


# ---------------------------------------------------------------------------
# エントリポイント
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="表情スプライト顔クロップ")
    parser.add_argument("image_path", help="PNG image absolute path")
    args = parser.parse_args()

    bgra = load_rgba(args.image_path)
    if bgra is None:
        print(json.dumps({"success": False, "error": f"Cannot load image: {args.image_path}"}))
        sys.exit(1)

    H, W = bgra.shape[:2]
    bgr = composite_on_white(bgra)

    eyes = None
    method = "none"

    mp_result = detect_mediapipe(bgr, W, H)
    if mp_result:
        eyes = mp_result
        method = "mediapipe"
    else:
        hc_result = detect_haarcascade(bgr, W, H)
        if hc_result:
            eyes = hc_result
            method = "haarcascade"
        else:
            bfs_result = detect_bfs(bgra, W, H)
            if bfs_result:
                eyes = bfs_result
                method = "bfs"

    if eyes is None:
        print(json.dumps({"success": False, "error": "No eyes detected"}))
        sys.exit(2)

    lx, ly, rx, ry = eyes
    box = crop_box_from_eyes(lx, ly, rx, ry, W, H)

    if box["right"] <= box["left"] or box["bottom"] <= box["top"]:
        print(json.dumps({"success": False, "error": "Invalid crop box computed"}))
        sys.exit(2)

    cropped = bgra[box["top"]:box["bottom"], box["left"]:box["right"]]
    _, buf = cv2.imencode(".png", cropped)
    cropped_b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    print(json.dumps({
        "success": True,
        "croppedBase64": cropped_b64,
        "box": box,
        "method": method,
    }))


if __name__ == "__main__":
    main()
