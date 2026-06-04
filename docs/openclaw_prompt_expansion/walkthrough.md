# 修正内容の確認 (Walkthrough): OpenClawプロンプト構造の拡張

OpenClawプロンプトのうち、会話の制御と記憶に直結する **`agents.md`（行動規範）** および **`memory.md`（長期記憶）** のサポートと、UI上の編集機能の追加を完了しました。

## 変更内容

### 1. IPC通信およびAPI定義の拡張
- **[main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)**
  - `get-mascot-prompts` を拡張し、`agents.md` / `memory.md` も読み込んで返すようにしました（未存在時は初期テンプレートを自動生成）。
  - `save-mascot-prompts` を拡張し、`agents` / `memory` の書き込みをサポートしました。
- **[preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/preload.ts)** & **[electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/electron.d.ts)**
  - 引数と戻り値に `agents`, `memory` を含めるよう型定義とシグネチャを更新しました。

### 2. フロントエンド UI の拡張
- **[PromptEditorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/PromptEditorModal.vue)**
  - モーダル内に `Agents` と `Memory` のテキストエリアを追加しました。
  - それぞれが何を設定するものであるかの解説文を表示するようにしました。
- **[MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/MascotSettings.vue)**
  - プロフィール詳細のプレビュー領域に `Agents.md` と `Memory.md` の内容を readonly で表示するエリアを追加しました。

### 3. システムプロンプト結合ロジックの更新
- **[ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/ChatPanel.vue)**
  - システムプロンプトの構築処理において、`mascotPrompts.agents` と `mascotPrompts.memory` の値が存在する場合に、それぞれ `# Mascot Rules & Action Guidelines`、`# Mascot Long-term Memory` ヘッダーを付与して結合するよう実装を更新しました。

---

## 検証結果

- `vue-tsc && vite build` によるコンパイルがエラーなしで正常終了することを確認しました。
- `vitest run` によるフロントエンドのユニットテストがすべて正常にパスすることを確認しました。
