#!/usr/bin/env python3
"""
顔マスク検出スクリプト（サーバーサイド）

検出戦略（順に試みる）:
  1. MediaPipe FaceLandmarker (新 Task API) — 虹彩中心 468/473 番ランドマーク
     ※ モデルファイル (face_landmarker.task) を models/ に初回自動ダウンロード
  2. OpenCV Haarcascade (haarcascade_eye.xml) — フォールバック
  3. 検出失敗時は exit(2) で JSON エラーを stdout に出力

出力 JSON:
  成功: {"centerX":f,"centerY":f,"radiusX":f,"radiusY":f,"feather":8,"method":"mediapipe"|"haarcascade"}
  失敗: {"error":"...","method":"none"}

呼び出し方:
  .venv/bin/python detect_face_mask.py /absolute/path/to/expr_*.png
"""

import sys
import json
import argparse
import os
import urllib.request
from pathlib import Path

import numpy as np
import cv2

# ---------------------------------------------------------------------------
# MediaPipe モデル管理
# ---------------------------------------------------------------------------

_MODELS_DIR = Path(__file__).parent / "models"
_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)


def ensure_model() -> bool:
    """モデルファイルが存在しなければダウンロードする。失敗時は False を返す。"""
    if _MODEL_PATH.exists():
        return True
    try:
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[detect_face_mask] Downloading face_landmarker.task...", file=sys.stderr)
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        print(f"[detect_face_mask] Model saved to {_MODEL_PATH}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[detect_face_mask] Model download failed: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# 画像ロード
# ---------------------------------------------------------------------------

def load_rgba(path: str) -> np.ndarray | None:
    """PNG（透過含む）を BGRA 4ch で読み込む。"""
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def composite_on_gray(bgra: np.ndarray) -> np.ndarray:
    """透過 PNG を中間グレー背景 (128,128,128) に合成して BGR を返す。
    白背景だとスプライト外枠が目立ち検出精度が落ちるため中間グレーを使う。"""
    alpha = bgra[:, :, 3:4].astype(np.float32) / 255.0
    bgr = bgra[:, :, :3].astype(np.float32)
    bg = np.full_like(bgr, 128.0)
    return (bgr * alpha + bg * (1.0 - alpha)).clip(0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# FaceMask パラメータ算出（mask.ts の estimateFaceMask と同一比率）
# ---------------------------------------------------------------------------

def face_mask_params(mid_x: float, mid_y: float, iod: float, method: str) -> dict:
    # MediaPipe の虹彩中心間距離は BFS の暗島中心間距離より小さいため
    # 楕円が顔を包むよう手法ごとに異なる乗数を使う（IoU 実測から導出）。
    if method == "mediapipe":
        rx_mult, ry_mult = 1.20, 0.80
    else:
        rx_mult, ry_mult = 0.78, 0.52
    return {
        "centerX": round(mid_x, 1),
        "centerY": round(mid_y + iod * 0.09, 1),
        "radiusX": round(iod * rx_mult, 1),
        "radiusY": round(iod * ry_mult, 1),
        "feather": 8,
        "method": method,
    }


# ---------------------------------------------------------------------------
# 検出 #1: MediaPipe FaceLandmarker (Task API)
# ---------------------------------------------------------------------------

def detect_mediapipe(bgr: np.ndarray, W: int, H: int) -> dict | None:
    """MediaPipe FaceLandmarker (新 Task API) で虹彩中心を検出する。"""
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
            min_face_detection_confidence=0.3,  # アニメ絵は低めに設定
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
        # 468: 右虹彩中心, 473: 左虹彩中心（refine_landmarks が有効なモデルのみ）
        if len(lm) < 474:
            return None

        rx, ry = lm[468].x * W, lm[468].y * H
        lx, ly = lm[473].x * W, lm[473].y * H
        iod = abs(lx - rx)

        # IOD がスプライト幅の 10%〜80% でなければ誤検出とみなす
        if not (W * 0.10 <= iod <= W * 0.80):
            return None

        return face_mask_params((rx + lx) / 2, (ry + ly) / 2, iod, "mediapipe")

    except Exception as e:
        print(f"[detect_face_mask] MediaPipe error: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# 検出 #2: OpenCV Haarcascade (フォールバック)
# ---------------------------------------------------------------------------

def detect_haarcascade(bgr: np.ndarray, W: int, H: int) -> dict | None:
    """OpenCV Haarcascade (eye + face) でフォールバック検出。"""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # ヒストグラム均等化でアニメ絵の低コントラストを補正
    gray = cv2.equalizeHist(gray)

    face_xml = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    eye_xml = cv2.data.haarcascades + "haarcascade_eye.xml"
    face_cascade = cv2.CascadeClassifier(face_xml)
    eye_cascade = cv2.CascadeClassifier(eye_xml)

    # フェーズ1: 顔領域を検出 → その中で目を探す
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=2,
        minSize=(int(W * 0.2), int(H * 0.2))
    )
    for (fx, fy, fw, fh) in faces:
        roi = gray[fy:fy + fh, fx:fx + fw]
        eyes = eye_cascade.detectMultiScale(
            roi, scaleFactor=1.05, minNeighbors=2,
            minSize=(int(fw * 0.1), int(fh * 0.08))
        )
        if len(eyes) >= 2:
            result = _pick_eye_pair(eyes, fx, fy, W)
            if result:
                return result

    # フェーズ2: 顔検出失敗 → 画像全体で目だけ探す
    eyes = eye_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=2,
        minSize=(int(W * 0.05), int(H * 0.03))
    )
    if len(eyes) < 2:
        return None
    return _pick_eye_pair(eyes, 0, 0, W)


def _pick_eye_pair(eyes, ox: int, oy: int, W: int) -> dict | None:
    """検出された目候補から最適なペアを選んで FaceMask を返す。"""
    # 面積降順でソートして上位 6 つまでに絞る
    eyes_sorted = sorted(eyes, key=lambda e: e[2] * e[3], reverse=True)[:6]
    centers = [(ox + int(e[0] + e[2] / 2), oy + int(e[1] + e[3] / 2)) for e in eyes_sorted]

    best = None
    best_score = -1.0
    for i in range(len(centers)):
        for j in range(i + 1, len(centers)):
            cx1, cy1 = centers[i]
            cx2, cy2 = centers[j]
            iod = abs(cx2 - cx1)
            if not (W * 0.15 <= iod <= W * 0.75):
                continue
            # y 座標の差が小さいほど良いペア
            y_diff = abs(cy1 - cy2)
            score = iod - y_diff * 2
            if score > best_score:
                best_score = score
                best = (cx1, cy1, cx2, cy2, iod)

    if best is None:
        return None

    cx1, cy1, cx2, cy2, iod = best
    mid_x = (cx1 + cx2) / 2
    mid_y = (cy1 + cy2) / 2
    return face_mask_params(mid_x, mid_y, iod, "haarcascade")


# ---------------------------------------------------------------------------
# 検出 #3: BFS 暗島ペア法（TypeScript estimateFaceMask 移植・最終フォールバック）
# ---------------------------------------------------------------------------

def detect_bfs_fallback(bgra: np.ndarray, W: int, H: int) -> dict | None:
    """TypeScript feature-island-detector.ts の BFS ロジックを Python で再実装。
    cv2.connectedComponentsWithStats で暗連結成分を列挙し、目候補ペアを選ぶ。"""
    data = bgra  # BGRA

    # ラベル開始行の検出（下から上へ走査）
    label_start_y = H
    for y in range(H - 1, -1, -1):
        row = data[y, :, :3].astype(np.float32)  # BGR
        max_c = row.max(axis=1)
        min_c = row.min(axis=1)
        sat = max_c - min_c
        colorful = np.sum((sat > 20) & (max_c < 235) & (max_c > 30))
        if colorful / W >= 0.05:
            break
        label_start_y = y

    BORDER = 2
    gray = 0.299 * data[:, :, 2] + 0.587 * data[:, :, 1] + 0.114 * data[:, :, 0]
    lum = gray.astype(np.float32)

    # 暗特徴ピクセル: 輝度 ≤ 110、近黒(r<30,g<30,b<30)除外、境界除外
    near_black = (data[:, :, 2] < 30) & (data[:, :, 1] < 30) & (data[:, :, 0] < 30)
    mask_dark = (lum <= 110) & (~near_black)
    # 境界とラベル領域を除外
    mask_dark[:BORDER, :] = False
    mask_dark[label_start_y - BORDER:, :] = False
    mask_dark[:, :BORDER] = False
    mask_dark[:, W - BORDER:] = False

    dark_u8 = mask_dark.astype(np.uint8)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(dark_u8, connectivity=4)

    # 面積 15〜1200、Y 座標が 15%〜75% の範囲
    candidates = []
    for lbl in range(1, num_labels):
        area = int(stats[lbl, cv2.CC_STAT_AREA])
        cx_f, cy_f = centroids[lbl]
        if area < 15 or area > 1200:
            continue
        if cy_f < label_start_y * 0.15 or cy_f > label_start_y * 0.75:
            continue
        candidates.append((cx_f, cy_f, area))

    if len(candidates) < 2:
        return None

    best: tuple | None = None
    best_score = -np.inf
    for i in range(len(candidates)):
        for j in range(i + 1, len(candidates)):
            ax, ay, aa = candidates[i]
            bx, by, ba = candidates[j]
            left_x, right_x = (ax, bx) if ax <= bx else (bx, ax)
            horiz = right_x - left_x
            if horiz < W * 0.25 or horiz > W * 0.75:
                continue
            y_diff = abs(ay - by)
            if y_diff > label_start_y * 0.15:
                continue
            area_ratio = min(aa, ba) / max(aa, ba)
            if area_ratio < 0.15:
                continue
            score = (aa + ba) * (1.0 - y_diff / (label_start_y * 0.15 + 1))
            if score > best_score:
                best_score = score
                best = (ax, ay, bx, by, horiz)

    if best is None:
        return None

    ax, ay, bx, by, iod = best
    mid_x = (ax + bx) / 2
    mid_y = (ay + by) / 2

    # IOD が W×0.25〜0.55 外はフォールバック値を使う（estimateFaceMask 同様）
    if not (W * 0.25 <= iod <= W * 0.55):
        iod_fb = W * 0.38
        mid_x = W / 2
        # label_start_y の 55% を目中点 Y と推定
        mid_y = label_start_y * 0.55
        return face_mask_params(mid_x, mid_y, iod_fb, "bfs-fallback")

    return face_mask_params(mid_x, mid_y, iod, "bfs-fallback")


# ---------------------------------------------------------------------------
# エントリポイント
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="顔マスク検出")
    parser.add_argument("image_path", help="PNG image absolute path")
    args = parser.parse_args()

    bgra = load_rgba(args.image_path)
    if bgra is None:
        print(json.dumps({"error": f"Cannot load image: {args.image_path}", "method": "none"}))
        sys.exit(1)

    H, W = bgra.shape[:2]
    bgr = composite_on_gray(bgra)

    result = (
        detect_mediapipe(bgr, W, H)
        or detect_haarcascade(bgr, W, H)
        or detect_bfs_fallback(bgra, W, H)
    )

    if result is None:
        print(json.dumps({"error": "No face detected", "method": "none"}))
        sys.exit(2)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
