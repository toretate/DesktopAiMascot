const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\watta\\.gemini\\antigravity-ide\\brain\\3f74a4b2-7be9-4ddf-91aa-e2fb990bb921\\.system_generated\\logs\\transcript.jsonl', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'VIEW_FILE') {
            const str = JSON.stringify(obj);
            if (str.includes('SettingsWindow.vue')) {
                console.log(`[Step ${obj.step_index || i}] VIEW_FILE:`);
                const content = obj.content || '';
                const matchPath = content.match(/File Path: `([^`]+)`/);
                const matchLines = content.match(/Showing lines (\d+) to (\d+)/);
                const totalLines = content.match(/Total Lines: (\d+)/);
                console.log(`  Path: ${matchPath ? matchPath[1] : 'unknown'}`);
                console.log(`  Showing: ${matchLines ? matchLines[1] + ' to ' + matchLines[2] : 'unknown'}`);
                console.log(`  Total: ${totalLines ? totalLines[1] : 'unknown'}`);
                console.log(`  Len: ${content.length}`);
                
                fs.writeFileSync(`view_step_${obj.step_index || i}.txt`, content, 'utf8');
            }
        }
    } catch(e) {}
}
