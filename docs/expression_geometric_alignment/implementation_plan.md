# 実装計画：幾何学的特徴（目・口の重心）に基づく表情自動位置合わせの導入

表情スプライト（背景除去済み）内の「目」と「口」のピクセル重心を検出し、ベース衣装の顔の位置に幾何学的にアライメントする高度な位置合わせロジックを実装します。これにより、表情アセットごとの余白やトリミング範囲の非対称性に影響されない、極めて高精度な配置を実現します。

## ユーザー確認事項

> [!NOTE]
> 今回の改善により、表情画像ごとに異なるスケールやパーツの描き方（目の間隔が広い、口の位置が低いなど）に合わせて、自動的に最も自然な縮小率と位置が計算されるようになります。

## 提案される変更点

### 表情解析・幾何計算コンポーネント

#### [NEW] [feature-island-detector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/feature-island-detector.ts)
表情画像の透過ピクセル情報から、連結成分分析（Connected Component Labeling）を行い、目や口に対応する「ピクセルの島（アイランド）」を抽出する新規モジュールです。
- 画像データをスキャンし、アルファ値が閾値（例: > 10）以上のピクセルを連結成分としてグルーピング。
- 各グループの「面積（ピクセル数）」「中心座標（重心）」「バウンディングボックス」を算出。
- 面積の大きい上位のグループから、左右の「目」および「口」の重心を以下のように同定：
  - Y座標が最も低い位置にある島 ＝ 口
  - 上部に左右に並んでいる2つの島 ＝ 左目・右目

#### [MODIFY] [alignment-calculator.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/alignment-calculator.ts)
`calculateAlignment` を更新、もしくは島検出結果を活用する幾何アライメント関数を追加します。
- 表情アセット側の「両目の中心点」と「口の重心」からなる三角形と、ベース衣装の顔領域（`faceBox`）から推測される理想的な目口の三角形をマッピング。
- 目の間隔比から最適な `scale` を逆算。
- 表情の両目中心が、顔の両目理想中心（`faceBox` 内の特定位置）と重なるように `offsetX`, `offsetY` を算出。

#### [MODIFY] [expression-auto-align.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/expression-auto-align.ts)
オーケストレーターに島検出ステップを組み込みます。
- 背景除去・クロップ後の透過画像から `detectFeatureIslands` を呼び出し、得られた顔パーツの座標を用いて位置計算を実行。

#### [MODIFY] [visual-alignment.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/__tests__/visual-alignment.test.ts)
- 新しいアライメントロジックが、リサイズ後の `outfit_1.png` に対し、全感情で理想の OK 画像パラメータに極めて近い値（差分がより少ない状態）を出力することをテストします。

---

## 検証計画

### 自動テスト
- `npm test` を実行し、既存 of テストおよび幾何アライメントを含む新規テストケースがすべてクリアすることを確認します。
- 合成されたプレビュー画像を `__tests__/result/` フォルダに出力し、ビジュアル上で目や口がずれていないか自動アサーション検証します。
