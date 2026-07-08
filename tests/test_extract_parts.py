import subprocess
import os
import sys

def main():
    # 実行環境の python を使用
    python_bin = sys.executable
    # python-services ディレクトリにある extract_parts.py への相対パス
    script_path = r"../python-services/extract_parts.py"
    
    # カレントディレクトリ（tests/）からの相対パスでアセットを指定
    noface = r"assets/noface_test_base.png"
    expression = r"assets/expr_通常_test_base.png"
    
    # 出力先（tests/results/）
    out_dir = r"results"
    os.makedirs(out_dir, exist_ok=True)
    output = os.path.join(out_dir, "parts_通常_test.png")
    
    # ユーザー調整パラメータ
    offset_x = "46"
    offset_y = "-534"
    scale = "1.142"
    rotation = "0"
    
    cmd = [
        python_bin,
        script_path,
        "--noface", noface,
        "--expression", expression,
        "--output", output,
        "--offset-x", offset_x,
        "--offset-y", offset_y,
        "--scale", scale,
        "--rotation", rotation
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    print("STDOUT:")
    print(result.stdout)
    print("STDERR:")
    print(result.stderr)
    
    if result.returncode == 0:
        print("Success! Test image generated at:", output)
        if os.path.exists(output):
            print(f"Output file size: {os.path.getsize(output)} bytes")
    else:
        print("Failed! Return code:", result.returncode)

if __name__ == "__main__":
    main()
