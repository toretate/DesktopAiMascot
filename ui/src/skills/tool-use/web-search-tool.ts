import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

export const webSearchTool = tool({
    name: 'searchWeb',
    description: 'インターネット検索を行い、指定されたクエリに関するWebページのタイトルと要約（スニペット）を取得します。',
    parameters: {
        query: z.string().describe('検索キーワード')
    },
    implementation: async ({ query }) => {
        try {
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!res.ok) {
                return 'Web検索に失敗しました。';
            }
            const html = await res.text();
            
            const results: { title: string; snippet: string; url: string }[] = [];
            const resultBlocks = html.split('<div class="result results_links results_links_deep web-result');
            
            let count = 0;
            for (let i = 1; i < resultBlocks.length && count < 3; i++) {
                const block = resultBlocks[i];
                const titleMatch = block.match(/<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
                
                if (titleMatch) {
                    const link = titleMatch[1];
                    const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
                    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    results.push({ title, snippet, url: link });
                    count++;
                }
            }

            if (results.length === 0) {
                return '検索結果が見つかりませんでした。';
            }

            return JSON.stringify(results.map(r => ({
                title: r.title,
                snippet: r.snippet,
                url: r.url
            })));
        } catch (e: any) {
            console.error('Web検索エラー:', e);
            return `Web検索中にエラーが発生しました: ${e.message}`;
        }
    }
});
