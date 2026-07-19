import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const processFile = path.join(projectDir, 'node_modules', '.cache', 'tonarice', 'dev-nuxt.json');
const nuxtArguments = ['nuxt', 'dev', ...process.argv.slice(2)];

fs.mkdirSync(path.dirname(processFile), { recursive: true });
fs.writeFileSync(processFile, JSON.stringify({ pid: process.pid }), 'utf8');

const removeProcessFile = () => {
    try {
        const tracked = JSON.parse(fs.readFileSync(processFile, 'utf8'));
        if (tracked.pid === process.pid) fs.rmSync(processFile, { force: true });
    } catch {
        // 記録が存在しない場合は何もしない。
    }
};

const nuxtProcess = spawn('npx', nuxtArguments, {
    cwd: projectDir,
    shell: true,
    stdio: 'inherit'
});

nuxtProcess.on('close', (exitCode) => {
    removeProcessFile();
    process.exit(exitCode ?? 0);
});

process.on('exit', removeProcessFile);
