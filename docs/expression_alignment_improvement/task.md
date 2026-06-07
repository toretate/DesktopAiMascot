# 自動位置合わせ改善タスクリスト

- [ ] `detectFaceRegion`（[face-region-detector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/skills/expression-alignment/face-region-detector.ts)）のピクセルスキャン処理の高速化（早期ブレイクの実装）
- [ ] テスト `visual-alignment.test.ts` で、`outfit_1.png` に対する顔位置、および `expr_喜び.png` 等の有効領域を検出し、現在の算出結果を測定する
- [ ] パラメータ算出ロジックおよび比率の調整・最適化を行い、`_OK.png` 基準画像の位置に適合させる
- [ ] すべてのテストが正常にパスすることを確認する
