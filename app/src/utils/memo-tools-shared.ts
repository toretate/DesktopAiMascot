import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

export const manageMemos = tool({
    name: 'manageMemos',
    description: '期限のない自由メモ・覚え書きの追加・検索・更新・削除を行う。買い物リストや思いつき等、後から一覧で見返したいがスケジュール管理の不要なものに使う。期限付きの予定/TODO は manageTasks、その場限りの一度きり通知はタイマーを使うこと（混同しない）。',
    parameters: {
        action: z.enum(['add', 'search', 'update', 'delete']).describe('操作種別。add=追加、search=検索、update=更新、delete=削除'),
        content: z.string().optional().describe('メモ本文（add時は必須）'),
        id: z.string().optional().describe('対象メモID（update/delete時は必須）'),
        query: z.string().optional().describe('本文の検索キーワード（search時）'),
        color: z.string().optional().describe('付箋色（任意）'),
        pinned: z.boolean().optional().describe('ピン留め（任意）')
    },
    // 実際の処理はサーバー側で行うためスタブ
    implementation: async (params) => {
        return params;
    }
});
