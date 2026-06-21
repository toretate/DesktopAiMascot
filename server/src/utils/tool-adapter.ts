import { jsonSchema } from 'ai';

/**
 * Zod v3 or Zod-like parametersSchema object from LM Studio SDK to plain JSON Schema
 */
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

/**
 * LM Studio SDK のツール定義を Vercel AI SDK のツール定義に変換します。
 * @param lmTool LM Studio SDK のツールオブジェクト
 */
export function convertLmStudioToolToVercel(lmTool: any): any {
    const rawSchema = convertLmStudioSchemaToPlainJsonSchema(lmTool.parametersSchema);

    // jsonSchema() ヘルパーでラップして、parameters と inputSchema の両方に設定する
    const wrappedSchema = jsonSchema(rawSchema);

    return {
        description: lmTool.description || '',
        parameters: wrappedSchema,
        inputSchema: wrappedSchema,
        execute: async (args: any, { abortSignal }: { abortSignal?: AbortSignal } = {}) => {
            // 既存の implementation は引数オブジェクトを受け取る
            return await lmTool.implementation(args, { abortSignal });
        }
    };
}

