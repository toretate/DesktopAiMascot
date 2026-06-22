import { spawn, exec } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// プロセスツリーを確実に強制終了する関数 (Windows対策)
function killProcess(childProcess) {
    if (!childProcess) return;
    if (process.platform === 'win32') {
        exec(`taskkill /pid ${childProcess.pid} /T /F`, (err) => {
            // エラーログは通常不要なので無視
        });
    } else {
        childProcess.kill();
    }
}

// Nuxt サーバーが起動しているか確認し、起動していなければ自動で立ち上げる
async function ensureNuxt(url, timeout = 60000) {
    let nuxtProcess = null;
    
    // ポートが既に使用されているか（fetchで何らかの応答、あるいはエラー以外が返るか）確認
    try {
        await fetch(url);
        console.log('[DevElectron] Nuxt dev server is already running or port 3000 is occupied.');
    } catch (e) {
        // 接続できない場合（ECONNREFUSEDなど）のみ、新しく立ち上げる
        console.log('[DevElectron] Nuxt dev server is not running. Starting it now...');
        nuxtProcess = spawn('npx', ['nuxt', 'dev'], {
            cwd: projectRoot,
            shell: true,
            stdio: 'inherit'
        });
    }

    // 起動して 200 OK を返すのを待つ
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const res = await fetch(url);
            if (res.status === 200) {
                return nuxtProcess;
            }
            console.log(`[DevElectron] Nuxt dev server status: ${res.status}. Waiting...`);
        } catch (e) {
            // 接続できない場合はリトライ
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (nuxtProcess) {
        killProcess(nuxtProcess);
    }
    throw new Error(`Timeout waiting for Nuxt dev server at ${url}`);
}

async function start() {
    let nuxtProcess = null;
    console.log('[DevElectron] Checking Nuxt dev server status...');
    try {
        nuxtProcess = await ensureNuxt('http://localhost:3000/');
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
            killProcess(tsup);
            if (nuxtProcess) {
                console.log('[DevElectron] Stopping Nuxt dev server...');
                killProcess(nuxtProcess);
            }
            process.exit(0);
        });
    }, 3000);
}

start();
