import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Nuxt サーバーが完全に起動し、200 OK を返すのを待つ
async function waitForNuxt(url, timeout = 60000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const res = await fetch(url);
            if (res.status === 200) {
                return;
            }
            console.log(`[DevElectron] Nuxt dev server status: ${res.status}. Waiting...`);
        } catch (e) {
            // 接続できない場合はリトライ
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Timeout waiting for Nuxt dev server at ${url}`);
}

async function start() {
    console.log('[DevElectron] Waiting for Nuxt dev server to be fully ready...');
    try {
        await waitForNuxt('http://localhost:3000/');
        console.log('[DevElectron] Nuxt dev server is ready! Building main process...');
    } catch (e) {
        console.error('[DevElectron] Nuxt dev server was not ready. Exiting.');
        process.exit(1);
    }

    // tsup で electron メインプロセスのビルド & ウォッチを開始
    console.log('[DevElectron] Starting tsup watch for Electron scripts...');
    const tsup = spawn('npx', ['tsup', '--watch'], {
        cwd: projectRoot,
        shell: true,
        stdio: 'inherit'
    });

    // 少し待ってから Electron を起動
    setTimeout(() => {
        console.log('[DevElectron] Launching Electron...');
        const electronProcess = spawn('npx', ['electron', '.'], {
            cwd: projectRoot,
            shell: true,
            stdio: 'inherit',
            env: {
                ...process.env,
                VITE_DEV_SERVER_URL: 'http://localhost:3000/'
            }
        });

        electronProcess.on('close', () => {
            console.log('[DevElectron] Electron closed. Stopping watch processes...');
            tsup.kill();
            process.exit(0);
        });
    }, 3000);
}

start();
