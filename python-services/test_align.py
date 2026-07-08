#!/usr/bin/env python3
import sys
import os
import json
import cv2
import numpy as np

def imread_unicode(path: str, flags=cv2.IMREAD_UNCHANGED) -> np.ndarray | None:
    try:
        nparr = np.fromfile(path, dtype=np.uint8)
        return cv2.imdecode(nparr, flags)
    except Exception as e:
        print(f"Failed to read unicode path {path}: {e}")
        return None

def main():
    # テスト対象の画像パス (ユーザー環境に存在するパス)
    base_path = "../storage/users/usr_local_dev_bypass/mascots/mascot_1782323868086/outfits/outfit_1782323954034_g89sy.png"
    expr_path = "../storage/users/usr_local_dev_bypass/mascots/mascot_1782323868086/expressions/working/1782926236137/expr_通常.png"
    
    if not os.path.exists(base_path) or not os.path.exists(expr_path):
        print(f"Test images not found.\nBase: {base_path}\nExpr: {expr_path}")
        return

    # align_expression.py をサブプロセスで呼び出す
    import subprocess
    cmd = [
        ".venv/Scripts/python", "align_expression.py",
        "--base", base_path,
        "--expression", expr_path,
        "--mode", "anime"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("align_expression.py failed:", result.stderr)
        return
        
    align_data = json.loads(result.stdout.strip())
    print("Alignment Result Parameters:")
    print(json.dumps(align_data, indent=2))
    
    if not align_data["success"]:
        print("Alignment execution returned success=False")
        return
        
    # 算出したパラメータで画像を合成してプレビュー画像を出力する
    base_img = imread_unicode(base_path, cv2.IMREAD_UNCHANGED)
    expr_img = imread_unicode(expr_path, cv2.IMREAD_UNCHANGED)
    
    H_base, W_base = base_img.shape[:2]
    H_expr, W_expr = expr_img.shape[:2]
    
    # ユーザーがステップ1で手作業で調整した正確な顔の中心点 (正解アライメント基準)
    baseCx = 815.6
    baseCy = 368.0
    
    exprCx = align_data.get("exprOvalCX", W_expr / 2.0)
    exprCy = align_data.get("exprOvalCY", H_expr * 0.48)
    scale = align_data["scale"]
    
    # 調整後のアライメント座標再計算
    offsetX = (baseCx - W_base / 2.0) - (exprCx - W_expr / 2.0) * scale
    offsetY = (baseCy - H_base / 2.0) - (exprCy - H_expr / 2.0) * scale
    
    # 表情パーツの拡大縮小
    new_w = int(W_expr * scale)
    new_h = int(H_expr * scale)
    expr_resized = cv2.resize(expr_img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    # 合成位置の算出 (中心基準でアライメント)
    cx_base = W_base / 2.0
    cy_base = H_base / 2.0
    
    x_start = int(cx_base - new_w / 2.0 + offsetX)
    y_start = int(cy_base - new_h / 2.0 + offsetY)
    
    # 背景に合成 (アルファブレンド)
    preview = base_img.copy()
    if preview.shape[2] != 4:
        preview = cv2.cvtColor(preview, cv2.COLOR_BGR2BGRA)
        
    for y in range(new_h):
        for x in range(new_w):
            py = y_start + y
            px = x_start + x
            if 0 <= py < H_base and 0 <= px < W_base:
                alpha = expr_resized[y, x, 3] / 255.0
                if alpha > 0:
                    preview[py, px, :3] = (
                        expr_resized[y, x, :3] * alpha + 
                        preview[py, px, :3] * (1.0 - alpha)
                    )
                    preview[py, px, 3] = max(preview[py, px, 3], expr_resized[y, x, 3])
                    
    preview_output_path = "../storage/users/usr_local_dev_bypass/mascots/mascot_1782323868086/aligned_preview.png"
    cv2.imwrite(preview_output_path, preview)
    print(f"\nPreview composition success! Saved to: {os.path.abspath(preview_output_path)}")

if __name__ == "__main__":
    main()
