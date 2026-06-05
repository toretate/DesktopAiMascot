# 実装計画: チャットウィンドウと設定ダイアログ of 表示トリガー変更

## 概要

マスコットを操作する際のチャットウィンドウと設定ダイアログの表示トリガーを変更し、より直感的に操作できるようにします。
- **チャットウィンドウ**: マスコットを左クリック（シングルクリック）で表示・非表示をトグル。
- **設定ダイアログ**: マスコットを右クリックで表示。

これを実現するために、Electronの `-webkit-app-region: drag` によるドラッグの制限（クリックイベントがレンダープロセスに配信されない問題）を回避するため、Vue（JavaScript）側でウィンドウのドラッグ移動を処理し、ドラッグとクリック判定を両立させる実装を行います。

---

## ユーザーレビューが必要な項目

> [!NOTE]
> マスコット本体のドラッグ移動を、CSSの `-webkit-app-region: drag` から JavaScript（Vue）によるウィンドウ位置追従型ドラッグへと移行します。
> これにより、ドラッグ移動のスムーズさを維持しつつ、クリック（左クリックでチャットトグル）と右クリック（設定ダイアログ表示）のイベントを完全に検知できるようになります。

---

## 提案する変更内容

### 1. メインプロセス

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
- ウィンドウの相対移動を行うIPCハンドラー `'drag-window'` を追加します。
- `drag-window` 内で、マスコットウィンドウを移動させると同時に、追従するチャットウィンドウの位置も同期 (`syncChatWindowPosition`) させます。

### 2. プリロードスクリプト

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts)
- レンダラープロセスから安全に呼び出せるよう、`window.electronAPI.dragWindow` を追加します。

### 3. レンダープロセス

#### [MODIFY] [MascotViewer.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/MascotViewer.vue)
- `.mascot-character` 要素から `drag-area` クラスを除去します（これによりクリックイベントが検知可能になります）。
- `mousedown`, `mousemove`, `mouseup` イベントをハンドリングし、ウィンドウのドラッグ移動をJSで擬似実装します。
- ドラッグ開始から終了までに閾値以上の移動がなかった場合のみ「クリック」とみなし、`toggleChat()` を呼び出します。
- 右クリック（`@contextmenu.prevent="openSettings"`）はそのまま残し、右クリックで設定が開くようにします。

---

## 検証計画

### 手動検証
1. `npm run dev` でアプリケーションを起動します。
2. マスコットキャラクターを左クリックして、チャットウィンドウの表示・非表示がトグルされることを確認します。
3. マスコットキャラクターを右クリックして、設定ダイアログが表示されることを確認します。
4. マスコットキャラクターをドラッグしてウィンドウがスムーズに移動すること、およびドラッグ終了時にチャットウィンドウがトグルされない（クリックと判定されない）ことを確認します。
