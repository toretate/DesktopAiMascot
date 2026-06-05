# 統合ウィンドウおよびコンパクトウィンドウの実装計画

この計画書は、マスコットとチャットのウィンドウ表示モード（分割、統合、コンパクト）の実装方針と手順について説明します。

## ユーザーレビュー要求

> [!IMPORTANT]
> - **設定変更時の挙動**: ウィンドウモードの変更は、ウィンドウ全体の構成（透過設定やウィンドウ数、ウィンドウ枠の有無）に大きな影響を与えます。そのため、設定画面で「ウィンドウモード」を変更して保存した際には、**アプリケーションの自動再起動（または再起動を促す確認ダイアログの表示）** を行い、再起動後に新しいモードでウィンドウを生成するアプローチを提案します。これにより、メモリリークや描画の競合を防ぎ、最も安定した動作を確保できます。

## 提案される変更

ウィンドウモードに応じて、Electronのメインプロセスが生成するウィンドウを分岐させ、Vue側でそれぞれに対応したレイアウトを描画するようにします。

### 1. Electronメインプロセスの制御分岐

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
`createWindows` 関数において、`configData.windowMode` の値に応じて生成するウィンドウを切り替えます。

- **`split` (分割) モード** (現在のデフォルト)
  - `mascotWin` (透過・枠なし、`#mascot`) と `chatWin` (透過・枠なし、`#chat`) を生成し、位置を同期。
- **`integrated` (統合) モード**
  - 左マスコット、右チャットを包含する単一のウィンドウを生成（`#integrated`）。
  - **背景透過は不要**なため、通常の不透明ウィンドウ（`transparent: false`）として作成。
  - 初期サイズ例: 幅 1100px × 高さ 800px。
- **`compact` (コンパクト) モード**
  - 縦長でマスコットとチャットが一体となった単一のウィンドウを生成（`#compact`）。
  - **背景透過は不要**なため、通常の不透明ウィンドウ（`transparent: false`）として作成。
  - 初期サイズ例: 幅 420px × 高さ 800px。

#### [NEW] [integrated-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/window/integrated-window.ts)
統合モード用のウィンドウ（`integratedWindow`）を作成・管理するモジュール。
- `transparent: false` でウィンドウを初期化。
- 基本的なドラッグ移動、サイズ保存、最前面表示に対応。

#### [NEW] [compact-window.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/window/compact-window.ts)
コンパクトモード用のウィンドウ（`compactWindow`）を作成・管理するモジュール。
- `transparent: false` でウィンドウを初期化。
- 基本的なドラッグ移動、サイズ保存、最前面表示に対応。

---

### 2. レンダラープロセス (Vue) のルーティングとレイアウト追加

#### [MODIFY] [App.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/App.vue)
新しいハッシュルート `#integrated` と `#compact` に対応し、それぞれのレイアウトコンポーネントをレンダリングします。

```html
<template>
    <div class="app-root">
        <MascotViewer v-if="currentHash === '#mascot' || currentHash === ''" />
        <ChatPanel v-else-if="currentHash === '#chat'" />
        <SettingsWindow v-else-if="currentHash === '#settings'" />
        <IntegratedLayout v-else-if="currentHash === '#integrated'" />
        <CompactLayout v-else-if="currentHash === '#compact'" />
        <div v-else class="fallback-view">
            <p>不明なウィンドウハッシュ: {{ currentHash }}</p>
        </div>
    </div>
</template>
```

#### [NEW] [IntegratedLayout.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/layouts/IntegratedLayout.vue)
- 左側に `MascotViewer`（幅比率 40〜50%）、右側に `ChatPanel`（幅比率 50〜60%）を横並び（`flex-direction: row`）に配置したレイアウト。
- **将来的な背景画像設定機能の追加を見据え**、背景用のラッパー要素（CSS `background-image` や `background-size: cover` などが適用可能な構造）を用意します。デフォルトは単色の背景色。

#### [NEW] [CompactLayout.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/layouts/CompactLayout.vue)
- モバイル・スマホ表示を想定した縦長のレイアウト。
- 画面全体に `MascotViewer` を背面配置し、その前面（z-index）に `ChatPanel` を重ねてオーバーレイ表示します。
- チャット履歴やメッセージが描画された際は、`ChatPanel` が不透明コンテナとしてマスコットの上に重なり、マスコットは隠れる仕様となります。
- **将来的な背景画像設定機能の追加を見据え**、背景用のラッパー要素を用意します。

---

### 3. コンポーネントの構造化調整

「コンパクトモードにおいてチャット履歴をオーバーレイ表示とする（マスコットを覆い隠す）」仕様のため、**既存の `ChatPanel.vue` や `MascotViewer.vue` を機能分割することなくそのまま再利用**可能です。

これにより、CSSでの単純な位置調整（z-index および絶対配置）のみで実装が完了し、Vueコードの破壊的変更を完全に回避できます。

---

## 検証計画

### 自動テスト（ビルド検証）
- 変更適用後、`npm run build` を実行してTypeScriptのコンパイルおよびViteビルドが正常に完了することを確認します。

### 手動検証
1. **設定画面での動作**:
   - 設定画面の「ウィンドウ設定」で「統合」または「コンパクト」を選択し、保存した際に再起動されることを確認。
2. **統合モードの表示確認**:
   - アプリ起動後、左側にマスコット、右側にチャットが並んだ不透明な1枚のウィンドウが表示されることを確認。
3. **コンパクトモードの表示確認**:
   - アプリ起動後、縦長ウィンドウの前面にチャット、背面にマスコットが配置されていることを確認。
   - チャット履歴表示時にマスコットが覆い隠され、入力欄が最下部に表示されることを確認。
