import { describe, test, expect, vi } from 'vitest';
import { convertLmStudioToolToVercel } from '../tool-adapter';
import { tool } from '@lmstudio/sdk';
import { z } from 'zod';
import type { Tool } from '@lmstudio/sdk';

describe('tool-adapter のテスト', () => {
    test('1. implementation が JSON 文字列を返す → パース済みオブジェクトが返る', async () => {
        const fakeTool = tool({
            name: 'testTool',
            description: 'test',
            parameters: {
                val: z.string()
            },
            implementation: async () => {
                return JSON.stringify({ success: true, data: 'ok' });
            }
        });

        const converted = convertLmStudioToolToVercel(fakeTool);
        const result = await converted.execute!({ val: 'hello' }, { toolCallId: 't1', messages: [] } as any);

        expect(result).toEqual({ success: true, data: 'ok' });
    });

    test('2. implementation が 非 JSON 文字列を返す → { result: String } にラップされる', async () => {
        const fakeTool = tool({
            name: 'testTool',
            description: 'test',
            parameters: {
                val: z.string()
            },
            implementation: async () => {
                return 'plain text response';
            }
        });

        const converted = convertLmStudioToolToVercel(fakeTool);
        const result = await converted.execute!({ val: 'hello' }, { toolCallId: 't1', messages: [] } as any);

        expect(result).toEqual({ result: 'plain text response' });
    });

    test('3. onInterceptExecute が値を返す → implementation は呼ばれず、intercept の値が使われ、onExecute に通知される', async () => {
        const implSpy = vi.fn().mockResolvedValue('impl-result');
        const fakeTool = tool({
            name: 'testTool',
            description: 'test',
            parameters: {
                val: z.string()
            },
            implementation: implSpy
        });

        const onExecute = vi.fn();
        const onInterceptExecute = vi.fn().mockResolvedValue('intercept-result');

        const converted = convertLmStudioToolToVercel(fakeTool, onExecute, onInterceptExecute);
        const result = await converted.execute!({ val: 'hello' }, { toolCallId: 't1', messages: [] } as any);

        expect(implSpy).not.toHaveBeenCalled();
        expect(onInterceptExecute).toHaveBeenCalledWith({ val: 'hello' });
        expect(result).toEqual({ result: 'intercept-result' });
        expect(onExecute).toHaveBeenCalledWith({ val: 'hello' }, 'intercept-result');
    });

    test('4. onInterceptExecute が throw する → 握りつぶされ、implementation にフォールバックする', async () => {
        const implSpy = vi.fn().mockResolvedValue('impl-result');
        const fakeTool = tool({
            name: 'testTool',
            description: 'test',
            parameters: {
                val: z.string()
            },
            implementation: implSpy
        });

        const onExecute = vi.fn();
        const onInterceptExecute = vi.fn().mockRejectedValue(new Error('Intercept Error'));

        const converted = convertLmStudioToolToVercel(fakeTool, onExecute, onInterceptExecute);
        const result = await converted.execute!({ val: 'hello' }, { toolCallId: 't1', messages: [] } as any);

        expect(implSpy).toHaveBeenCalled();
        expect(result).toEqual({ result: 'impl-result' });
        expect(onExecute).toHaveBeenCalledWith({ val: 'hello' }, 'impl-result');
    });

    test('5. lmTool.type が function 以外 → throw する', () => {
        const badTool: Tool = {
            name: 'badTool',
            description: 'bad',
            type: 'remote' as any
        } as any;

        expect(() => convertLmStudioToolToVercel(badTool)).toThrowError(
            '[tool-adapter] Unsupported tool type "remote" for "badTool". Only FunctionTool is supported.'
        );
    });
});
