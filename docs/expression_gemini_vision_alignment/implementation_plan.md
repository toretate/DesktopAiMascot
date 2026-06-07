# 表情自動位置合わせにおける Gemini Vision API 方式の追加と比較検討

表情自動位置合わせ機能において、既存の幾何学的ヒューリスティックによる顔領域検出方式に加え、Gemini Vision API（AI検出）を使用した方式を実装します。これにより、キャラクターのポーズや縮尺に影響されず、高精度に顔の位置およびサイズを特定し、合成結果の品質を向上させます。また、両方式を実際に実行し、合成結果を比較検討します。

## ユーザー確認が必要な事項

> [!NOTE]
> AI顔検出の実行には Google AI Studio の API キーが必要です。テスト実行時およびアプリ内での動作時は、起動中のバックグラウンドサーバー（`http://localhost:3000/api/config`）に保存されている API キー、または環境変数 `GEMINI_API_KEY` を自動取得して使用します。

## 未解決の問題

特になし。API キーが取得できない場合のフォールバックとして、自動的に既存のヒューリスティック方式に切り替える設計とします。

---

## 提案される変更

### 1. 表情位置合わせモジュール

#### [MODIFY] [face-region-detector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/face-region-detector.ts)
* `detectFaceRegionWithAI(imageSource: string, apiKey: string)` メソッドを実装します。
* `imageSource` （ファイルパスまたは Base64 Data URL）から画像を読み込み、Base64 形式のデータおよび MimeType に変換するヘルパー関数を追加します。
* `gemini-2.5-flash` モデルを呼び出し、顔（頭部）領域の境界ボックスを 0-1000 の正規化座標として取得するリクエストを送信します（`response_schema` を用いた構造化 JSON 出力：`{ box_2d: [ymin, xmin, ymax, xmax] }`）。
* 取得した正規化座標に画像のピクセルサイズを乗算し、ピクセル座標の `BoundingBox` に逆変換します。
* キャラクター全体の非透明領域 `characterBox` については、既存のヒューリスティックの検出ロジックを流用して抽出し、AIで検出した `faceBox` と組み合わせた `FaceDetectionResult` を返却します。

#### [MODIFY] [expression-auto-align.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/expression-auto-align.ts)
* `alignSingle` および `alignBatch` メソッドにおいて、`options.useAIDetection` が `true` かつ `options.apiKey` が指定されている場合、`detectFaceRegion` の代わりに `detectFaceRegionWithAI` を呼び出すように条件分岐を追加します。

### 2. テストコードの拡張

#### [MODIFY] [visual-alignment.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/__tests__/visual-alignment.test.ts)
* ローカルで起動中のバックグラウンドサーバー、または `process.env.GEMINI_API_KEY` から API キーを取得するロジックを追加します。
* 既存のヒューリスティック方式に加えて、AI顔検出方式（`useAIDetection: true`）を用いた位置合わせ処理を追加実行するテストケースを作成します。
* AI顔検出方式で合成された画像も、`__tests__/result` フォルダ配下に `expr_${expr.name}_ai_synthesized.png` として保存します。
* AI 方式が正常に動作し、かつ出力される座標情報が一定の許容誤差内であることを検証するアサーションを追加します（APIキーが無い環境ではテストをスキップするか、または警告を出して正常終了するフォールバックを設けます）。

---

## 検証計画

### 自動テスト
* `vitest` を用いて、追加・変更したテストを実行します。
    * コマンド例: `npx vitest ui/src/skills/expression-alignment/__tests__/visual-alignment.test.ts`
* ヒューリスティック方式および AI 検出方式の両方で、全5感情（喜び、好奇心、嫌悪、怒り、混乱）の自動位置合わせが成功し、エラーなく終了することを確認します。

### 手動検証（比較検討）
* `__tests__/result` に出力された以下の画像を視覚的に比較します。
    * 既存のヒューリスティック方式による合成結果: `expr_${emotion}_synthesized.png`
    * 今回実装する Gemini Vision API 方式による合成結果: `expr_${emotion}_ai_synthesized.png`
    * 正解（OK）画像: `expr_${emotion}_OK.png`
* 位置ずれ（X方向・Y方向）や縮尺（スケール）がより OK 画像に近い（良好な結果である）のはどちらであるかを評価し、結果を `walkthrough.md` にまとめます。
