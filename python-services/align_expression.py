#!/usr/bin/env python3
import sys
import json
import argparse
import urllib.request
from pathlib import Path
import numpy as np
import cv2

# detect_face_mask.py と同じモデルを共有
_MODELS_DIR = Path(__file__).parent / "models"
_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

# MediaPipe Face Mesh の顔輪郭（Face Oval）ランドマークインデックス (36個)
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
    """透過 PNG を白背景に合成して BGR を返す（顔特徴が引き立つ）。"""
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
            min_face_detection_confidence=0.05,
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

        rx = lm[468].x * W
        ry = lm[468].y * H
        lx = lm[473].x * W
        ly = lm[473].y * H
        nx = lm[1].x * W
        ny = lm[1].y * H
        mx = (lm[13].x + lm[14].x) / 2.0 * W
        my = (lm[13].y + lm[14].y) / 2.0 * H

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

def detect_mediapipe(bgr: np.ndarray, W: int, H: int, crop=True) -> dict | None:
    """立ち絵画像全体から顔部分をマルチスケール・スキャンして検出する"""
    if not crop:
        return detect_mediapipe_on_raw(bgr, W, H)
        
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
        
        crop_img = bgr[y1:y2, x1:x2]
        if crop_img.size == 0:
            continue
            
        cH, cW = crop_img.shape[:2]
        zoom = cv2.resize(crop_img, (cW * 2, cH * 2), interpolation=cv2.INTER_CUBIC)
        zH, zW = zoom.shape[:2]
        
        feat = detect_mediapipe_on_raw(zoom, zW, zH)
        if feat is not None:
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

def detect_haarcascade(bgr: np.ndarray, W: int, H: int, crop=True) -> dict | None:
    if crop:
        c_left = int(W * 0.15)
        c_right = int(W * 0.85)
        c_top = 0
        c_bottom = int(H * 0.45)
    else:
        c_left, c_right, c_top, c_bottom = 0, W, 0, H
    
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
        lx_c = ex1 + ew1 / 2.0
        ly_c = ey1 + eh1 / 2.0
        rx_c = ex2 + ew2 / 2.0
        ry_c = ey2 + eh2 / 2.0
        
        lx = lx_c + c_left
        ly = ly_c + c_top
        rx = rx_c + c_left
        ry = ry_c + c_top
        
        # 簡易的に目の幅からダミーの輪郭パラメータを計算
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

def detect_animeface(bgr: np.ndarray, W: int, H: int, crop=True) -> dict | None:
    if not ensure_animeface_model():
        return None
    try:
        cascade = cv2.CascadeClassifier(str(ANIMEFACE_CASCADE_PATH))
        
        if crop:
            c_left = int(W * 0.10)
            c_right = int(W * 0.90)
            c_top = 0
            c_bottom = int(H * 0.50)
        else:
            c_left, c_right, c_top, c_bottom = 0, W, 0, H
            
        crop_img = bgr[c_top:c_bottom, c_left:c_right]
        gray = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        faces = cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=2,
            minSize=(int(W * 0.03), int(H * 0.03))
        )
        if len(faces) > 0:
            faces = sorted(faces, key=lambda f: abs((f[0] + f[2]/2.0) - (c_right - c_left)/2.0))
            x, y, w, h = faces[0]
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


def imread_unicode(path: str, flags=cv2.IMREAD_UNCHANGED) -> np.ndarray | None:
    try:
        nparr = np.fromfile(path, dtype=np.uint8)
        return cv2.imdecode(nparr, flags)
    except Exception as e:
        print(f"Failed to read unicode path {path}: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Path to base image (noface)")
    parser.add_argument("--expression", required=True, help="Path to expression cropped image")
    parser.add_argument("--mode", default="ai", choices=["ai", "anime"], help="Detection mode (ai or anime)")
    args = parser.parse_args()

    # 画像ロード
    base_img = imread_unicode(args.base, cv2.IMREAD_UNCHANGED)
    expr_img = imread_unicode(args.expression, cv2.IMREAD_UNCHANGED)

    if base_img is None or expr_img is None:
        print(json.dumps({"success": False, "error": "Failed to load images"}))
        return

    H_base, W_base = base_img.shape[:2]
    H_expr, W_expr = expr_img.shape[:2]

    # アルファチャンネル処理
    if base_img.ndim == 2:
        base_img = cv2.cvtColor(base_img, cv2.COLOR_GRAY2BGRA)
    elif base_img.shape[2] == 3:
        base_img = cv2.cvtColor(base_img, cv2.COLOR_BGR2BGRA)
        
    bgr_base = base_img[:, :, :3]

    if expr_img.ndim == 2:
        expr_img = cv2.cvtColor(expr_img, cv2.COLOR_GRAY2BGRA)
    elif expr_img.shape[2] == 3:
        expr_img = cv2.cvtColor(expr_img, cv2.COLOR_BGR2BGRA)
        
    bgr_expr = composite_on_white(expr_img)

    feat_base = None
    method_base = args.mode
    if args.mode == "anime":
        feat_base = detect_animeface(bgr_base, W_base, H_base, crop=True)
        method_base = "animeface"
        if feat_base is None:
            bgr_white_base = composite_on_white(base_img)
            feat_base = detect_haarcascade(bgr_white_base, W_base, H_base, crop=True)
            method_base = "haarcascade_fallback"
    else:
        feat_base = detect_mediapipe(bgr_base, W_base, H_base, crop=True)
        method_base = "mediapipe_multiscale"
        if feat_base is None:
            bgr_white_base = composite_on_white(base_img)
            feat_base = detect_haarcascade(bgr_white_base, W_base, H_base, crop=True)
            method_base = "haarcascade_fallback"

    # 2. 表情パーツ画像の顔特徴点検出
    feat_expr = None
    method_expr = args.mode
    if args.mode == "anime":
        feat_expr = detect_animeface(bgr_expr, W_expr, H_expr, crop=False)
        method_expr = "animeface"
        if feat_expr is None:
            feat_expr = detect_haarcascade(bgr_expr, W_expr, H_expr, crop=False)
            method_expr = "haarcascade_fallback"
    else:
        feat_expr = detect_mediapipe(bgr_expr, W_expr, H_expr, crop=False)
        method_expr = "mediapipe"
        if feat_expr is None:
            feat_expr = detect_haarcascade(bgr_expr, W_expr, H_expr, crop=False)
            method_expr = "haarcascade_fallback"

    # 3. アライメントパラメータ算出
    is_base_fallback = (feat_base is None)
    is_expr_fallback = (feat_expr is None)

    # 3-1. 特徴点位置の確定
    if not is_base_fallback:
        lx_b, ly_b = feat_base["lx"], feat_base["ly"]
        rx_b, ry_b = feat_base["rx"], feat_base["ry"]
        nx_b, ny_b = feat_base["nx"], feat_base["ny"]
        mx_b, my_b = feat_base["mx"], feat_base["my"]
        oval_cx_b, oval_cy_b = feat_base["oval_cx"], feat_base["oval_cy"]
        oval_w_b, oval_h_b = feat_base["oval_w"], feat_base["oval_h"]
    else:
        # フォールバック (目の中心・鼻・口・輪郭の標準位置)
        lx_b, ly_b = W_base * 0.46, H_base * 0.25
        rx_b, ry_b = W_base * 0.54, H_base * 0.25
        nx_b, ny_b = W_base * 0.50, H_base * 0.282
        mx_b, my_b = W_base * 0.50, H_base * 0.31
        oval_cx_b, oval_cy_b = W_base * 0.50, H_base * 0.282
        oval_w_b, oval_h_b = W_base * 0.16, H_base * 0.18
        
    if not is_expr_fallback:
        lx_e, ly_e = feat_expr["lx"], feat_expr["ly"]
        rx_e, ry_e = feat_expr["rx"], feat_expr["ry"]
        nx_e, ny_e = feat_expr["nx"], feat_expr["ny"]
        mx_e, my_e = feat_expr["mx"], feat_expr["my"]
        oval_cx_e, oval_cy_e = feat_expr["oval_cx"], feat_expr["oval_cy"]
        oval_w_e, oval_h_e = feat_expr["oval_w"], feat_expr["oval_h"]
    else:
        # フォールバック
        lx_e, ly_e = W_expr * 0.39, H_expr * 0.393
        rx_e, ry_e = W_expr * 0.61, H_expr * 0.393
        nx_e, ny_e = W_expr * 0.50, H_expr * 0.48
        mx_e, my_e = W_expr * 0.50, H_expr * 0.56
        oval_cx_e, oval_cy_e = W_expr * 0.50, H_expr * 0.48
        oval_w_e, oval_h_e = W_expr * 0.45, H_expr * 0.50

    # 3-2. スケール(比率)の決定 (顔の輪郭の大きさを最優先し、補助として目幅を使用)
    if not is_base_fallback and not is_expr_fallback:
        # 輪郭の横幅比率と縦幅比率の平均をスケールとする (目口の形状変化に一切影響されないため極めて強固)
        scale_w = oval_w_b / oval_w_e
        scale_h = oval_h_b / oval_h_e
        scale = (scale_w + scale_h) / 2.0
    else:
        scale = abs(rx_b - lx_b) / abs(rx_e - lx_e)

    # スケールガードレール
    scale = max(0.4, min(2.5, scale))

    # 3-3. オフセット量の決定 (輪郭の重心を最優先基準にする)
    cx_b, cy_b = W_base / 2.0, H_base / 2.0
    cx_e, cy_e = W_expr / 2.0, H_expr / 2.0

    mid_x_b, mid_y_b = (lx_b + rx_b) / 2.0, (ly_b + ry_b) / 2.0
    mid_x_e, mid_y_e = (lx_e + rx_e) / 2.0, (ly_e + ry_e) / 2.0

    if not is_base_fallback and not is_expr_fallback:
        # 輪郭重心のアライメントずれ (表情に左右されない基準)
        offsetX = (oval_cx_b - cx_b) - (oval_cx_e - cx_e) * scale
        offsetY = (oval_cy_b - cy_b) - (oval_cy_e - cy_e) * scale
    else:
        # フォールバック：目の中心
        offsetX = (mid_x_b - cx_b) - (mid_x_e - cx_e) * scale
        offsetY = (mid_y_b - cy_b) - (mid_y_e - cy_e) * scale

    # 出力結果
    print(json.dumps({
        "success": True,
        "fallback": is_base_fallback or is_expr_fallback,
        "isBaseFallback": is_base_fallback,
        "isExprFallback": is_expr_fallback,
        "offsetX": round(offsetX, 1),
        "offsetY": round(offsetY, 1),
        "scale": round(scale, 3),
        "exprMidX": round(mid_x_e, 1),
        "exprMidY": round(mid_y_e, 1),
        "exprOvalCX": round(oval_cx_e, 1),
        "exprOvalCY": round(oval_cy_e, 1),
        "exprEyeDist": round(abs(rx_e - lx_e), 1),
        "exprOvalW": round(oval_w_e, 1),
        "method": f"base:{method_base if not is_base_fallback else 'fallback'}_expr:{method_expr if not is_expr_fallback else 'fallback'}",
        "baseWidth": W_base,
        "baseHeight": H_base,
        "exprWidth": W_expr,
        "exprHeight": H_expr
    }))

if __name__ == "__main__":
    main()
