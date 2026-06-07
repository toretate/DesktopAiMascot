# タスクリスト：Gemini Vision API による顔検出の併用と比較検討

- [x] `face-region-detector.ts` に AI 検出処理 `detectFaceRegionWithAI` を実装する
    - [x] 画像ソースから Base64 形式データと MimeType を安全に抽出するヘルパー関数の追加
    - [x] `gemini-2.5-flash` モデルを用いて顔の `box_2d` 正規化座標を取得する処理の実装
    - [x] 0-1000 の正規化座標からピクセル境界ボックス `BoundingBox` への逆変換処理の実装
    - [x] キャラクター全体の非透明領域 `characterBox` 検出の統合
- [x] `expression-auto-align.ts` で AI 検出フラグが有効な場合に `detectFaceRegionWithAI` を呼び出すようにする
- [x] `visual-alignment.test.ts` を拡張し、AI 方式のテストケースを追加する
    - [x] サーバー設定または環境変数から API キーを動的に取得する
    - [x] AI 検出による位置合わせ結果画像 `expr_${expr.name}_ai_synthesized.png` を生成して `__tests__/result` フォルダに出力する
    - [x] 各感情について、ヒューリスティック方式と AI 方式のズレ量をログ出力し、アサーションを実行する
- [x] テストを実行して、結果画像を生成する
- [x] 生成された結果画像（ヒューリスティック vs AI vs OK画像）を視覚的に比較し、結果を `walkthrough.md` にまとめる

