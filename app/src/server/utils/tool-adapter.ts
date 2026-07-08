/**
 * LM Studio SDK のツール定義を Vercel AI SDK のツール定義に変換します。
 * @param lmTool LM Studio SDK のツールオブジェクト
 */
export function convertLmStudioToolToVercel(
    lmTool: any,
    onExecute?: (input: any, output: any) => void,
    onInterceptExecute?: (input: any) => Promise<any>
): any {
    return {
        description: lmTool.description || '',
        inputSchema: lmTool.parametersSchema,
        execute: async (input: any, { abortSignal }: { abortSignal?: AbortSignal } = {}) => {
            console.log(`[Tool Execution] Running "${lmTool.name}" with input:`, input);
            
            let toolResponse;
            if (onInterceptExecute) {
                try {
                    const intercepted = await onInterceptExecute(input);
                    if (intercepted !== undefined && intercepted !== null) {
                        toolResponse = intercepted;
                    }
                } catch (e: any) {
                    console.error(`[Tool Intercept Error] Intercepting execution of "${lmTool.name}" failed:`, e.message);
                }
            }

            if (toolResponse === undefined) {
                toolResponse = await lmTool.implementation(input, { abortSignal });
            }

            console.log(`[Tool Execution Result] "${toolResponse}"`);
            if (onExecute) {
                onExecute(input, toolResponse);
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
