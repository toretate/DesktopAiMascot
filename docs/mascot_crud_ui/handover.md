# マスコット編集機能拡張 作業引き継ぎ資料

## 1. 完了した実装項目
以下の機能は実装済みであり、ビルド（`npm run build`）も正常に通過します。

- **ベースアバターの画像対応**:
    - 絵文字だけでなく、ローカル画像（Base64）をアバター本体として登録可能。
- **AI表情スキャナー (Gemini Vision連携)**:
    - `gemini-3.1-flash-lite` を使用し、スプライトシートから表情を自動検出・命名・切り出し（Canvas使用）して一括登録する機能。
- **表情ごとの個別位置・サイズ調整**:
    - `MascotAsset` 型を拡張し、`offsetX`, `offsetY`, `scale` を保持。
    - 設定画面に「クイック微調整パネル」を実装し、スライダーでリアルタイムにプレビュー調整可能。
- **データ永続化の基盤**:
    - `electron/main.ts` およびフロントエンドの型定義を同期し、`config.json` への保存ロジックを修正。

## 2. 現在発生している課題（要調査）
- **保存後のマスコットウィンドウへの不反映**:
    - エディタで「保存」ボタンを押し、`update-app-config` IPC経由で `config.json` が更新され、全ウィンドウに `config-updated` がブロードキャストされている。
    - しかし、マスコットウィンドウ（`MascotViewer.vue`）側の表示が「標準」状態から変わらず、保存したはずの調整値やアセット選択が適用されない。

### 疑わしい点（デバッグのヒント）
1. **Vueのリアクティビティ**: `mascots` 配列内の深い階層（`assets.expressions[n].offsetX` など）が更新された際、`MascotViewer.vue` の `computed` プロパティ（`activeExpressionStyle` 等）が再計算されていない可能性がある。
2. **データの同期タイミング**: `loadMascotConfig` 関数で `mascots.value` を置き換える際、オブジェクトの参照が新しくなることで既存の `computed` が追従できているか。
3. **IDの不一致**: `currentOutfitId` や `currentPoseId` が保存時に正しくセットされているか、または読み込み時に型変換（string/number）の影響で `find` に失敗していないか。

## 3. 関連ファイル
- `electron/main.ts`: IPCハンドラー、型定義、データ保存
- `src/electron.d.ts`: TypeScript型定義
- `src/components/settings/SettingsWindow.vue`: エディタUI、微調整パネル、保存処理
- `src/components/MascotViewer.vue`: デスクトップ表示、感情・アセット解決ロジック

## 4. 次回への申し送り
マスコットウィンドウ側での `console.log` 等による受信データの確認と、`activeExpressionStyle` 内でのアセット検索ロジック（`find`）が正しくヒットしているかの検証から開始することを推奨します。
