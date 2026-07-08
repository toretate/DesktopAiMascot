#!/usr/bin/env python3
"""
テクスチャアトラスパッキングスクリプト

表情パーツ（目、口、ベース顔など）の画像を1枚の大きな画像 (例: 2048x2048) にパッキングし、
それぞれのパーツのアトラス上の座標、ピボット位置、配置オフセット情報を定義した atlas.json を生成します。

呼び出し方:
  python pack_atlas.py --mascot-dir /path/to/mascot --out-atlas atlas.png --out-json atlas.json --parts-json /path/to/parts_list.json
"""

import sys
import json
import argparse
import os
from pathlib import Path
from PIL import Image

class Rect:
    def __init__(self, x, y, w, h, name=None, original_img=None, offset=None):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.name = name
        self.original_img = original_img
        self.offset = offset or {"x": 0, "y": 0}

def pack_rects(rects, max_width=2048):
    """
    シンプルな二次元矩形パッキング（高さ優先ファーストフィット）
    """
    # 面積または高さ降順でソート
    sorted_rects = sorted(rects, key=lambda r: r.h, reverse=True)
    
    packed = []
    current_x = 0
    current_y = 0
    row_height = 0
    
    for r in sorted_rects:
        if current_x + r.w > max_width:
            # 次の行へ移動
            current_x = 0
            current_y += row_height
            row_height = 0
        
        r.x = current_x
        r.y = current_y
        packed.append(r)
        
        current_x += r.w
        row_height = max(row_height, r.h)
        
    total_height = current_y + row_height
    return packed, total_height

def main():
    parser = argparse.ArgumentParser(description="表情テクスチャアトラスの生成")
    parser.add_argument("--mascot-dir", required=True, help="マスコットフォルダの絶対パス")
    parser.add_argument("--out-atlas", default="atlas.png", help="出力アトラス画像名")
    parser.add_argument("--out-json", default="atlas.json", help="出力JSONファイル名")
    parser.add_argument("--parts-json", required=True, help="入力パーツリスト定義(JSON形式)のパス")
    args = parser.parse_args()

    mascot_path = Path(args.mascot_dir)
    parts_json_path = Path(args.parts_json)

    if not parts_json_path.exists():
        print(json.dumps({"success": False, "error": f"Parts JSON not found: {args.parts_json}"}))
        sys.exit(1)

    try:
        with open(parts_json_path, 'r', encoding='utf-8') as f:
            parts_data = json.load(f)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to load parts JSON: {str(e)}"}))
        sys.exit(1)

    # 読み込み対象のパーツ情報をパース
    # 構造: [{"name": "neutral_eyes_open", "path": "path/to/img", "offsetX": 0, "offsetY": 0}, ...]
    rects = []
    loaded_images = []

    for item in parts_data:
        name = item.get("name")
        img_relative_path = item.get("path")
        
        # 相対パスまたは絶対パスの解決
        img_path = Path(img_relative_path)
        if not img_path.is_absolute():
            img_path = mascot_path / img_path
            
        if not img_path.exists():
            print(f"[Warning] Image not found: {img_path}", file=sys.stderr)
            continue
            
        try:
            img = Image.open(img_path)
            # RGBAモードで読み込む
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # 余白トリミング（バウンディングボックスの最小化）をここで自動で行うとアトラスサイズを節約できる
            # 今回はシンプルさ重視で元の画像サイズを基準にパッキング
            w, h = img.size
            r = Rect(
                x=0, y=0, w=w, h=h, 
                name=name, 
                original_img=img,
                offset={"x": item.get("offsetX", 0), "y": item.get("offsetY", 0)}
            )
            rects.append(r)
            loaded_images.append(img)
        except Exception as img_err:
            print(f"[Error] Failed to open image {img_path}: {img_err}", file=sys.stderr)

    if not rects:
        print(json.dumps({"success": False, "error": "No valid parts images found to pack."}))
        sys.exit(2)

    # パッキング実行
    max_atlas_width = 2048
    packed_rects, atlas_height = pack_rects(rects, max_width=max_atlas_width)
    
    # 最終的なアトラスサイズ（2のべき乗に合わせるとテクスチャロードに優しいが、ここでは自動フィット）
    # 幅は指定の2048px、高さはパッキング結果に合わせる
    atlas_width = max_atlas_width
    
    # 高さが0の場合はフォールバック
    if atlas_height == 0:
        atlas_height = 256

    # 空のアトラス画像を生成 (完全透過)
    atlas_img = Image.new('RGBA', (atlas_width, atlas_height), (0, 0, 0, 0))
    
    frames_meta = {}
    
    for r in packed_rects:
        # アトラスにパーツを描画
        atlas_img.paste(r.original_img, (r.x, r.y))
        
        # メタデータの作成
        # pivot はパーツの中心
        pivot_x = r.w / 2.0
        pivot_y = r.h / 2.0
        
        frames_meta[r.name] = {
            "frame": {"x": r.x, "y": r.y, "w": r.w, "h": r.h},
            "pivot": {"x": pivot_x, "y": pivot_y},
            "offset": r.offset
        }

    # アトラス画像とJSONの出力
    output_atlas_path = mascot_path / args.out_atlas
    output_json_path = mascot_path / args.out_json
    
    try:
        # ディレクトリの作成
        output_atlas_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 画像保存
        atlas_img.save(output_atlas_path, "PNG")
        
        # JSON保存
        atlas_meta = {
            "meta": {
                "image": args.out_atlas,
                "size": {"w": atlas_width, "h": atlas_height}
            },
            "frames": frames_meta
        }
        
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(atlas_meta, f, indent=4, ensure_ascii=False)
            
        print(json.dumps({
            "success": True,
            "atlasPath": str(output_atlas_path),
            "jsonPath": str(output_json_path),
            "width": atlas_width,
            "height": atlas_height
        }))
        
    except Exception as save_err:
        print(json.dumps({"success": False, "error": f"Failed to save atlas files: {str(save_err)}"}))
        sys.exit(3)

if __name__ == "__main__":
    main()
