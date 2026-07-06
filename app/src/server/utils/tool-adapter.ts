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

        // optional ラッパーの解決
        while (currentField) {
            const def = currentField._def || currentField.def;
            if (!def) break;

            const typeName = def.typeName;
            const type = def.type;

            if (typeName === 'ZodOptional' || type === 'optional') {
                isOptional = true;
                currentField = def.innerType;
            } else if (typeName === 'ZodNullable' || type === 'nullable') {
                isOptional = true;
                currentField = def.innerType;
            } else if (typeName === 'ZodDefault' || type === 'default') {
                isOptional = true; // デフォルト値が定義されている場合はオプション扱いにする
                currentField = def.innerType;
            } else if (typeName === 'ZodEffects') {
                currentField = def.schema;
            } else {
                break;
            }
        }

        const def = currentField && (currentField._def || currentField.def);
        const typeName = def ? (def.typeName || def.type) : '';
        const fieldSchema: any = {};

        if (typeName === 'ZodNumber' || typeName === 'number') {
            fieldSchema.type = 'number';
        } else if (typeName === 'ZodBoolean' || typeName === 'boolean') {
            fieldSchema.type = 'boolean';
        } else {
            fieldSchema.type = 'string';
        }

        const description = field.description || (currentField && currentField.description) || (def && def.description);
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
export function convertLmStudioToolToVercel(
    lmTool: any,
    onExecute?: (args: any, result: any) => void,
    onInterceptExecute?: (args: any) => Promise<any>
): any {
    const rawSchema = convertLmStudioSchemaToPlainJsonSchema(lmTool.parametersSchema);

    // jsonSchema() ヘルパーでラップして、parameters と inputSchema の両方に設定する
    const wrappedSchema = jsonSchema(rawSchema);

    return {
        description: lmTool.description || '',
        parameters: wrappedSchema,
        inputSchema: wrappedSchema,
        execute: async (args: any, { abortSignal }: { abortSignal?: AbortSignal } = {}) => {
            console.log(`[Tool Execution] Running "${lmTool.name}" with args:`, args);
            
            let toolResponse;
            if (onInterceptExecute) {
                try {
                    const intercepted = await onInterceptExecute(args);
                    if (intercepted !== undefined && intercepted !== null) {
                        toolResponse = intercepted;
                    }
                } catch (e: any) {
                    console.error(`[Tool Intercept Error] Intercepting execution of "${lmTool.name}" failed:`, e.message);
                }
            }

            if (toolResponse === undefined) {
                toolResponse = await lmTool.implementation(args, { abortSignal });
            }

            console.log(`[Tool Execution Result] "${toolResponse}"`);
            if (onExecute) {
                onExecute(args, toolResponse);
            }
            if (typeof toolResponse === 'string') {
                try {
                    return JSON.parse(toolResponse);
                } catch (e) {
                    return { result: toolResponse };
                }
            }
            return toolResponse;
        }
    };
}

