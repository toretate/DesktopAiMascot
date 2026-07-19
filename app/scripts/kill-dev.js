import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const processFiles = [
    path.join(projectDir, 'node_modules', '.cache', 'tonarice', 'dev-electron.json'),
    path.join(projectDir, 'node_modules', '.cache', 'tonarice', 'dev-nuxt.json')
];
const dryRun = process.argv.includes('--dry-run');

function readTrackedProcessId(processFile) {
    try {
        const tracked = JSON.parse(fs.readFileSync(processFile, 'utf8'));
        return Number.isInteger(tracked.pid) ? tracked.pid : null;
    } catch {
        return null;
    }
}

function stopProcessTree(processId, reason) {
    if (processId === process.pid || processId === process.ppid) return;
    console.log(`[kill] ${dryRun ? '対象' : '終了'}: PID ${processId} (${reason})`);
    if (!dryRun) {
        try {
            execFileSync('taskkill.exe', ['/PID', String(processId), '/T', '/F'], {
                stdio: 'inherit',
                windowsHide: true
            });
        } catch (error) {
            // 先に親プロセスと一緒に終了済みなら成功扱いにする。
            if (error?.status !== 128) throw error;
        }
    }
}

function stopWindowsProcesses() {
    const targets = new Map();
    for (const processFile of processFiles) {
        const trackedProcessId = readTrackedProcessId(processFile);
        if (trackedProcessId) targets.set(trackedProcessId, path.basename(processFile, '.json'));
    }

    if (targets.size === 0) {
        console.log('[kill] tonarice の開発プロセスは見つかりませんでした。');
        return;
    }

    for (const [processId, reason] of targets) {
        stopProcessTree(processId, reason);
    }

    if (!dryRun) {
        for (const processFile of processFiles) fs.rmSync(processFile, { force: true });
    }
}

if (process.platform === 'win32') {
    stopWindowsProcesses();
} else {
    console.error('[kill] このスクリプトは現在Windowsのみをサポートしています。');
    process.exitCode = 1;
}
