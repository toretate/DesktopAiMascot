#!/usr/bin/env python3
"""
手動レタッチ（修復ブラシ / 消しゴム）処理スクリプト

UIからのドラッグ座標・半径を受け取り、画像に対して消しゴム（透過）または修復ブラシ（肌色塗りつぶし）を適用する。
"""

import sys
import json
import argparse
import numpy as np
import cv2

def load_rgba(path: str) -> np.ndarray | None:
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img

def get_brush_color(img: np.ndarray, x: int, y: int, r: int) -> tuple:
    """指定座標の周囲の肌色ピクセルから平均色を取得"""
    h, w = img.shape[:2]
    # ブラシ領域の少し外側から肌色をサンプリング
    x1, x2 = max(0, x - r - 5), min(w, x + r + 5)
    y1, y2 = max(0, y - r - 5), min(h, y + r + 5)
    
    roi = img[y1:y2, x1:x2]
    mask = roi[:, :, 3] > 0
    if not np.any(mask):
        return (255, 255, 255)
        
    avg_color = roi[mask][:, :3].mean(axis=0)
    return (int(avg_color[0]), int(avg_color[1]), int(avg_color[2]))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_path", help="編集対象画像のパス")
    parser.add_argument("output_path", help="出力先画像のパス")
    parser.add_argument("tool", choices=["brush", "eraser"], help="使用ツール (brush または eraser)")
    parser.add_argument("x", type=int, help="レタッチ中心X座標")
    parser.add_argument("y", type=int, help="レタッチ中心Y座標")
    parser.add_argument("radius", type=int, help="ブラシ半径 (px)")
    args = parser.parse_args()

    img = load_rgba(args.input_path)
    if img is None:
        print(json.dumps({"success": False, "error": f"Failed to load image: {args.input_path}"}))
        sys.exit(1)

    h, w = img.shape[:2]
    cx, cy, r = args.x, args.y, args.radius

    if args.tool == "eraser":
        # 消しゴム：アルファチャンネルを 0 にして円領域を透明にする
        # 境界をスムーズにするためにマスクを作成し、アルファに合成する
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.circle(mask, (cx, cy), r, 255, -1)
        
        # ぼかし（フェザー）をかけて滑らかに消す
        if r > 3:
            mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=r/3, sigmaY=r/3)
            
        # アルファを削減
        img[:, :, 3] = np.minimum(img[:, :, 3], 255 - mask)
        
    elif args.tool == "brush":
        # 修復ブラシ：周辺の肌色を取得して塗りつぶす
        brush_color = get_brush_color(img, cx, cy, r)
        b, g, gr = brush_color
        
        # 境界が馴染むようにソフトマスクを作成
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.circle(mask, (cx, cy), r, 255, -1)
        if r > 3:
            mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=r/3, sigmaY=r/3)
            
        # ソフトブレンドで塗りつぶし
        blend_mask = mask.astype(float) / 255.0
        for c in range(3):
            img[:, :, c] = (img[:, :, c] * (1.0 - blend_mask) + bgr_val * blend_mask).clip(0, 255)
        
        # BGRの変数が `brush_color` から取得したもの
        bgr_val = np.array([b, g, gr], dtype=float)
        # 上のループを修正：
        for c in range(3):
            img[:, :, c] = (img[:, :, c] * (1.0 - blend_mask) + bgr_val[c] * blend_mask).clip(0, 255)
            
        # アルファチャンネルは維持（または塗りつぶし領域が透明なら少し半透明に持ち上げる）
        img[:, :, 3] = np.maximum(img[:, :, 3], (blend_mask * 255).astype(np.uint8))

    cv2.imwrite(args.output_path, img)
    print(json.dumps({"success": True, "outputPath": args.output_path}))

if __name__ == "__main__":
    main()
