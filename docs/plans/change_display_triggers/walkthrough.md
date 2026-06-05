# 修正内容の確認 (Walkthrough): チャットウィンドウと設定ダイアログの表示トリガー変更

## 概要

マスコットを操作する際のチャットウィンドウと設定ダイアログの表示トリガーを変更し、より直感的に操作できるようにしました。
- **チャットウィンドウ**: マスコットを左クリック（シングルクリック）で表示・非表示をトグル。
- **設定ダイアログ**: マスコットを右クリックで表示。

これを実現するために、Electronの `-webkit-app-region: drag` によるドラッグの制限（クリックイベントがレンダープロセスに配信されない問題）を回避するため、Vue（JavaScript）側でウィンドウのドラッグ移動を処理し、ドラッグとクリック判定を両立させる実装を行いました。

---

## 変更内容

### 1. メインプロセス

#### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
- ウィンドウを相対移動させるためのIPCハンドラー `'drag-window'` を追加しました。
```typescript
    // 4. アプリ内ドラッグ移動の実装 (HTML要素をドラッグ可能にする場合のサポート)
    ipcMain.on('drag-window', (event, offset: { dx: number; dy: number }) => {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (win) {
            const [x, y] = win.getPosition();
            win.setPosition(x + offset.dx, y + offset.dy);
            syncChatWindowPosition();
            debouncedSaveMascotPosition();
        }
    });
```
- このハンドラーにより、マスコットウィンドウを移動させると同時に、追従するチャットウィンドウの位置も同期 (`syncChatWindowPosition()`) され、一定時間静止した後に位置を保存 (`debouncedSaveMascotPosition()`) します。

### 2. プリロードスクリプト

#### [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts)
- レンダラープロセスから安全に呼び出せるよう、`window.electronAPI.dragWindow` を追加しました。

#### [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)
- TypeScriptの型定義ファイルに `dragWindow: (offset: { dx: number; dy: number }) => void;` を追加しました。

### 3. レンダープロセス

#### [MascotViewer.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/MascotViewer.vue)
- `.mascot-character` 要素から `drag-area` クラスを除去しました（これによりクリックイベントが検知可能になります）。
- `mousedown`, `mousemove`, `mouseup` イベントをハンドリングし、ウィンドウのドラッグ移動をJSで擬似実装しました。
- ドラッグ開始から終了までに閾値（1px）以上の移動がなかった場合のみ「左クリック」とみなし、`toggleChat()` を呼び出すようにしました。
- 右クリック（`@contextmenu.prevent="openSettings"`）はそのまま維持し、マスコット右クリックで設定画面が開くようにしました。

---

## 検証結果

### ビルドの確認
`npm.cmd run build` を実行し、コンパイルエラーやトランスパイルエラーが発生しないことを確認しました。
```bash
> vue-tsc && vite build
vite v5.4.21 building for production...
✓ 268 modules transformed.
dist/assets/index-5yetol9y.js          479.26 kB
✓ built in 1.10s
...
dist-electron/main.js  14.83 kB
✓ built in 23ms
```

### 手動検証手順（期待される動作）
1. マスコットキャラクターを左クリックして、チャットウィンドウの表示・非表示がトグルされること。
2. マスコットキャラクターを右クリックして、設定ダイアログが表示されること。
3. マスコットキャラクターをドラッグしてウィンドウがスムーズに移動すること、およびドラッグ終了時にチャットウィンドウがトグルされない（クリックと判定されない）こと。
