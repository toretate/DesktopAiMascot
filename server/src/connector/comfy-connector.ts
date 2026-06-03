import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const comfyHost = '127.0.0.1:8188';

/**
 * ComfyUI サーバーに画像をアップロードする
 * @returns アップロード後のファイル名
 */
export async function uploadImage(imageBuffer: Buffer, filename: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([imageBuffer]);
    formData.append('image', blob, filename);
    formData.append('overwrite', 'true');

    console.log(`[ComfyUI] Uploading image to http://${comfyHost}/upload/image ...`);
    const uploadRes = await fetch(`http://${comfyHost}/upload/image`, {
        method: 'POST',
        body: formData
    });

    if (!uploadRes.ok) {
        throw new Error(`ComfyUI upload failed: ${uploadRes.statusText}`);
    }

    const uploadJson = await uploadRes.json() as { name: string };
    return uploadJson.name;
}

/**
 * ワークフローを実行し、SaveImageWebsocket から画像データを受信する
 */
export async function runWorkflow(workflowJson: any): Promise<Buffer> {
    const clientId = randomUUID();
    console.log(`[ComfyUI] Opening WebSocket to ws://${comfyHost}/ws?clientId=${clientId} ...`);
    const ws = new WebSocket(`ws://${comfyHost}/ws?clientId=${clientId}`);

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
        }, 10000);
        ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
        });
        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    console.log('[ComfyUI] WebSocket connected. Sending prompt...');
    const promptRes = await fetch(`http://${comfyHost}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: workflowJson,
            client_id: clientId
        })
    });

    if (!promptRes.ok) {
        ws.close();
        throw new Error(`ComfyUI prompt submission failed: ${promptRes.statusText}`);
    }

    const promptData = await promptRes.json() as { prompt_id: string };
    const promptId = promptData.prompt_id;
    console.log(`[ComfyUI] Workflow queued. Prompt ID: ${promptId}. Waiting for image bytes...`);

    return await new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('ComfyUI processing timed out.'));
        }, 60000); // 60秒タイムアウト

        ws.on('message', (msgData, isBinary) => {
            if (isBinary) {
                const buffer = msgData as Buffer;
                console.log(`[ComfyUI] Received binary message of size: ${buffer.length} bytes`);
                // 先頭8バイトをスキップ (event_type: uint32, format_type: uint32)
                const actualImage = buffer.subarray(8);
                ws.close();
                clearTimeout(timeout);
                resolve(actualImage);
            } else {
                try {
                    const msg = JSON.parse(msgData.toString());
                    if (msg.type === 'executing' && msg.data.node === null && msg.data.prompt_id === promptId) {
                        console.log('[ComfyUI] Execution completed. Waiting for final binary...');
                    }
                } catch (e) {
                    // JSONパースエラーは無視
                }
            }
        });

        ws.on('error', (err) => {
            ws.close();
            clearTimeout(timeout);
            reject(err);
        });
    });
}
