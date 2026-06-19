#!/usr/bin/env python3
"""
rembg (ONNX) を使った背景除去スクリプト。

主に isnet-anime（アニメ特化）モデルを vision.cpp の BiRefNet 系と比較する目的で用意。
モデルは初回実行時に rembg が ~/.u2net/ に自動ダウンロードする。

出力:
  成功: stdout に {"success": true, "out": "<出力PNGパス>"}
  失敗: stdout に {"success": false, "error": "..."} （終了コード 1）

呼び出し方:
  .venv/bin/python remove_bg.py /abs/in.png --model isnet-anime --out /abs/out.png
"""

import sys
import json
import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="rembg 背景除去")
    parser.add_argument("image_path", help="入力画像の絶対パス")
    parser.add_argument("--model", default="isnet-anime",
                        help="rembg モデル名 (isnet-anime, isnet-general-use, u2net, ...)")
    parser.add_argument("--out", required=True, help="出力 PNG の絶対パス")
    args = parser.parse_args()

    try:
        from rembg import remove, new_session

        session = new_session(args.model)
        with open(args.image_path, "rb") as f:
            input_bytes = f.read()

        # alpha_matting は境界が綺麗になるが重い。既定の素直な切り抜きにする。
        output_bytes = remove(input_bytes, session=session)

        with open(args.out, "wb") as f:
            f.write(output_bytes)

        print(json.dumps({"success": True, "out": args.out}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
