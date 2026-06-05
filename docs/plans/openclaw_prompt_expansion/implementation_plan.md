# OpenClawプロンプト構造の拡張（AGENTS.md / MEMORY.md のサポート）実装計画

OpenClawプロンプト構造のうち、特にAIの対話挙動を制御・記憶させるために有用な **`AGENTS.md`（行動規範）** と **`MEMORY.md`（長期記憶）** を新たにシステムプロンプトの構成要素としてサポートし、UI（設定画面・編集モーダル）からもアクセス・編集できるように拡張します。

## ユーザーレビュー要求事項

> [!NOTE]
> - `HEARTBEAT.md`（自律行動）や `memory/`（日次記録）は、バックグラウンドでの定時実行や自動日記生成などの複雑な自動化機能と結びつくため、今回はまずシステムプロンプトに直接マージ可能な **`AGENTS.md`** と **`MEMORY.md`** を優先してサポートします。

## 変更内容の提案

---

### 1. IPC通信（Electron）の拡張

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `get-mascot-prompts` ハンドラーを拡張し、`agents.md` および `memory.md` の読み込みをサポートします。
  - ファイルが存在しない場合は、それぞれ役割解説付きのデフォルトテンプレートを生成します。
- `save-mascot-prompts` ハンドラーを拡張し、`agents` と `memory` の書き込み保存をサポートします。

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/preload.ts) & [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/electron.d.ts)
- `getMascotPrompts` と `saveMascotPrompts` の型定義とシグネチャを拡張します。
  ```typescript
  prompts: { soul: string; identity: string; user: string; agents: string; memory: string }
  ```

---

### 2. フロントエンド UI（設定画面）の拡張

#### [MODIFY] [PromptEditorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/PromptEditorModal.vue)
- 編集用ダイアログに `Agents` と `Memory` のテキストエリアを追加します。
- それぞれ何を設定するための項目なのか、分かりやすい解説を配置します。
  - **Agents (行動規範 / ルール)**: 回答にあたっての判断基準、絶対に守るべき制約事項、安全基準。
  - **Memory (長期記憶 / 合意事項)**: 以前の対話で交わされた約束事、決定した重要な事項、お互いの共通認識。

#### [MODIFY] [MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/MascotSettings.vue)
- プロフィールサブタブの「詳細プロンプト設定 (外部ファイル)」セクションに、`agents.md` と `memory.md` の非編集（readonly）表示エリアを追加します。

---

### 3. AI対話エンジン（システムプロンプト結合）の修正

#### [MODIFY] [ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/ChatPanel.vue)
- AIに送信するシステムプロンプトを構築する際、`agents` および `memory` プロンプトも結合するようにします。
  - `# Mascot Rules & Action Guidelines` (Agents.md)
  - `# Mascot Long-term Memory` (Memory.md)
  のヘッダーを付与して結合します。

## 検証計画

### 自動ビルドとテスト
- `npm run build` および `npm run test` が正常に通過することを確認します。

### 手動確認
- 設定画面を開き、新しく追加された `Agents` や `Memory` のプレビューが表示されているか確認します。
- 編集ダイアログを開き、これらを編集・保存して、実際にプロジェクト直下の `mascots/<マスコットID>/` 内に `agents.md` や `memory.md` が保存されることを確認します。
- AIとチャットし、`agents.md` で指定した制約や `memory.md` に書いた記憶を考慮した返答が行われるかテストします。
