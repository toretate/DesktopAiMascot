import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

export const manageTasksToolShared = tool({
    name: 'manageTasks',
    description: 'ユーザーが管理する「永続的なTODO（タスク）／予定（スケジュール）」の追加・検索・更新・削除を行います。ここで add したものはユーザーのタスク一覧に保存され、後から一覧で確認・管理できます（例:「レポートを書く」「明日15時に会議」「今週中に買い物」）。\n【重要】「3分後に通知して」「10分後に教えて」「後でお知らせして」「カップ麺ができたら教えて」のような、その場限りで一覧に残さない一時的なリマインド／通知（マスコットが一度だけ声かけするもの）は、このツールでは絶対に登録しないでください。それらはタイマー通知の仕組み（応答文に付与するタイマータグ）で扱います。判断基準: ユーザーが後で一覧から管理・確認したいもの＝manageTasks、その場限りの一度きりの通知＝タイマー。',
    parameters: {
        action: z.enum(['add', 'search', 'update', 'delete']).describe('実行する操作。add=追加、search=検索、update=更新、delete=削除。'),
        title: z.string().optional().describe('タスク・予定のタイトル（add 時は必須）'),
        scheduledAt: z.string().nullable().optional().describe('予定日時（カレンダー的な予定の日時）。ISO 8601形式の文字列 (例: 2026-07-06T18:00:00+09:00)。add 時に指定すると期限付きの予定になり、省略すると期限なしタスクになる。update 時に空文字列 "" または null を指定すると期限を削除できる。※「N分後に通知」のような一時的リマインドを表すためにここへ相対時刻を入れてはいけません（それはタイマーで扱う）。'),
        priority: z.enum(['normal', 'star', 'thunder']).optional().describe('優先度。デフォルトは normal。'),
        categoryId: z.string().optional().describe('追加先のカテゴリID。Work（仕事）の場合は default、Private（プライベート）の場合は private を指定してください。'),
        id: z.string().optional().describe('操作対象のタスクID（update・delete 時は必須）'),
        query: z.string().optional().describe('タイトルに含まれる検索キーワード（search 時）'),
        date: z.string().optional().describe('検索対象の予定日。YYYY-MM-DD形式の文字列（search 時）'),
        completed: z.boolean().optional().describe('search 時は完了状態で絞り込む条件（true=完了, false=未完了, 未指定=両方）。update 時は更新後の完了状態。')
    },
    implementation: async ({ action, title, scheduledAt, priority, categoryId, id, query, date, completed }) => {
        return JSON.stringify({
            success: true,
            action,
            title,
            scheduledAt,
            priority,
            categoryId,
            id,
            query,
            date,
            completed
        });
    }
});
