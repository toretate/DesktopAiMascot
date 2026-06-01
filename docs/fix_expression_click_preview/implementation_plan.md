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

### 表情エディタコンポーネント
- **対象ファイル**: [ExpressionEditorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/ExpressionEditorModal.vue)
- **修正内容**:
  - 子コンポーネントがマウントされたまま親から再度モーダルが開かれた際（`visible` が `true` に変化した時）やマスコットアセットデータ（`editingMascot`）が動的に渡された際に、setup直下の1回限りの初期化だと表情データが選択されず `null` になり、右カラムのプレビューやコントロール類が丸ごと消えてしまうバグを修正。
  - `watch` を用いて、`visible` や `editingMascot` の変化をリアクティブに監視し、開かれた時点で必ず「通常」もしくは最初の登録表情を `selectedModalExpression` に自動的に選択・代入するように改修。
  - **縦幅制限による画面下部見切れの修正（レイアウト調整）**:
    モーダル全体の高さ（最大780px/90vh）に対し、内部 of プレビューカードおよび左スリムリストが `520px` に固定されていたため、下部コントロール（スライダーや各種ボタン）が画面外（overflow-hidden）に押し出されて見切れてしまう不具合を解決。プレビューカードおよび左縦リストの固定高さを `430px` にスリム化し、縦スライダーを `310px` に調整することで、コントロールやフッターボタンがすべて完全に1画面にきれいに収まるようにレイアウトを修正。
  - **CSSユーティリティ（PrimeFlex/Tailwind）欠落によるFlexレイアウト崩壊の根本解決**:
    プロジェクト環境に PrimeFlex や Tailwind CSS が導入されていないため、モーダルテンプレートで多用されている `.flex`, `.flex-column`, `.flex-1`, `.gap-4`, `.justify-content-between`, `.align-items-center` などのレイアウト補助クラスが一切動作せず、ヘッダーの×ボタンが左上に配置されたり、プレビュー領域全体が左リストの下側に縦積み（ブロック配置）で回り込んでしまい、すべてのコントロール類が画面外へはみ出していたバグを解決。
    `<style scoped>` の末尾に、テンプレートで使われているすべてのレイアウト用ユーティリティクラス（`.flex`, `.flex-column`, `.flex-1`, `.gap-*`, `.justify-content-*`, `.align-items-*` など）を Vanilla CSS の強制的スタイル（`!important` 指定）として定義・補完することで、外部ライブラリに一切依存せず、横並びレイアウトや配置位置を完璧に動作させます。



## 検証計画

### 自動ビルド検証
- `cmd /c npm run build` を実行し、TypeScriptのコンパイルおよびViteビルドがエラーなしで成功することを確認します。

### 手動検証
- 各種表情スロットをクリックし、左側アバターの顔の位置に表情画像が正確に重ね合わされることを確認します。
- 必要に応じて、デスクトップマスコット本体ウィンドウを起動し、表情切り替えが即座に反映されることを確認します。
