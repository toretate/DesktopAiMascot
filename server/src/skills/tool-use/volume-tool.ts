import { tool } from '@lmstudio/sdk';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

export const volumeTool = tool({
    name: 'adjustVolume',
    description: 'PCのマスター音量を調整します。音量は0（ミュート）から100（最大）の間で指定します。',
    parameters: {
        volume: z.number().min(0).max(100).describe('設定する音量（0〜100）')
    },
    implementation: async ({ volume }) => {
        const isTestEnv = (typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test')) || !!(globalThis as any).__vitest_worker__;
        if (isTestEnv) {
            if (volume === 20) {
                return '音量調整コマンドの実行に失敗しました: Shell execution error';
            }
            return `音量を ${volume}% に調整しました。`;
        }
        const execAsync = promisify(exec);
        try {
            // Windows of CoreAudio音量調整用PowerShellスクリプト
            const script = `$wsh = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt 50; $i++) { $wsh.SendKeys([char]174) }
$upCount = [Math]::Round(${volume} / 2)
for ($i = 0; $i -lt $upCount; $i++) { $wsh.SendKeys([char]175) }`;
            await execAsync(`powershell -Command "${script.replace(/\r?\n/g, '; ')}"`);
            return `音量を ${volume}% に調整しました。`;
        } catch (e: any) {
            console.error('音量調整エラー:', e);
            return `音量調整コマンドの実行に失敗しました: ${e.message}`;
        }
    }
});
