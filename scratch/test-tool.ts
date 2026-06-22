import { LMStudioClient, Chat, tool } from '@lmstudio/sdk';

async function runTest() {
    const endpoint = 'ws://127.0.0.1:1234';
    console.log(`[Test] Connecting to LM Studio at ${endpoint}...`);
    try {
        const client = new LMStudioClient({ baseUrl: endpoint });
        const downloaded = await client.system.listDownloadedModels();
        const llmModels = downloaded.filter(m => m.type === 'llm');
        
        if (llmModels.length === 0) {
            console.error('[Test] No LLM models loaded in LM Studio.');
            return;
        }
        
        const modelKey = llmModels[0].modelKey || llmModels[0].path || '';
        console.log(`[Test] Using loaded model: ${modelKey}`);
        
        const llm = await client.llm.model(modelKey);
        
        const testTool = tool({
            name: 'getCurrentTime',
            description: '現在のシステム時刻（日付と時間）を取得します。',
            parameters: {},
            implementation: () => {
                const now = new Date().toLocaleString('ja-JP');
                console.log(`[Test] Tool getCurrentTime executed! Result: ${now}`);
                return now;
            }
        });
        
        const chat = Chat.from([
            { role: 'user', content: '今何時？' }
        ]);
        
        console.log('[Test] Sending act request...');
        const result = await llm.act(chat, [testTool]);
        console.log('[Test] Act complete. Rounds:', result.rounds);
        
        console.log('[Test] Messages after act:');
        for (const msg of chat.getMessagesArray()) {
            console.log(`- Role: ${msg.getRole()}`);
            console.log(`  Text: "${msg.getText()}"`);
            if (msg.getToolCallRequests) {
                console.log(`  Tool Calls:`, msg.getToolCallRequests().map(t => t.name));
            }
        }
    } catch (e: any) {
        console.error('[Test] Error during test execution:', e);
    }
}

runTest();
