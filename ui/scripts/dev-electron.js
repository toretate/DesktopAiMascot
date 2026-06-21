import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// 指定したポートが起動するのを待つ
function waitForPort(port, host, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const socket = new net.Socket();
            socket.setTimeout(1000);
            socket.on('connect', () => {
                socket.destroy();
                resolve();
            });
            socket.on('error', () => {
                socket.destroy();
                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for port ${port}`));
                } else {
                    setTimeout(check, 1000);
                }
            });
            socket.connect(port, host);
        };
        check();
    });
}

async function start() {
    console.log('[DevElectron] Waiting for Nuxt dev server on port 3000...');
    try {
        await waitForPort(3000, 'localhost');
        console.log('[DevElectron] Nuxt dev server detected! Building main process...');
    } catch (e) {
        console.error('[DevElectron] Nuxt dev server not detected. Exiting.');
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
