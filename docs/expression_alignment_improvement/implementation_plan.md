# 表情の自動位置合わせアルゴリズムの改善計画

## 概要
ユーザーから提供されたテスト画像資産（`outfit_1.png`, `expr_$感情.png`, `expr_$感情_OK.png`）を使用して、自動位置合わせ（切り抜き、拡大/縮小、顔への位置合わせ）の精度を向上させ、`expr_$感情_OK.png`（位置合わせ期待結果画像）に最も近づくようにアルゴリズムを改良します。

## 課題の分析
1. **顔検出および位置合わせパラメータの精度**:
   * 現在の `detectFaceRegion` は、全身立ち絵の非透明領域の上部 10%〜35%、幅 50% を単純な比率（ヒューリスティック）で顔領域として決定しています。このままだと、キャラの顔の実際の位置・サイズとずれが生じ、表情の配置がずれます。
   * テスト用の立ち絵 `outfit_1.png` から、より正確に顔の位置と範囲を抽出する必要があります。
2. **ピクセル走査の最適化**:
   * `outfit_1.png` (1536x1920) のような高解像度の画像では、全ピクセル（2.9M ピクセル）のネストループ走査が極めて重く、テスト実行時にタイムアウト（5000ms超）を発生させています。走査処理 of 早期終了による高速化が必須です。

## 提案する変更

### 1. `detectFaceRegion`（[face-region-detector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/face-region-detector.ts)）の高速化と精度改善
* **高速化**: キャラクター全体のバウンディングボックスを検出する際、全ピクセルを全走査する代わりに、「上から下」「下から上」「左から右」「右から左」にスキャンして非透明ピクセルを見つけた時点で早期ブレイクするアルゴリズムに変更します。
* **顔領域抽出の補正**: `outfit_1.png` の実際の顔の位置に適合するように、ヒューリスティック比率（`FACE_TOP_RATIO`, `FACE_BOTTOM_RATIO` など）の調整、または顔の検出基準を調整可能にします。

### 2. 位置合わせ計算（[alignment-calculator.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/alignment-calculator.ts)）のパラメータ調整
* `expr_$感情_OK.png` に重ね合わせた時の表示結果と、切り出された表情画像の位置ずれやスケールを最小化するための補正率（`FACE_FIT_RATIO` やアンカー基準）を微調整し、期待される位置・サイズに一致させます。

### 3. 自動位置合わせテスト（[visual-alignment.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/__tests__/visual-alignment.test.ts)）の構築
* テストで実際に `outfit_1.png` と `expr_喜び.png` 等を読み込み、自動位置合わせ（`alignSingle`）を実行します。
* 算出したパラメータ（offsetX, offsetY, scale）で表情をベース画像に重ね合わせた際のピクセル・位置情報が、`_OK.png` の基準位置とどれくらい近似しているかを数値的・構造的にテスト検証します。

## ユーザーレビュー要求事項
* 自動位置合わせ処理は、各マスコットごとに顔のサイズや比率が異なるため、固定 of ヒューリスティック比率ではズレることがあります。今回の調整は `outfit_1.png` に対して完全に最適化させますが、今後他キャラクター用にエディタ側で微調整できるよう、位置補正を学習・調整する設定値をマスコット設定（MascotData）側に将来持たせるアプローチも考えられます。
