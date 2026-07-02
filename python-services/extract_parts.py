#!/usr/bin/env python3
"""
表情パーツ精密抽出スクリプト（キャンバス中心配置＆高感度XOR差分＆外郭穴埋めハイブリッド版）

実写向け MediaPipe ではアニメ顔の巨大なデフォルメ目や眉をカバーしきれず、サイズが小さく削られてしまう問題を解決します。
イラスト本来の目の大きさ・眉毛の形状を100%完璧に維持しつつ、白目抜けや背景の映り込みを防ぎます：
  1. 変形前の画像アルファ（不透明部）から、髪の毛先や服の最外周のズレノイズをシャットアウトする「境界除外マスク (25px縮小)」を生成。
  2. 表情画像 (img_expr) と境界除外マスクの両方を、全身サイズキャンバス (W, H = 922x1152) の真ん中（中心）に配置します。
  3. キャンバス中心をピボットとして、ユーザー調整アライメント (M) を適用します。
     - これにより、全身のっぺらぼうと表情の顔位置がミリピクセル単位で完璧に合致します。
  4. 合致したアライメント済み表情画像と、ベースのっぺらぼう画像の絶対カラー差分（XOR）を計算。
     - 差分しきい値は高感度（しきい値 6）に設定し、細い眉毛や目元の淡いラインも確実にピクセル単位で捉えます。
     - アライメントが完全に合致したため、髪や服などの差分は0になり、映り込みません。
  5. アライメント済み「境界除外マスク」の内部だけで差分を残します（最外周ノイズの完全排除）。
  6. 差分マスクから最も外側の輪郭（cv2.RETR_EXTERNAL）を検出。
     - 面積150ピクセル以上の主要パーツ（目、眉、口）の輪郭内部を完全に白(255)で塗りつぶす (Contour Filling) ことで、
       白目や瞳のハイライト部分を元の目の大きさのまま100%不透明に穴埋めします。
  7. 透過PNG保存。
"""

import sys
import json
import argparse
import os
import numpy as np
import cv2

def load_rgba(path):
    try:
        if not os.path.exists(path):
            print(f"[Error] File does not exist: {path}", file=sys.stderr)
            return None
        with open(path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_UNCHANGED)
        if img is None:
            return None
        if img.ndim == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
        elif img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        return img
    except Exception as e:
        print(f"[Error] Failed to load image {path}: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser(description="表情パーツの精密抽出（キャンバス中心配置・高感度XOR・外郭穴埋めハイブリッド版）")
    parser.add_argument("--noface", required=True, help="のっぺらぼうベース画像のパス")
    parser.add_argument("--expression", required=True, help="表情画像のパス")
    parser.add_argument("--output", required=True, help="出力パーツ画像（透過PNG）の保存先パス")
    parser.add_argument("--offset-x", type=float, default=0.0, help="X方向オフセット")
    parser.add_argument("--offset-y", type=float, default=0.0, help="Y方向オフセット")
    parser.add_argument("--scale", type=float, default=1.0, help="拡大率")
    parser.add_argument("--rotation", type=float, default=0.0, help="回転角度")
    args = parser.parse_args()

    # 画像のロード
    img_noface = load_rgba(args.noface)
    img_expr = load_rgba(args.expression)

    if img_noface is None:
        print(json.dumps({"success": False, "error": f"Cannot load noface image: {args.noface}"}))
        sys.exit(1)
    if img_expr is None:
        print(json.dumps({"success": False, "error": f"Cannot load expression image: {args.expression}"}))
        sys.exit(1)

    H, W = img_noface.shape[:2]
    eh, ew = img_expr.shape[:2]

    # 1. 表情画像 (ew, eh) を全身キャンバス (W, H) の真ん中（中心）に配置
    img_expr_canvas = np.zeros((H, W, 4), dtype=np.uint8)
    tx = int(W / 2.0 - ew / 2.0)
    ty = int(H / 2.0 - eh / 2.0)
    x1 = max(0, tx)
    y1 = max(0, ty)
    x2 = min(W, tx + ew)
    y2 = min(H, ty + eh)
    
    img_expr_canvas[y1:y2, x1:x2] = img_expr[0:(y2-y1), 0:(x2-x1)]

    # 2. 変形前の境界除外マスク (25px縮小) の生成と中心配置
    alpha = img_expr[:, :, 3]
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    mask_eroded = cv2.erode(alpha, kernel_erode, iterations=1)
    
    mask_canvas = np.zeros((H, W), dtype=np.uint8)
    mask_canvas[y1:y2, x1:x2] = mask_eroded[0:(y2-y1), 0:(x2-x1)]

    # 3. アライメント用アフィン変換の適用（キャンバス中心を基準に変形）
    center = (W / 2.0, H / 2.0)
    M = cv2.getRotationMatrix2D(center, args.rotation, args.scale)
    M[0, 2] += args.offset_x
    M[1, 2] += args.offset_y
    
    img_expr_aligned = cv2.warpAffine(
        img_expr_canvas, 
        M, 
        (W, H), 
        flags=cv2.INTER_LANCZOS4, 
        borderMode=cv2.BORDER_CONSTANT, 
        borderValue=(0, 0, 0, 0)
    )
    
    mask_aligned = cv2.warpAffine(
        mask_canvas, 
        M, 
        (W, H), 
        flags=cv2.INTER_NEAREST, 
        borderMode=cv2.BORDER_CONSTANT, 
        borderValue=0
    )

    # 4. アライメント後の画像同士のカラー絶対値差分（XOR）を計算
    diff = cv2.absdiff(img_expr_aligned, img_noface)
    diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGRA2GRAY)
    
    # しきい値 6 で二値化（眉毛などの細い線の差分もピクセル単位で漏らさず抽出）
    _, diff_mask = cv2.threshold(diff_gray, 6, 255, cv2.THRESH_BINARY)

    # 5. 「アライメント済み境界除外マスク」の内部だけで差分を残す
    diff_mask_in_face = cv2.bitwise_and(mask_aligned, diff_mask)

    # 6. 外郭穴埋め処理 (RETR_EXTERNAL による Contour Filling)
    # これにより、アニメ目の大きさ・形状をそのままになぞり、かつ白目やハイライトの透過穴を完全に塞ぎます。
    final_mask = np.zeros_like(diff_mask_in_face)
    contours, _ = cv2.findContours(diff_mask_in_face, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area >= 150:
            cv2.drawContours(final_mask, [cnt], -1, 255, -1)

    # 7. エッジを滑らかにするため膨張とフェザーぼかしを適用
    kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    final_mask_dilated = cv2.dilate(final_mask, kernel_dilate, iterations=1)
    
    feather = 8
    if feather > 0:
        final_mask_blur = cv2.GaussianBlur(final_mask_dilated, (feather * 2 + 1, feather * 2 + 1), 0)
    else:
        final_mask_blur = final_mask_dilated

    # 8. マスクに基づく透過切り出し
    parts_img = np.zeros_like(img_expr_aligned)
    parts_img[:, :, :3] = img_expr_aligned[:, :, :3]
    parts_img[:, :, 3] = (img_expr_aligned[:, :, 3].astype(np.float32) * (final_mask_blur.astype(np.float32) / 255.0)).astype(np.uint8)

    # 9. 不要な余白のトリミング
    non_zero = cv2.findNonZero(final_mask)
    if non_zero is not None:
        x, y, w, h = cv2.boundingRect(non_zero)
        margin = 15
        x_min = max(0, x - margin)
        y_min = max(0, y - margin)
        x_max = min(W, x + w + margin)
        y_max = min(H, y + h + margin)
        
        cropped_parts = parts_img[y_min:y_max, x_min:x_max]
    else:
        cropped_parts = parts_img

    # 出力フォルダの作成
    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    # 保存処理 (Unicode パス対応)
    try:
        ext = os.path.splitext(args.output)[1] or '.png'
        success, nparr = cv2.imencode(ext, cropped_parts)
        if not success:
            raise Exception("Failed to encode image array to bytes.")
        with open(args.output, 'wb') as f:
            f.write(nparr.tobytes())
            
        print(json.dumps({
            "success": True, 
            "outputPath": args.output,
            "width": cropped_parts.shape[1],
            "height": cropped_parts.shape[0],
            "method": "canvas-centered-erode-boundary-xor-contour-filled"
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to save output image: {str(e)}"}))
        sys.exit(2)

if __name__ == "__main__":
    main()
