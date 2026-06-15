# 修正内容の確認 (Walkthrough): チャットウィンドウの背景設定追加

本変更では、チャットウィンドウの背景設定（背景画像、不透明度、フィット方法）をウィンドウ設定に追加し、設定画面を左右の2ペイン（各種コントロールとリアルタイムプレビュー）に分割しました。さらに、ユーザーの利便性を高めるため、マスコットウィンドウ設定にもサイズ連動プレビューを追加しました。

## 修正内容

### 1. マスコットウィンドウ設定へのプレビュー追加 ([WindowSettingsPanel.vue](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/WindowSettingsPanel.vue))
- **マスコット画像解決用のヘルパー追加**:
  - `isMascotImage`, `resolveMascotImageUrl`, `activeMascotImageUrl` などを追加し、現在のアクティブマスコットの立ち絵画像パス（またはアバター文字）を安全に解決できるようにしました。
- **左右 2Pane レイアウトとプレビュー構築**:
  - 「マスコットウィンドウ設定」のエリアも Flexbox を用いた左右2ペイン構成に再構築しました。
  - **左ペイン (可変幅 `flex-1`)**: 表示サイズ調整スライダー、クイックサイズ変更ボタン、最前面表示設定を配置。
  - **右ペイン (可変/最大幅制限 `w-full` & `max-width: 320px`)**:
    - デスクトップを模した淡いグリッド模様のグラデーション背景をデザインし、その中央にマスコット画像（またはアバター絵文字）を描画するプレビューボックスを配置しました。
    - **サイズ連動**: 設定された `mascotScale`（コンパクトモード時は強制的に50%）が、CSS の `transform: scale()` を介してリアルタイムに適用され、マスコットの大きさが滑らかなアニメーションでプレビューされます。
    - **最前面表示連動**: 最前面表示の設定に応じて、右上のインジケーターバッジが「最前面（緑色）」または「標準表示（灰色）」にリアルタイムで切り替わります。

### 2. チャットウィンドウ設定へのプレビュー実装 ([WindowSettingsPanel.vue](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/WindowSettingsPanel.vue))
- 設定内の「チャットウィンドウ設定」セクション全体を純粋な Flexbox レイアウト (`flex-row`) による左右2ペインに再構築しました。
- **左ペイン (可変幅 `flex-1`)**: 各種コントロール（背景色、不透明度、画像選択、最前面表示、送信キー、フォントなど）を縦積みでスッキリと配置しました。
- **右ペイン (可変/最大幅制限 `w-full` & `max-width: 320px`)**: 
  - チャット画面を忠実に再現したリアルタイムプレビュー領域 (`.chat-preview-box`) を配置しました。
  - 背景色、背景画像、不透明度、フィット方法、枠線、フォントファミリーなどの設定値が、保存する前にリアルタイムにプレビューへ描画されます。

### 3. チャット画面への反映 ([ChatPanel.vue](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/components/ChatPanel.vue))
- 新たに背景用のレイヤー（`.chat-background`）を `.chat-wrapper` の直下に追加し、`position: absolute` および `z-index: -1` で背面に配置しました。
- 背景画像、不透明度、フィット方法を動的に計算する `chatBackgroundStyle` `computed` プロパティを適用し、背景レイヤーにバインドしました。

### 4. マスコットウィンドウへの背景適用 ([MascotViewer.vue](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/components/MascotViewer.vue))
- **ストア設定のインポート**: `mascotBackgroundColor` や `mascotBackgroundImage` などの背景設定プロパティをインポートしました。
- **背景スタイルの計算**:
  - `getMascotRgbaBackground` と `mascotBackgroundStyle` という computed プロパティを定義し、設定された色、画像、不透明度、フィット方法を合成した CSS スタイルオブジェクトを作成します。
- **背景レイヤーの組み込み**:
  - `mascot-wrapper` コンテナの直下に絶対配置の背景レイヤー `<div class="mascot-background" :style="mascotBackgroundStyle"></div>` を追加。
  - キャラクター（`.mascot-character`）以外の背景領域は、マウス移動時の透過処理（`setIgnoreMouseEvents`）の対象のままであり、マスコットとしてのクリック透過の利便性を維持しつつ背景が表示されます。

### 5. 統合ウィンドウへの背景適用 ([IntegratedLayout.vue](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/components/layouts/IntegratedLayout.vue))
- **背景スタイルの計算**:
  - `getRgbaBackground` と `integratedBackgroundStyle` を定義し、全体の背景色、背景画像、不透明度、フィット方法を計算して CSS スタイルにバインドするようにしました。
- **背景レイヤーの組み込みと z-index の調整**:
  - `integrated-container` の直下に `<div class="integrated-background" :style="integratedBackgroundStyle"></div>` を配置。
  - 各セクションに `z-index: 1` を設定し、背景レイヤー（`z-index: 0`）の上にコンテンツが美しく重なるよう整理しました。

### 6. 設定ストアおよび定義の同期 ([config-data.ts](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/config/config-data.ts) / [config.ts](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/src/store/config.ts))
- `ConfigData` インターフェース、`defaultData`、および Pinia ストアへ新しい背景設定プロパティを完全に追加・同期し、設定のやり取りが安全に行われるようにしました。

---

## 動作確認手順
1. システムトレイアイコンの右クリックなどから「設定」画面を開きます。
2. 「ウィンドウ設定」タブに移動します。
3. **ウィンドウモードが「統合」の時の確認**:
   - ウィンドウモードを「統合」に変更します。
   - 「統合ウィンドウ設定」セクションが表示され、右側に極小モック（マスコットとチャットエリア）付きのプレビューが表示されることを確認します。
   - **背景色の確認**: 「統合ウィンドウ全体の背景色」を変更し、不透明度を調整すると、プレビュー全体の背景色が即時連動して変化することを確認します。
   - **背景画像の確認**: 「画像を選択」ボタンからローカル画像を選択し、「画像不透明度」や「配置方法」を変更すると、プレビューに背景画像が正しく反映されることを確認します。
   - 設定を保存し、実際の統合ウィンドウ全体にも反映されることを確認します。
4. **マスコットウィンドウ設定の確認**:
   - 右側にデスクトップ風背景とマスコット画像が表示されるプレビューがあることを確認します。
   - 「表示サイズ」のスライダーや「クイックサイズ変更」ボタンを押した際、マスコット画像が滑らかに拡大・縮小することを確認します。
   - 「最前面表示」を切り替えた際、プレビュー右上のバッジが「最前面 / 標準表示」に連動することを確認します。
   - 「マスコットエリア背景色」を任意の色に変更し、「背景の不透明度」スライダーを上げると、プレビューのマスコット背後の領域に設定した色が反映されることを確認します。
   - 「画像を選択」ボタンからローカル画像を選択し、「配置方法」や「画像不透明度」を変更すると、プレビューのマスコット背景に画像が正しく反映されることを確認します。
5. **チャットウィンドウ設定の確認**:
   - チャットウィンドウのプレビュー背景色・画像・フォント・枠線が、左側のコントロール変更に連動してリアルタイムに変化することを確認します。
6. 「設定を保存」ボタンを押下して保存し、実際のデスクトップ上のマスコットウィンドウ、チャットウィンドウ、統合ウィンドウに設定した背景が即時反映されることを確認します。


