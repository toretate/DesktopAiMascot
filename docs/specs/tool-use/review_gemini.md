# tool-use 実装およびプロンプト分割のレビュー（Gemini）

| 項目 | 内容 |
| --- | --- |
| 実施日 | 2026-07-12 |
| 対象 | プロンプト分割・TS化リファクタリング適用後の最新のコードとプロンプト設計 |

---

## 1. はじめに

本ドキュメントでは、LLMツール使用プロンプトを個別の TS ファイルに分割し、動的に結合するリファクタリングを終えた「現在のコード構成」および「プロンプトテキストの内容」について、Gemini の視点から技術的な批評と改善の提言を行います。

---

## 2. コード構造に対するレビュー

### 🟢 評価できる点 (Strengths)

1. **Vite/Nitro ビルドと親和性の高い TS 読み込み設計**
    * 当初検討されていた `?raw`（Markdown プレーンテキスト読み込み）は、ビルドツール（特に Nitro のサーバー側 Rollup 設定）でファイルシステムとの不整合（ENOENT エラー）を起こす原因になっていました。
    * これに対し、プロンプトを `export default` な TypeScript 文字列モジュールに変換した設計は、非常に安全かつ高速で、かつアプリパッケージング時の資産コピー問題を完全に排除できており、極めて理にかなっています。
2. **エイリアス `@prompt` によるコード疎結合化**
    * `app/tsconfig.json` および `nuxt.config.ts` にエイリアスを設定し、`@prompt/` を用いてチャットAIサービスからスッキリ読み込めるようになったため、深い相対パスの依存が排除され、ソースコードの可読性が大幅に向上しました。
3. **ラジオプロンプトのハイブリッド設計**
    * [config-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/app/electron/ipc-handlers/config-handler.ts) における、「デフォルト値は静的 TS プロンプトを読み込み、ユーザーのカスタム設定ファイル（MD）が存在すればそれを上書きロードする」フォールバック構造は非常に堅牢です。パッケージ配布直後でも空の状態でエラーにならず、ユーザーによる個別編集・保存機能とも整合しています。

### 🔴 課題と改善推奨事項 (Critiques)

#### A. 🔴 依然として残る「インポートとトグル判定の同期漏れ」問題
リファクタリング後も、[chat-ai-service.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/app/src/server/utils/chat-ai-service.ts) では以下の2点を手動で同期する必要があります。
1. `@prompt/...` からインポートして `TOOL_PROMPTS` マップに追加する作業。
2. `filteredTools.filter` 内で、設定トグル名（例: `tools.toolsWeather !== false`）とツール名（例: `getWeather`）を switch-case で突き合わせる作業。

* **Gemini の提言**:
  将来的なツールの増減に備え、各ツールオブジェクト（例: `weatherTool`）の定義内にプロンプト文字列（`prompt`）や設定キー名（`configKey`）を直接メタデータとして持たせるようにすることを推奨します。
  これが実現できれば、`chat-ai-service.ts` 内の `TOOL_PROMPTS` や switch-case が完全に不要になり、以下のように自動でフィルタリングおよびプロンプト結合ができるようになります。
  ```typescript
  // 理想的な動的フィルタとプロンプト結合のイメージ
  const activeToolPrompts = filteredTools
      .filter(t => !tools || tools[t.configKey] !== false)
      .map(t => t.prompt);
  ```

---

## 3. プロンプトテキスト（文言）に対するレビュー

### 🟢 評価できる点 (Strengths)

1. **役割と記述のシンプルさ**
    * `getWeather.prompt.ts` や `adjustVolume.prompt.ts` などの各個別プロンプトは、1文〜2文で「何をするツールか」が極めて簡潔に記述されています。
    * Gemini などの高度な LLM に対しては、ツールを呼び出すべき状況や境界条件（どんな時に呼ぶか）は短い説明で十分に理解できるため、この記述量は最適です。

### 🔴 課題と改善推奨事項 (Critiques)

#### A. 🔴 `manageTasks.prompt.ts` の過密と「タイマー」との混同リスク
[manageTasks.prompt.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/app/src/skills/tool-use/prompts/manageTasks.prompt.ts) の内容には、ツール自体の使い方以外に、「タイマー通知タグ（TIMER）との重要な区別」や「過去の履歴を蒸し返さない」といったルールが長文で記載されています。
* **問題点**:
  この記述は、LLMがタスクを登録すべきか単にタイマーをかけるべきかを迷わせないための重要なルールですが、**「ツールの使用説明」の中に「タイマータグ（プロンプト側のハック記述）」の説明が入り混じっているため、モデルのコンテキスト解釈のノイズになる** 可能性があります。
* **Gemini の提言**:
  「タイマーとの区別」や「履歴の扱い」といった対話制御に関わるルールは、ツール（`manageTasks`）個別プロンプトから分離し、共通のガイドラインテンプレート（[tool-use-guideline.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/app/src/skills/tool-use/prompts/tool-use-guideline.ts)）側に移譲することを推奨します。

---

## 4. システムプロンプト構成全体とコンテキストキャッシュ

### A. 🔴 現在日時のインジェクト位置によるキャッシュ阻害
[chat-ai-service.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/app/src/server/utils/chat-ai-service.ts) では、システムプロンプトの構成が以下の順序になっています。
```typescript
const finalSystemPrompt = `${systemPrompt || ''}${timeInstruction}\n\n${toolUseGuideline}`;
```
* **問題点**:
  秒単位で変化する `timeInstruction` がプレフィックスの途中に挟まることで、Gemini API などの **コンテキストキャッシュ（Context Caching）**が毎ターン完全に破壊（キャッシュミス）されます。
* **推奨対応**:
  * `systemPrompt` と `toolUseGuideline` は「完全な静的システムプロンプト（キャッシュ可能）」としてシステム命令に一括設定します。
  * 変動する `timeInstruction` は、システム命令から除外し、メッセージ履歴（`messages`）の最後の `user` メッセージの直前に、独立したシステムメッセージまたはコンテキストとして差し込むように変更します。
