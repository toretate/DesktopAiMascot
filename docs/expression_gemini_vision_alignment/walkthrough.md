# Walkthrough: Gemini Vision API 顔検出方式の実装と比較検証

## 変更概要

表情自動位置合わせ機能に **Gemini Vision API（AI検出）方式** を追加実装し、既存の **幾何学的ヒューリスティック方式** と比較検証を行いました。

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| [face-region-detector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/face-region-detector.ts) | `detectFaceRegionWithAI` メソッドの実装、`extractBase64AndMimeType` / `extractCharacterBox` ヘルパー関数の追加 |
| [expression-auto-align.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/expression-auto-align.ts) | `alignSingle` / `alignBatch` に AI 検出ルーティングの条件分岐を追加 |
| [visual-alignment.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/__tests__/visual-alignment.test.ts) | AI 検出方式と HE 方式の比較テストケースを追加 |

---

## テスト結果

### テスト実行

```
✓ Load assets and run alignment (7960ms)
✓ AI Detection: Gemini Vision API による顔検出と位置合わせの比較 (41670ms)

Test Files  1 passed (1)
     Tests  2 passed (2)
  Duration  51.04s
```

全テスト **PASS** しました。

### 数値比較結果（AI vs ヒューリスティック vs Ground Truth）

| 感情 | 方式 | Scale差 | X差 | Y差 | 合計誤差 | 勝者 |
|------|------|---------|-----|-----|----------|------|
| 喜び | AI | -0.06 | -8 | -15 | 29 | |
| 喜び | HE | 0.01 | -1 | -1 | 3 | **◎HE** |
| 好奇心 | AI | 0.37 | 19 | 56 | 112 | |
| 好奇心 | HE | 0.34 | 26 | -25 | 85 | **◎HE** |
| 嫌悪 | AI | -0.17 | -7 | -22 | 46 | |
| 嫌悪 | HE | 0.04 | 0 | -1 | 5 | **◎HE** |
| 怒り | AI | 0.03 | -7 | -37 | 47 | |
| 怒り | HE | 0.11 | 0 | -2 | 13 | **◎HE** |
| 混乱 | AI | 0.31 | -64 | -54 | 149 | |
| 混乱 | HE | 0.56 | -56 | -29 | 141 | **◎HE** |

> [!NOTE]
> 合計誤差 = |Scale差 × 100| + |X差| + |Y差| で算出。値が小さいほど Ground Truth に近い（良好）。

---

## 視覚的比較

### 喜び

````carousel
![ヒューリスティック方式 - 喜び](C:/Users/watta/.gemini/antigravity-ide/brain/7ec9cbb0-e66a-449d-a5c0-28ac9955b61a/expr_喜び_synthesized.png)
<!-- slide -->
![AI方式 - 喜び](C:/Users/watta/.gemini/antigravity-ide/brain/7ec9cbb0-e66a-449d-a5c0-28ac9955b61a/expr_喜び_ai_synthesized.png)
````

### 怒り

````carousel
![ヒューリスティック方式 - 怒り](C:/Users/watta/.gemini/antigravity-ide/brain/7ec9cbb0-e66a-449d-a5c0-28ac9955b61a/expr_怒り_synthesized.png)
<!-- slide -->
![AI方式 - 怒り](C:/Users/watta/.gemini/antigravity-ide/brain/7ec9cbb0-e66a-449d-a5c0-28ac9955b61a/expr_怒り_ai_synthesized.png)
````

### 混乱

````carousel
![ヒューリスティック方式 - 混乱](C:/Users/watta/.gemini/antigravity-ide/brain/7ec9cbb0-e66a-449d-a5c0-28ac9955b61a/expr_混乱_synthesized.png)
<!-- slide -->
![AI方式 - 混乱](C:/Users/watta/.gemini/antigravity-ide/brain/7ec9cbb0-e66a-449d-a5c0-28ac9955b61a/expr_混乱_ai_synthesized.png)
````

---

## 考察と結論

### 今回のテスト画像における結果

**ヒューリスティック方式が全 5 感情で優勢**という結果になりました。

これは、ヒューリスティック方式が今回のテスト対象であるキャラクター（妖精モチーフの全身像、正面立ちポーズ）に対して**定数が最適にチューニング済み**であることが最大の要因です。

### AI方式の特徴と課題

| 観点 | AI（Gemini Vision） | ヒューリスティック |
|------|---------------------|-------------------|
| **精度（調整済みキャラ）** | △ Y方向に15-54px程度ズレる | ◎ Ground Truth に近い |
| **汎用性（未知のキャラ）** | ◎ ポーズ・体型に非依存 | △ 固定比率なので特殊ポーズに弱い |
| **速度** | △ API通信で約3-5秒/回 | ◎ 即座（数ms） |
| **コスト** | △ API使用料が発生 | ◎ 無料 |
| **オフライン動作** | × 不可 | ◎ 可能 |

### AI方式の「Y方向ズレ」の原因分析

AI方式で一貫して **Y方向に上にズレる（負の差分）** 傾向が見られました。これは Gemini Vision API が返す `box_2d` の顔領域に**髪の毛（特に前髪の上端）を含めずに検出している**ことが原因と推定されます。ヒューリスティック方式は `FACE_TOP_RATIO: 0.09` で頭頂部のやや下から顔が始まると推定しており、結果的に髪を含む顔全体をうまくカバーしています。

### 推奨方針

> [!IMPORTANT]
> **デフォルトはヒューリスティック方式を維持**し、AI方式は**オプション機能**として残す設計を推奨します。

理由：
1. 既存のヒューリスティック方式は、一般的な正面立ちポーズのキャラクターに対して十分な精度を持つ
2. AI方式は API キーとネットワーク接続が必須で、速度面でもオーバーヘッドが大きい
3. ただし、**特殊なポーズ（しゃがみ、横向き等）や体型比率が異なるキャラクター**では、AI方式のほうが適切な結果を返す可能性がある

現在の実装では `useAIDetection: true` オプションで切り替え可能であり、将来的に「自動位置合わせの精度が低い場合にAIフォールバック」するハイブリッド戦略も検討可能です。
