import { tool } from '@lmstudio/sdk';

export const currentTimeTool = tool({
    name: 'getCurrentTime',
    description: '現在のシステム時刻（日付と時間）を取得します。',
    parameters: {},
    implementation: () => {
        return new Date().toLocaleString('ja-JP');
    }
});
