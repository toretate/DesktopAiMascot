---
name: vercel-ai-sdk
description: Vercel AI SDK v6.x の統合、ツール定義、Zod v3/v4 非互換性の解消、LM Studio 接続に関する指示と知見。
---

# Vercel AI SDK 統合ガイドライン (Mascot Agent)

このドキュメントは、本プロジェクトにおいて Vercel AI SDK (特に v6.x 以降) を使用して AI Mascot の対話エンジンや自律ツールループ (Tool Use) を統合・開発する際の指示および重要な知見をまとめたスキルファイルです。

---

## 1. ツール定義のキー名仕様 (`inputSchema`)

Vercel AI SDK v6.x の内部（`generateText` 共通処理および各プロバイダー）は、ツールのパラメータスキーマを参照する際に `parameters` ではなく **`inputSchema`** プロパティを使用します。

### 重要なルール:
- プレーンオブジェクト形式でツールを定義する場合、必ず `inputSchema` にスキーマオブジェクトを設定してください。
- `parameters` のみにセットした場合、実行時にスキーマが無視され、API 送信時に空の `{ properties: {}, additionalProperties: false }` にリセットされます。
- TypeScript のビルド型定義との互換性を維持するため、**`inputSchema` と `parameters` の両方に同じスキーマをセットする**ことを強く推奨します。

```typescript
// 推奨されるツール定義の戻り値オブジェクト
return {
    description: 'ツールの説明',
    parameters: wrappedSchema,   // TypeScript型定義互換用
    inputSchema: wrappedSchema,  // Vercel AI SDK 6.x 実質実行用
    execute: async (args) => {
        // 処理内容
    }
};
```

---

## 2. Zod バージョン非互換 (v3 / v4) および二重ロード問題の解決

ローカルLLM SDK (`@lmstudio/sdk` など) が内部で Zod v3 を依存関係として持っており、プロジェクト本体が Zod v4 で動作している場合、モジュール解決における「二重解決 (物理ファイルの違い)」により `instanceof` などの判定がすり抜けます。この結果、Zod オブジェクトを直接または `zodSchema` でラップして渡しても、シリアライズ時にプロパティが一切抽出できず空のスキーマになるバグが発生します。

### 解決策 (プレーンな JSON Schema の再構築と `jsonSchema` ヘルパーの使用):
Zod オブジェクトをそのまま渡すのをやめ、Zod の `shape` プロパティから型情報を動的に読み取ってプレーンな JSON Schema オブジェクトに変換し、Vercel AI SDK の **`jsonSchema()`** ヘルパーでラップして渡します。

#### 手動変換ヘルパーの実装例:
```typescript
import { jsonSchema } from 'ai';

function convertLmStudioSchemaToPlainJsonSchema(parametersSchema: any): any {
    const schema: any = {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
    };

    if (!parametersSchema || !parametersSchema.shape) {
        return schema;
    }

    const shape = parametersSchema.shape;
    for (const key of Object.keys(shape)) {
        const field = shape[key];
        
        let isOptional = false;
        let currentField = field;

        // optional ラッパーの解決
        while (currentField && currentField.def) {
            if (currentField.def.type === 'optional') {
                isOptional = true;
                currentField = currentField.def.innerType;
            } else {
                break;
            }
        }

        const fieldType = currentField && currentField.def ? currentField.def.type : 'string';
        const fieldSchema: any = {};

        if (fieldType === 'number') {
            fieldSchema.type = 'number';
        } else if (fieldType === 'boolean') {
            fieldSchema.type = 'boolean';
        } else {
            fieldSchema.type = 'string';
        }

        const description = field.description || (currentField && currentField.description);
        if (description) {
            fieldSchema.description = description;
        }

        schema.properties[key] = fieldSchema;

        if (!isOptional) {
            schema.required.push(key);
        }
    }

    return schema;
}
```

---

## 3. LM Studio (ローカルLLM) 接続時のモデルプロバイダー設定

LM Studio などの OpenAI 互換ローカルサーバーに接続する際、`createOpenAI` から生成したプロバイダーのデフォルトオブジェクト `lmstudio(model)` は、最新の OpenAI Responses API (`/v1/responses`) を使用しようとします。
LM Studio はこれをサポートしていないため、接続時に `400 Bad Request` または `500` エラーが発生します。

### 解決策:
必ず **`lmstudio.chat(model)`** を呼び出して、従来の Chat Completions API (`/v1/chat/completions`) を使用するように明示してください。

```typescript
const lmstudio = createOpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'not-needed',
});

// chat() を明示的に指定して互換エンドポイントを叩く
const modelProvider = lmstudio.chat(model || 'unspecified');
```
