# 表情クリック時のリアルタイムプレビュー機能 実装計画

表情スロット（表情グリッド）をクリックした際に、大画面表情エディタを開くのではなく、左側のマスコットプレビューエリアに対して表情をリアルタイムで重ね合わせ描画（プレビュー）し、直感的に表情の変化を確認できるようにします。

## ユーザーレビュー要求事項

> [!IMPORTANT]
> - **表情エディタへの移動廃止とプレビュー化**:
>   表情スロットクリック時に大画面エディタに遷移するのではなく、左側のマスコット全身像に対して、表情のX/Yオフセットおよび拡大率（スケール）をリスト表示サイズに縮小補正して重ね合わせるプレビュー動作に変更します。
> - **デスクトップマスコット本体へのリアルタイム投影**:
>   クリックした際に Electron の API を通じて、デスクトップ上に表示されているマスコット実体に対してもリアルタイムに表情データを送信・投影します。

## 変更内容

### マスコット設定コンポーネント

#### [MODIFY] [MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/MascotSettings.vue)

1. **表情プレビュー状態とスケール補正算出プロパティの追加**
   左側リストアバター（高さ200px）は大画面（高さ420px）の約 `200 / 420` の比率であるため、表情のオフセット座標に `scaleFactor` を適用して完全に位置が重なるように補正します。
   ```typescript
   const activePreviewExpression = ref<MascotAsset | null>(null);
   const computedListPreviewExpressionStyle = computed(() => { ... });
   ```

2. **表情スロットのクリックイベントハンドラー変更**
   表情をクリックした際に、`openExpressionEditModalWithExpression` の代わりに `selectExpressionForPreview` を呼び出します。

3. **左側アバターコンテナへのプレビュー画像重ね合わせマークアップ**
   アバター画像の前面に絶対配置 (`absolute`) で表情画像を重ね合わせ描画します。
   また、アクティブ状態のマスコット一覧内のベース全身像（ポーズや衣装等）に対して、Tailwind CSSクラス `class="w-full h-full object-contain"` ではなくインラインスタイル `style="width: 100%; height: 100%; object-fit: contain;"` を直接指定することで、一覧枠内から画像が原寸大ではみ出すのを防ぎ、正しくアバター表示領域に収めます。

4. **アスペクト比と基準位置のズレ修正 (140x140 正方形中間ラッパー導入)**
   大画面プレビュー（420x420 正方形）と左側リストアバター枠（150x200 縦長）でアスペクト比が異なるため、アバター画像の縮小割合と表情プレビューの位置・拡大縮小率が噛み合わずズレてしまう問題、および `relative` が無効で絶対配置基準が崩れる問題を根本解決します。
   - `avatar-container` 内に `140px × 140px` の正方形中間コンテナ `mascot-composite-preview` を配置し、インラインスタイル `position: relative` を明示して絶対配置の基準を固定します。
   - 正方形コンテナにすることで、どのようなアスペクト比の画像アセットであっても、縮小率が常に大画面の `140 / 420 = 1/3` に完全に固定され、ドット単位で大画面エディタの調整が正確に再現されるようになります。

## 変更内容詳細（追加修正）
- **対象ファイル**: [MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/MascotSettings.vue)
- **修正箇所**: 
  - `computedListPreviewExpressionStyle` 内のスケール補正率 `scaleFactor` を `140 / 420` に固定。
  - `avatar-container` のマークアップを変更し、内部に正方形プレビューラッパーを追加して、ベース全身像アセットと表情画像をその中に重ね合わせるように構造をリファクタリング。

### プロジェクト全体へのスタイリング環境統合
- **インストール**:
  - `primeflex`: 既存のユーティリティレイアウト動作を維持・保証するためインストール。
  - `tailwindcss@3`, `postcss`, `autoprefixer`: ユーザーの明示的指定に基づき Tailwind CSS v3 環境をインストール。
- **設定統合**:
  - `tailwind.config.js` を生成し、`./src/**/*.{vue,js,ts,jsx,tsx}` および `./index.html` をスキャン対象に指定。
  - グローバルCSSである `src/styles/main.css` 内に `@import "primeflex/primeflex.css";` および Tailwind CSS のディレクティブを定義し、プロジェクト全域で強力なレイアウトおよびスタイリングユーティリティが使用可能となりました。
  - `ExpressionEditorModal.vue` の `style scoped` に一時的に追加していた Vanilla 補完用 CSS をきれいに削除し、競合を排除して元のスッキリとしたコンポーネント状態に完全修復しました。

### 画像トリミングコンポーネント
- **対象ファイル**: [ImageCropModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/ImageCropModal.vue)
- **修正内容**:
  - トリミング用の紫の四角形枠について、ドラッグによる位置移動は行えるものの、四隅のハンドル（`.crop-corner`）を操作してのサイズ変更（リサイズ）が行えなかった問題を解決。
  - さらに機能強化として、以下の高度なトリミング枠制御機能を完全実装：
    1. **上下のボーダー枠ドラッグ**: 縦幅のみのリサイズ（`cursor: ns-resize`）
    2. **左右のボーダー枠ドラッグ**: 横幅のみのリサイズ（`cursor: ew-resize`）
    3. **四隅の■ハンドルドラッグ**: 縦横の自由幅リサイズ
    4. **四隅の■ハンドル ＋ Shiftキー押下**: 開始時のアスペクト比を完全に維持（ロック）したままの拡大・縮小リサイズ
    5. **それ以外の枠内ドラッグ**: 従来通りの枠の位置移動
  - `cropSize`（単一数値）を廃止し、`cropWidth` と `cropHeight` の個別アスペクト比状態を定義。
  - HTMLマークアップにて、四辺の境界線の検出用バー（`.crop-edge`、見えないが操作しやすい適度な太さ）を新設。
  - `onResizeMouseDown` でドラッグ開始時のアスペクト比をロックし、`onCropMouseMove` にて Shift キーの押下状態（`event.shiftKey`）やドラッグ対象（四辺または四角）に応じて、画像境界外にはみ出さないよう厳密な座標補正と最小・最大値制限を施したマルチリサイズ計算アルゴリズムを実装。
  - 生成される表情画像が切り抜いた自由比率アスペクト比を保持して綺麗に保存されるよう、`executeCrop` のキャンバス描画ロジックを最適化。


## 検証計画

### 自動ビルド検証
- `cmd /c npm run build` を実行し、TypeScriptのコンパイルおよびViteビルドがエラーなしで成功することを確認します。

### 手動検証
- 各種表情スロットをクリックし、左側アバターの顔の位置に表情画像が正確に重ね合わされることを確認します。
- 必要に応じて、デスクトップマスコット本体ウィンドウを起動し、表情切り替えが即座に反映されることを確認します。
