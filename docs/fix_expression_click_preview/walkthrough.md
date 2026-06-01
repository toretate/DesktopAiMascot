# 表情クリック時のプレビュー機能実装 修正内容の確認 (Walkthrough)

## 実施した変更内容

表情スロット（表情グリッド）をクリックした際に、大画面表情エディタを強制的に開くのではなく、左側のマスコット表示アバターに表情を重ね合わせリアルタイムで「プレビュー」する機能を実装・検証しました。

### [MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/MascotSettings.vue)
- 表情セル（グリッド内の各スロット）の `@click` イベントハンドラーを `openExpressionEditModalWithExpression(expr)` から `selectExpressionForPreview(expr)` に変更し、大画面エディタの遷移を廃止しました。代わりに大画面エディタは「表情を編集・位置調整 (大画面エディタ)」ボタンから明示的に開くように動線を整理しました。
- `activePreviewExpression` 状態変数を定義し、クリックした表情データを格納します。
- 計算プロパティ `computedListPreviewExpressionStyle` を実装し、大画面サイズ（420px基準）の表情オフセットや拡大率をリスト表示アバターのサイズ（200px基準、縮小率 `200 / 420`）に正確にスケール補正した上で、絶対配置で重ね合わせるためのCSSオブジェクトを算出するロジックを実装しました。
- `avatar-container` 内にプレビュー表情を絶対配置で重ね合わせるテンプレートマークアップを追加しました。
- 同時に `window.electronAPI.previewMascotState` を呼び出し、デスクトップ上で稼働中のマスコットウィンドウ実体に対してもリアルタイムにプレビュー状態が反映されるように同期ロジックを統合しました。
- **はみ出しレイアウト崩れの修正**:
  アクティブ状態のマスコット一覧内のベース全身像（ポーズや衣装等）に対して、Tailwind CSSクラス `class="w-full h-full object-contain"` ではなく、インラインスタイル `style="width: 100%; height: 100%; object-fit: contain;"` を直接指定することで、一覧枠内から画像が原寸大ではみ出すのを防ぎ、正しくアバター表示領域に収まるように修正しました。
- **表情プレビューの位置ズレ・スケール崩れの根本修正**:
  - 大画面（420x420 正方形）と左側リストアバター（150x200 縦長）でアスペクト比が異なるため、アバター全身像の縮小率と表情スプライトの縮小スケール比率が一致せず、位置が右上に大きくズレて巨大化する不具合を解決しました。
  - `avatar-container` 内に `140px × 140px` の正方形中間コンテナ `mascot-composite-preview` を追加し、インラインスタイル `position: relative` を明示して `position: absolute` の表情パーツ画像の配置基準を完全に固定しました。
  - アスペクト比を大画面と同じ `1:1` に統一したため、どのような比率の画像アセットでも縮小率が常に `140 / 420 = 1/3` に完全に固定され、ドット単位で大画面エディタでの微調整位置とサイズが完璧にリスト表示側へ再現されるようになりました。

## 検証結果

### 1. ビルド検証
`cmd /c npm run build` を実行し、一切のコンパイルエラーや型チェックエラーが発生せず、正常にビルドが完了することを確認しました。

```bash
> desktop-ai-mascot@1.0.0 build
> vue-tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 291 modules transformed.
rendering chunks...
dist/assets/index-CdShPqcS.css          29.60 kB │ gzip:   6.72 kB
dist/assets/index-DIEh7KxD.js          495.59 kB │ gzip: 124.57 kB
✓ built in 1.19s
```

### 2. 動作確認
- 表情スロットをクリックした際に、エディタへの強制移動が発生しないことを確認。
- 左側のマスコット表示に対して、クリックした表情が正しいスケールとオフセットでリアルタイムに重ね合わされてプレビューされることを確認。
