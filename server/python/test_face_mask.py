"""
顔マスク検出 + 合成パイプライン テスト

TypeScript golden-iou.test.ts と同等のパイプラインを Python で再現し、
両者の最終合成結果を比較する。

出力先: server/python/test_results/{outfit_1,outfit_2}/
  - expr_*_ellipse_mask.png  : Python マスク適用後スプライト
  - expr_*_synthesized.png   : Python パイプライン最終合成
  - expr_*_compare.png       : TS 合成 vs Python 合成 横並び比較

実行方法:
  cd server/python
  .venv/bin/python -m pytest test_face_mask.py -v
"""

import json
import subprocess
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import cv2
import pytest

# ---------------------------------------------------------------------------
# パス定数
# ---------------------------------------------------------------------------

HERE = Path(__file__).parent
REPO_ROOT = HERE.parent.parent
ASSETS_DIR = REPO_ROOT / "__tests__/expression-alignment/assets"
TS_RESULTS_DIR = REPO_ROOT / "packages/expression-alignment/__tests__/result"
RESULTS_DIR = HERE / "test_results"
PYTHON_BIN = HERE / ".venv/bin/python"
SCRIPT = HERE / "detect_face_mask.py"

PREVIEW_W = 420
PREVIEW_H = 420
EXPRESSION_BASE_SIZE = 140

# ---------------------------------------------------------------------------
# テストケース定義
# ---------------------------------------------------------------------------

OUTFITS = [
    {
        "id": "outfit_1",
        "emotions": ["喜び", "嫌悪", "好奇心", "怒り", "混乱"],
        "trimmed": lambda em: f"expr_{em}_trimmed.png",
    },
    {
        "id": "outfit_2",
        "emotions": ["喜び", "嫌悪", "好奇心", "怒り", "混乱"],
        # outfit_2 の好奇心は typo "trimed"
        "trimmed": lambda em: f"expr_{em}_trimed.png" if em == "好奇心" else f"expr_{em}_trimmed.png",
    },
]

CASES = [
    (outfit["id"], em, outfit["trimmed"])
    for outfit in OUTFITS
    for em in outfit["emotions"]
]

# ---------------------------------------------------------------------------
# 画像ロード / 保存
# ---------------------------------------------------------------------------

def load_bgra(path: Path) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    assert img is not None, f"Cannot load: {path}"
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img

def save_png(img_bgra: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), img_bgra)

def composite_on_gray(bgra: np.ndarray) -> np.ndarray:
    """BGRA → グレー背景合成 BGR"""
    alpha = bgra[:, :, 3:4].astype(np.float32) / 255.0
    bgr = bgra[:, :, :3].astype(np.float32)
    bg = np.full_like(bgr, 128.0)
    return (bgr * alpha + bg * (1.0 - alpha)).clip(0, 255).astype(np.uint8)

# ---------------------------------------------------------------------------
# Step 1: Python detect_face_mask.py を呼び出す
# ---------------------------------------------------------------------------

def call_detect_face_mask(image_path: Path) -> dict:
    result = subprocess.run(
        [str(PYTHON_BIN), str(SCRIPT), str(image_path)],
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode in (0, 2), f"Script error: {result.stderr}"
    data = json.loads(result.stdout.strip())
    assert "error" not in data, f"Detection failed: {data['error']}"
    return data

# ---------------------------------------------------------------------------
# Step 2: BFS 顔マスク抽出（golden-iou.test.ts extractFaceMask 移植）
# ---------------------------------------------------------------------------

def extract_face_bfs(bgra: np.ndarray) -> np.ndarray:
    """境界 BFS で白背景・ラベルを除去し、顔コンテンツだけを返す。"""
    H, W = bgra.shape[:2]

    # ラベル開始行の検出（下から走査）
    label_start_y = H
    for y in range(H - 1, -1, -1):
        row = bgra[y, :, :3].astype(np.float32)
        max_c = row.max(axis=1)
        min_c = row.min(axis=1)
        colorful = np.sum((max_c - min_c > 20) & (max_c < 235) & (max_c > 30))
        if colorful / W >= 0.05:
            break
        label_start_y = y

    # BFS: 境界から r,g,b > 245 の白ピクセルを背景としてマーク
    bg = np.zeros(H * W, dtype=np.uint8)
    queue = []

    def seed(x, y):
        if x < 0 or x >= W or y < 0 or y >= label_start_y:
            return
        idx = y * W + x
        if bg[idx]:
            return
        r, g, b = bgra[y, x, 2], bgra[y, x, 1], bgra[y, x, 0]
        if r > 245 and g > 245 and b > 245:
            bg[idx] = 1
            queue.append((x, y))

    for x in range(W):
        seed(x, 0); seed(x, 1)
        seed(x, label_start_y - 1); seed(x, label_start_y - 2)
    for y in range(label_start_y):
        seed(0, y); seed(1, y)
        seed(W - 1, y); seed(W - 2, y)

    while queue:
        x, y = queue.pop()
        seed(x - 1, y); seed(x + 1, y)
        seed(x, y - 1); seed(x, y + 1)

    # ラベル行と外枠 near-black を背景に
    bg[label_start_y * W:] = 1
    BORDER = 2
    for y in range(label_start_y):
        for x in range(W):
            if x < BORDER or x >= W - BORDER or y < BORDER or y >= label_start_y - BORDER:
                r, g, b = bgra[y, x, 2], bgra[y, x, 1], bgra[y, x, 0]
                if r < 25 and g < 25 and b < 25:
                    bg[y * W + x] = 1

    out = np.zeros_like(bgra)
    mask_2d = (bg == 0).reshape(H, W)
    out[mask_2d] = bgra[mask_2d]
    return out

# ---------------------------------------------------------------------------
# Step 3: 楕円フェザーマスク（mask.ts applyEllipseFeatherMask 移植）
# ---------------------------------------------------------------------------

def apply_ellipse_mask(bgra: np.ndarray, mask: dict) -> np.ndarray:
    H, W = bgra.shape[:2]
    cx, cy = mask["centerX"], mask["centerY"]
    rx, ry = mask["radiusX"], mask["radiusY"]
    feather = mask["feather"]
    out = bgra.copy()

    feather_norm = max(0.0, feather) / min(rx, ry)
    ys, xs = np.mgrid[0:H, 0:W]
    dx = (xs - cx) / rx
    dy = (ys - cy) / ry
    d = np.sqrt(dx * dx + dy * dy)

    # 完全透明
    out[:, :, 3] = np.where(d >= 1, 0, out[:, :, 3])
    # フェザー帯
    if feather_norm > 0:
        in_feather = (d >= 1 - feather_norm) & (d < 1)
        alpha_factor = (1 - d) / feather_norm
        out[:, :, 3] = np.where(
            in_feather,
            (out[:, :, 3].astype(np.float32) * alpha_factor).clip(0, 255).astype(np.uint8),
            out[:, :, 3],
        )
    return out

# ---------------------------------------------------------------------------
# Step 4: ORB 登録 + 相似変換推定（registration-opencv.ts + similarity.ts 移植）
# ---------------------------------------------------------------------------

@dataclass
class SimilarityTransform:
    scale: float
    rotation: float  # degrees
    tx: float
    ty: float

def register_orb(base_bgra: np.ndarray, sprite_bgra: np.ndarray) -> SimilarityTransform | None:
    """ORB + Lowe 比率テスト + estimateAffinePartial2D で相似変換を推定。"""
    base_gray = cv2.cvtColor(composite_on_gray(base_bgra), cv2.COLOR_BGR2GRAY)
    sprite_gray = cv2.cvtColor(composite_on_gray(sprite_bgra), cv2.COLOR_BGR2GRAY)

    orb = cv2.ORB_create(nfeatures=1500)
    kp_base, des_base = orb.detectAndCompute(base_gray, None)
    kp_sprite, des_sprite = orb.detectAndCompute(sprite_gray, None)

    if des_base is None or des_sprite is None:
        return None

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    knn = bf.knnMatch(des_sprite, des_base, k=2)

    good = [m for m, n in knn if m.distance < 0.75 * n.distance]
    if len(good) < 4:
        return None

    src_pts = np.float32([kp_sprite[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp_base[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

    M, inliers = cv2.estimateAffinePartial2D(
        src_pts, dst_pts, method=cv2.RANSAC, ransacReprojThreshold=3.0
    )
    if M is None:
        # フォールバック: estimateSimilarityTransform を全 good ペアで計算
        return _estimate_similarity_from_pairs(
            [(kp_sprite[m.queryIdx].pt, kp_base[m.trainIdx].pt) for m in good]
        )

    a, b = M[0, 0], M[1, 0]
    scale = math.sqrt(a * a + b * b)
    rotation = math.degrees(math.atan2(b, a))
    return SimilarityTransform(scale=scale, rotation=rotation, tx=M[0, 2], ty=M[1, 2])


def _estimate_similarity_from_pairs(pairs: list) -> SimilarityTransform | None:
    """similarity.ts estimateSimilarityTransform の Python 移植。"""
    n = len(pairs)
    if n < 2:
        return None
    mpx = sum(p[0] for p, _ in pairs) / n
    mpy = sum(p[1] for p, _ in pairs) / n
    mqx = sum(q[0] for _, q in pairs) / n
    mqy = sum(q[1] for _, q in pairs) / n

    a = b = var_p = 0.0
    for (px, py), (qx, qy) in pairs:
        px -= mpx; py -= mpy; qx -= mqx; qy -= mqy
        a += px * qx + py * qy
        b += px * qy - py * qx
        var_p += px * px + py * py

    if var_p == 0:
        return None

    scale = math.sqrt(a * a + b * b) / var_p
    theta = math.atan2(b, a)
    cos_, sin_ = math.cos(theta), math.sin(theta)
    tx = mqx - scale * (cos_ * mpx - sin_ * mpy)
    ty = mqy - scale * (sin_ * mpx + cos_ * mpy)
    return SimilarityTransform(scale=scale, rotation=math.degrees(theta), tx=tx, ty=ty)

# ---------------------------------------------------------------------------
# Step 5: pixelTransformToEditor（similarity.ts 移植）
# ---------------------------------------------------------------------------

def pixel_transform_to_editor(t: SimilarityTransform, sprite_w: int, sprite_h: int,
                               base_fit_scale: float, base_w: int) -> dict:
    sprite_cx = sprite_w / 2
    sprite_cy = sprite_h / 2
    theta = math.radians(t.rotation)
    cos_, sin_ = math.cos(theta), math.sin(theta)

    # スプライト中心をベース座標系に変換
    tx_center = t.scale * (cos_ * sprite_cx - sin_ * sprite_cy) + t.tx
    ty_center = t.scale * (sin_ * sprite_cx + cos_ * sprite_cy) + t.ty

    base_offset_x = (PREVIEW_W - base_w * base_fit_scale) / 2
    preview_x = tx_center * base_fit_scale + base_offset_x
    preview_y = ty_center * base_fit_scale

    offset_x = preview_x - PREVIEW_W / 2
    offset_y = preview_y - PREVIEW_H / 2
    display_scale = t.scale * base_fit_scale * max(sprite_w, sprite_h) / EXPRESSION_BASE_SIZE

    return {
        "offsetX": round(offset_x),
        "offsetY": round(offset_y),
        "scale": round(display_scale * 100) / 100,
        "rotation": round(t.rotation * 100) / 100,
    }

# ---------------------------------------------------------------------------
# Step 6: 合成（golden-iou.test.ts synthesizeComposite 移植）
# ---------------------------------------------------------------------------

def synthesize_composite(base_bgra: np.ndarray, sprite_bgra: np.ndarray,
                          editor: dict, base_fit_scale: float) -> np.ndarray:
    canvas = np.full((PREVIEW_H, PREVIEW_W, 3), 128, dtype=np.uint8)

    # ベース画像を配置
    base_bgr = composite_on_gray(base_bgra)
    bH, bW = base_bgra.shape[:2]
    fw = round(bW * base_fit_scale)
    fh = round(bH * base_fit_scale)
    base_resized = cv2.resize(base_bgr, (fw, fh))
    bx = (PREVIEW_W - fw) // 2
    by = (PREVIEW_H - fh) // 2
    canvas[by:by + fh, bx:bx + fw] = base_resized

    # スプライトを変換して重ね合わせ
    sH, sW = sprite_bgra.shape[:2]
    aspect = sW / sH
    draw_w = EXPRESSION_BASE_SIZE if aspect > 1 else EXPRESSION_BASE_SIZE * aspect
    draw_h = EXPRESSION_BASE_SIZE / aspect if aspect > 1 else EXPRESSION_BASE_SIZE
    draw_w = round(draw_w * editor["scale"])
    draw_h = round(draw_h * editor["scale"])
    if draw_w <= 0 or draw_h <= 0:
        return canvas

    sprite_resized = cv2.resize(sprite_bgra, (draw_w, draw_h), interpolation=cv2.INTER_AREA)

    # 回転
    angle = editor["rotation"]
    if abs(angle) > 0.1:
        M = cv2.getRotationMatrix2D((draw_w / 2, draw_h / 2), -angle, 1.0)
        sprite_resized = cv2.warpAffine(sprite_resized, M, (draw_w, draw_h),
                                         flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)

    # 配置中心
    cx = PREVIEW_W // 2 + editor["offsetX"]
    cy = PREVIEW_H // 2 + editor["offsetY"]
    x0 = cx - draw_w // 2
    y0 = cy - draw_h // 2

    # alpha blending
    for sy in range(draw_h):
        for sx in range(draw_w):
            px, py = x0 + sx, y0 + sy
            if 0 <= px < PREVIEW_W and 0 <= py < PREVIEW_H:
                alpha = sprite_resized[sy, sx, 3] / 255.0
                if alpha > 0:
                    canvas[py, px] = (
                        sprite_resized[sy, sx, :3] * alpha
                        + canvas[py, px] * (1 - alpha)
                    ).astype(np.uint8)

    return canvas

# ---------------------------------------------------------------------------
# IoU ユーティリティ
# ---------------------------------------------------------------------------

def mask_iou(img1: np.ndarray, img2: np.ndarray) -> float:
    """alpha > 0 ピクセルを「有効」とした IoU（mask.test.ts と同一）"""
    a1 = img1[:, :, 3] > 0
    a2 = img2[:, :, 3] > 0
    inter = np.sum(a1 & a2)
    union = np.sum(a1 | a2)
    return float(inter / union) if union > 0 else 0.0

def sprite_iou(img1: np.ndarray, img2: np.ndarray) -> float:
    """非背景ピクセル IoU（golden-iou.test.ts computeSpriteIoU と同一）"""
    def is_sprite(img):
        a = img[:, :, 3] >= 200
        bgr = img[:, :, :3].astype(np.int32)
        not_gray = ~((np.abs(bgr[:, :, 0] - 136) < 25) &
                     (np.abs(bgr[:, :, 1] - 136) < 25) &
                     (np.abs(bgr[:, :, 2] - 136) < 25))
        not_white = ~((bgr[:, :, 0] > 245) & (bgr[:, :, 1] > 245) & (bgr[:, :, 2] > 245))
        return a & not_gray & not_white
    s1 = is_sprite(img1)
    s2 = is_sprite(img2)
    inter = np.sum(s1 & s2)
    union = np.sum(s1 | s2)
    return float(inter / union) if union > 0 else 0.0

# ---------------------------------------------------------------------------
# テスト本体
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("outfit_id,emotion,trimmed_fn", CASES)
def test_face_mask_pipeline(outfit_id: str, emotion: str, trimmed_fn):
    outfit_dir = ASSETS_DIR / outfit_id
    result_dir = RESULTS_DIR / outfit_id
    ts_result_dir = TS_RESULTS_DIR / outfit_id

    sprite_path = outfit_dir / f"expr_{emotion}.png"
    trimmed_path = outfit_dir / trimmed_fn(emotion)
    ok_path = outfit_dir / f"expr_{emotion}_OK.png"
    base_path = outfit_dir / f"{outfit_id}.png"

    # 画像ロード
    sprite_bgra = load_bgra(sprite_path)
    trimmed_bgra = load_bgra(trimmed_path)
    ok_bgra = load_bgra(ok_path)
    base_bgra = load_bgra(base_path)

    bH, bW = base_bgra.shape[:2]
    base_fit_scale = min(PREVIEW_W / bW, PREVIEW_H / bH)

    # Step 1: Python 検出
    mask_params = call_detect_face_mask(sprite_path)
    print(f"\n[{outfit_id}/{emotion}] method={mask_params['method']} "
          f"cx={mask_params['centerX']} cy={mask_params['centerY']} "
          f"rx={mask_params['radiusX']} ry={mask_params['radiusY']}")

    # Step 2 & 3: BFS + 楕円マスク
    face_mask_bgra = extract_face_bfs(sprite_bgra)
    ellipse_bgra = apply_ellipse_mask(face_mask_bgra, mask_params)
    save_png(ellipse_bgra, result_dir / f"expr_{emotion}_ellipse_mask.png")

    # IoU vs _trimmed.png
    iou = mask_iou(ellipse_bgra, trimmed_bgra)
    print(f"[{outfit_id}/{emotion}] ellipse maskIoU={iou:.3f}")

    # Step 4 & 5: ORB 登録 + エディタパラメータ算出
    transform = register_orb(base_bgra, sprite_bgra)
    if transform is None:
        # ORB 失敗時フォールバック: outfit平均的な変換パラメータを使用
        transform = SimilarityTransform(scale=0.44, rotation=0.0, tx=0.0, ty=0.0)
        print(f"[{outfit_id}/{emotion}] ORB failed — using fallback transform")
    print(f"[{outfit_id}/{emotion}] scale={transform.scale:.3f} rot={transform.rotation:.1f}°")

    sH, sW = sprite_bgra.shape[:2]
    editor = pixel_transform_to_editor(transform, sW, sH, base_fit_scale, bW)
    print(f"[{outfit_id}/{emotion}] editor off=({editor['offsetX']},{editor['offsetY']}) "
          f"scale={editor['scale']:.3f}")

    # Step 6: 合成
    synthesized_bgra = synthesize_composite(base_bgra, ellipse_bgra, editor, base_fit_scale)
    # canvas は BGR なので BGRA に変換して保存
    synthesized_bgra_out = cv2.cvtColor(synthesized_bgra, cv2.COLOR_BGR2BGRA)
    save_png(synthesized_bgra_out, result_dir / f"expr_{emotion}_synthesized.png")

    # OK.png との IoU
    ok_bgr = composite_on_gray(ok_bgra)
    ok_padded_bgr = np.full((PREVIEW_H, PREVIEW_W, 3), 128, dtype=np.uint8)
    base_offset_x = round((PREVIEW_W - bW * base_fit_scale) / 2)
    base_offset_y = round((PREVIEW_H - bH * base_fit_scale) / 2)
    ok_fit_w = round(ok_bgra.shape[1])
    ok_fit_h = round(ok_bgra.shape[0])
    ox, oy = base_offset_x, base_offset_y
    ok_padded_bgr[oy:oy + ok_fit_h, ox:ox + ok_fit_w] = ok_bgr[:ok_fit_h, :ok_fit_w]
    save_png(cv2.cvtColor(ok_padded_bgr, cv2.COLOR_BGR2BGRA),
             result_dir / f"expr_{emotion}_OK_padded.png")

    # 横並び比較画像（TS 合成 vs Python 合成）
    ts_synth_path = ts_result_dir / f"expr_{emotion}_synthesized.png"
    if ts_synth_path.exists():
        ts_synth = cv2.imread(str(ts_synth_path))
        if ts_synth is not None:
            label_h = 30
            compare_h = PREVIEW_H + label_h
            compare_w = PREVIEW_W * 2
            compare = np.full((compare_h, compare_w, 3), 200, dtype=np.uint8)
            compare[label_h:, :PREVIEW_W] = ts_synth[:PREVIEW_H, :PREVIEW_W]
            compare[label_h:, PREVIEW_W:] = synthesized_bgra[:PREVIEW_H, :PREVIEW_W]
            cv2.putText(compare, "TypeScript (BFS)", (10, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
            cv2.putText(compare, f"Python ({mask_params['method']})", (PREVIEW_W + 10, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
            save_png(cv2.cvtColor(compare, cv2.COLOR_BGR2BGRA),
                     result_dir / f"expr_{emotion}_compare.png")

    # アサーション
    assert iou > 0.40, f"ellipse maskIoU={iou:.3f} < 0.40 ({outfit_id}/{emotion})"
