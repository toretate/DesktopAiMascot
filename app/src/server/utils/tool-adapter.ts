import { dynamicTool } from 'ai';
import type { FlexibleSchema } from 'ai';
import type { Tool as LMTool, FunctionTool, ToolCallContext } from '@lmstudio/sdk';

/**
 * LM Studio SDK のツール定義を Vercel AI SDK のツール定義に変換します。
 * @param lmTool LM Studio SDK のツールオブジェクト
 * @param onExecute ツール実行完了時に呼び出される通知コールバック
 * @param onInterceptExecute ツール実行を横取りし、カスタムの実行結果を返すインターセプトコールバック
 */
export function convertLmStudioToolToVercel(
    lmTool: LMTool,
    onExecute?: (input: unknown, output: unknown) => void,
    onInterceptExecute?: (input: unknown) => Promise<unknown>
) {
    if (lmTool.type !== 'function') {
        throw new Error(
            `[tool-adapter] Unsupported tool type "${lmTool.type}" for "${lmTool.name}". Only FunctionTool is supported.`
        );
    }

    const functionTool = lmTool as FunctionTool;

    return dynamicTool({
        description: functionTool.description || '',
        // 注意: zodSchema() やジェネリック推論を経由すると、SDK の ZodSchema（ZodType<any>）に対する
        // 型インスタンス化が爆発し TS2589 / tsc の OOM クラッシュを引き起こす。
        // 実行時には zod スキーマをそのまま受け付けられる（FlexibleSchema は zod を含む）ため、
        // 推論を完全に回避する型表明で受け渡す。
        inputSchema: functionTool.parametersSchema as unknown as FlexibleSchema<unknown>,
        execute: async (input: unknown, { abortSignal }) => {
            console.log(`[Tool Execution] Running "${functionTool.name}" with input:`, input);

            let toolResponse: unknown;
            if (onInterceptExecute) {
                try {
                    const intercepted = await onInterceptExecute(input);
                    if (intercepted !== undefined && intercepted !== null) {
                        toolResponse = intercepted;
                    }
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : String(e);
                    console.error(`[Tool Intercept Error] Intercepting execution of "${functionTool.name}" failed:`, errMsg);
                }
            }

            if (toolResponse === undefined) {
                const ctx: ToolCallContext = {
                    status: () => {},
                    warn: (text) => console.warn(`[Tool Warning] ${functionTool.name}: ${text}`),
                    signal: abortSignal ?? new AbortController().signal,
                    callId: 0,
                };
                toolResponse = await functionTool.implementation(input as Record<string, unknown>, ctx);
            }

            console.log(`[Tool Execution Result] "${toolResponse}"`);
            if (onExecute) {
                onExecute(input, toolResponse);
            }

            if (typeof toolResponse === 'string') {
                try {
                    return JSON.parse(toolResponse) as unknown;
                } catch (e) {
                    return { result: toolResponse };
                }
            }
            return toolResponse;
        }
    });
}
