const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\watta\\.gemini\\antigravity-ide\\brain\\3f74a4b2-7be9-4ddf-91aa-e2fb990bb921\\.system_generated\\logs\\transcript.jsonl', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // We look for any step that contains SettingsWindow.vue and is a view_file response
        const str = JSON.stringify(obj);
        if (str.includes('SettingsWindow.vue')) {
            console.log(`[Step ${obj.step_index || i}] type: ${obj.type || 'none'}, status: ${obj.status || 'none'}, source: ${obj.source || 'none'}`);
            if (obj.content && obj.content.length > 500) {
                console.log(`  content length: ${obj.content.length}`);
            }
            if (obj.output && obj.output.length > 500) {
                console.log(`  output length: ${obj.output.length}`);
            }
        }
    } catch(e) {}
}
