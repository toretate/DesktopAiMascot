#!/usr/bin/env python3
import sys
import json
import argparse
import urllib.request
from pathlib import Path
import numpy as np
import cv2

# モデルとインデックス定義
_MODELS_DIR = Path(__file__).parent / "models"
_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

FACE_OVAL_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 
    400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 
    54, 103, 67, 109
]

def ensure_model() -> bool:
    if _MODEL_PATH.exists():
        return True
    try:
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        return True
    except Exception as e:
        print(f"Model download failed: {e}", file=sys.stderr)
        return False

def composite_on_white(bgra: np.ndarray) -> np.ndarray:
    if bgra.shape[2] != 4:
        return bgra[:, :, :3]
    alpha = bgra[:, :, 3:4].astype(np.float32) / 255.0
    bgr = bgra[:, :, :3].astype(np.float32)
    bg = np.full_like(bgr, 255.0)
    return (bgr * alpha + bg * (1.0 - alpha)).clip(0, 255).astype(np.uint8)

def detect_mediapipe_on_raw(bgr: np.ndarray, W: int, H: int) -> dict | None:
    """与えられた画像領域(BGR)に対して直接MediaPipe検出を実行する"""
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
            min_face_detection_confidence=0.05, # 低めの閾値でイラストに対応
            min_face_presence_confidence=0.05,
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

        # 虹彩や特徴点座標
        rx = lm[468].x * W
        ry = lm[468].y * H
        lx = lm[473].x * W
        ly = lm[473].y * H
        nx = lm[1].x * W
        ny = lm[1].y * H
        mx = (lm[13].x + lm[14].x) / 2.0 * W
        my = (lm[13].y + lm[14].y) / 2.0 * H

        # 輪郭
        oval_pts = []
        for idx in FACE_OVAL_INDICES:
            px = lm[idx].x * W
            py = lm[idx].y * H
            oval_pts.append((px, py))
        
        oval_x = [p[0] for p in oval_pts]
        oval_y = [p[1] for p in oval_pts]
        oval_cx = sum(oval_x) / len(oval_x)
        oval_cy = sum(oval_y) / len(oval_y)
        oval_w = max(oval_x) - min(oval_x)
        oval_h = max(oval_y) - min(oval_y)
        
        return {
            "lx": lx, "ly": ly, "rx": rx, "ry": ry,
            "nx": nx, "ny": ny,
            "mx": mx, "my": my,
            "oval_cx": oval_cx, "oval_cy": oval_cy,
            "oval_w": oval_w, "oval_h": oval_h
        }
    except Exception:
        return None

def detect_mediapipe_multiscale(bgr: np.ndarray, W: int, H: int) -> dict | None:
    """立ち絵画像全体から顔部分をマルチスケール・スキャンして検出する"""
    # 頭部が存在し得る「上部中央付近」を複数のズーム率・位置で切り出して検出
    scan_configs = [
        (0.20, 0.05, 0.60, 0.40), # やや広め
        (0.25, 0.05, 0.50, 0.35), # 標準ズーム
        (0.30, 0.08, 0.40, 0.30), # 高ズーム
        (0.15, 0.02, 0.70, 0.48), # 広範囲
    ]
    
    for xr, yr, wr, hr in scan_configs:
        x1 = int(W * xr)
        y1 = int(H * yr)
        x2 = int(W * (xr + wr))
        y2 = int(H * (yr + hr))
        
        crop = bgr[y1:y2, x1:x2]
        if crop.size == 0:
            continue
            
        cH, cW = crop.shape[:2]
        # 切り出した領域をさらに2倍にバイキュービック拡大して検出率を跳ね上げる
        zoom = cv2.resize(crop, (cW * 2, cH * 2), interpolation=cv2.INTER_CUBIC)
        zH, zW = zoom.shape[:2]
        
        feat = detect_mediapipe_on_raw(zoom, zW, zH)
        if feat is not None:
            # ズームおよびクロップによる座標のズレを元の物理ピクセル解像度に戻す
            return {
                "lx": feat["lx"] / 2.0 + x1,
                "ly": feat["ly"] / 2.0 + y1,
                "rx": feat["rx"] / 2.0 + x1,
                "ry": feat["ry"] / 2.0 + y1,
                "nx": feat["nx"] / 2.0 + x1,
                "ny": feat["ny"] / 2.0 + y1,
                "mx": feat["mx"] / 2.0 + x1,
                "my": feat["my"] / 2.0 + y1,
                "oval_cx": feat["oval_cx"] / 2.0 + x1,
                "oval_cy": feat["oval_cy"] / 2.0 + y1,
                "oval_w": feat["oval_w"] / 2.0,
                "oval_h": feat["oval_h"] / 2.0
            }
    return None

def detect_haarcascade(bgr: np.ndarray, W: int, H: int) -> dict | None:
    c_left = int(W * 0.15)
    c_right = int(W * 0.85)
    c_top = 0
    c_bottom = int(H * 0.45)
    
    crop_bgr = bgr[c_top:c_bottom, c_left:c_right]
    cH, cW = crop_bgr.shape[:2]

    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    eye_xml = cv2.data.haarcascades + "haarcascade_eye.xml"
    eye_cascade = cv2.CascadeClassifier(eye_xml)
    eyes = eye_cascade.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=3,
        minSize=(int(cW * 0.03), int(cH * 0.03))
    )
    if len(eyes) >= 2:
        eyes = sorted(eyes, key=lambda e: e[0])
        ex1, ey1, ew1, eh1 = eyes[0]
        ex2, ey2, ew2, eh2 = eyes[1]
        lx = ex1 + ew1 / 2.0 + c_left
        ly = ey1 + eh1 / 2.0 + c_top
        rx = ex2 + ew2 / 2.0 + c_left
        ry = ey2 + eh2 / 2.0 + c_top
        
        iod = abs(rx - lx)
        return {
            "lx": lx, "ly": ly, "rx": rx, "ry": ry,
            "nx": (lx + rx) / 2.0, "ny": (ly + ry) / 2.0 + iod * 0.4,
            "mx": (lx + rx) / 2.0, "my": (ly + ry) / 2.0 + iod * 0.75,
            "oval_cx": (lx + rx) / 2.0, "oval_cy": (ly + ry) / 2.0 + iod * 0.4,
            "oval_w": iod * 2.0, "oval_h": iod * 2.2
        }
    return None
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

def detect_animeface(bgr: np.ndarray, W: int, H: int) -> dict | None:
    if not ensure_animeface_model():
        return None
    try:
        cascade = cv2.CascadeClassifier(str(ANIMEFACE_CASCADE_PATH))
        
        # ターゲット領域を切り抜いて実行 (上部10%〜50%)
        c_left = int(W * 0.10)
        c_right = int(W * 0.90)
        c_top = 0
        c_bottom = int(H * 0.50)
        crop = bgr[c_top:c_bottom, c_left:c_right]
        
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        # アニメ顔はやや検出サイズを小さく設定可能
        faces = cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=2,
            minSize=(int(W * 0.03), int(H * 0.03))
        )
        if len(faces) > 0:
            candidates = []
            for (x_c, y_c, w_c, h_c) in faces:
                cx_c = x_c + w_c / 2.0 + c_left
                cy_c = y_c + h_c / 2.0 + c_top
                candidates.append({
                    "faceX": float(cx_c),
                    "faceY": float(cy_c),
                    "faceWidth": float(w_c),
                    "faceHeight": float(h_c)
                })

            # デフォルトとして最初の候補（最も中央に近いもの）を選択
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
                "mx": float(cx), "my": float(cy + h * 0.25),
                "candidates": candidates
            }
    except Exception as e:
        print(f"AnimeFace detection error: {e}", file=sys.stderr)
    return None

def imread_unicode(path: str, flags=cv2.IMREAD_UNCHANGED) -> np.ndarray | None:
    try:
        nparr = np.fromfile(path, dtype=np.uint8)
        return cv2.imdecode(nparr, flags)
    except Exception as e:
        print(f"Failed to read unicode path {path}: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to original base image")
    parser.add_argument("--mode", default="ai", choices=["ai", "anime"], help="Detection mode (ai or anime)")
    args = parser.parse_args()

    img = imread_unicode(args.image, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(json.dumps({"success": False, "error": "Failed to load image"}))
        return

    H, W = img.shape[:2]

    # アルファ処理
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        
    bgr = img[:, :, :3]

    feat = None
    method = args.mode

    if args.mode == "anime":
        feat = detect_animeface(bgr, W, H)
        if feat is None:
            # アニメ顔が検出できなかった場合は Haar Cascade にフォールバック
            bgr_white = composite_on_white(img)
            feat = detect_haarcascade(bgr_white, W, H)
            method = "haarcascade_fallback"
    else:
        # クロップ・ズームピラミッド走査による MediaPipe 検出
        feat = detect_mediapipe_multiscale(bgr, W, H)
        method = "mediapipe_multiscale"
        
        if feat is None:
            bgr_white = composite_on_white(img)
            feat = detect_haarcascade(bgr_white, W, H)
            method = "haarcascade_fallback"

    if feat is not None:
        print(json.dumps({
            "success": True,
            "fallback": False,
            "faceX": round(feat["oval_cx"], 1),
            "faceY": round(feat["oval_cy"], 1),
            "faceWidth": round(feat["oval_w"], 1),
            "faceHeight": round(feat["oval_h"], 1),
            "candidates": feat.get("candidates", []),
            "method": method,
            "baseWidth": W,
            "baseHeight": H
        }))
    else:
        # 検出失敗時のデフォルト標準フォールバック
        # 顔の位置が 19.1% にある今回のマスコットの特性を考慮し、デフォルトのYをやや上に調整 (20%)
        print(json.dumps({
            "success": True,
            "fallback": True,
            "faceX": round(W / 2.0, 1),
            "faceY": round(H * 0.20, 1),
            "faceWidth": round(W * 0.16, 1),
            "faceHeight": round(H * 0.16, 1),
            "method": "fallback",
            "baseWidth": W,
            "baseHeight": H
        }))

if __name__ == "__main__":
    main()
