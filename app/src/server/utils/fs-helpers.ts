import * as fs from 'fs';
import * as path from 'path';

/**
 * 一時ファイルを経由して安全にファイルへ書き込みを行う（アトミック書き込み）
 */
export function safeWriteFileSync(filePath: string, data: string, encoding: BufferEncoding = 'utf8'): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, data, encoding);
    
    let attempts = 0;
    const maxAttempts = 10;
    const delayMs = 50;

    while (attempts < maxAttempts) {
        try {
            fs.renameSync(tmpPath, filePath);
            return;
        } catch (e: any) {
            attempts++;
            if (attempts >= maxAttempts) {
                // リネームが失敗し続けた場合、一時ファイルを諦めて直接書き込みにフォールバックする
                console.warn(`[fs-helpers] renameSync failed after ${maxAttempts} attempts: ${e.message}. Falling back to direct write.`);
                try {
                    fs.writeFileSync(filePath, data, encoding);
                    // 一時ファイルのクリーンアップ
                    fs.unlinkSync(tmpPath);
                    return;
                } catch (fallbackErr: any) {
                    // フォールバックも失敗した場合は一時ファイルをクリーンアップして元々のエラーを投げる
                    try { fs.unlinkSync(tmpPath); } catch {}
                    throw fallbackErr;
                }
            }
            // 同期スリープ
            try {
                const sab = new SharedArrayBuffer(4);
                const int32 = new Int32Array(sab);
                Atomics.wait(int32, 0, 0, delayMs);
            } catch {
                // Atomicsが機能しない場合の単純なビジーループ
                const start = Date.now();
                while (Date.now() - start < delayMs) {}
            }
        }
    }
}
