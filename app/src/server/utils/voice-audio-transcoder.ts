import { spawn } from 'node:child_process';
import type { Base64AudioPayload } from '../../types/audio';

const DEFAULT_MP3_BITRATE = '64k';
const DEFAULT_TIMEOUT_MS = 30000;

export type FfmpegRunner = (command: string, args: string[], input: Buffer, timeoutMs: number) => Promise<Buffer>;

function getMp3Bitrate(): string {
    const configured = process.env.VOICEVOX_MP3_BITRATE?.trim();
    if (!configured || !/^\d{2,3}k$/.test(configured)) return DEFAULT_MP3_BITRATE;
    const bitrate = Number.parseInt(configured, 10);
    return bitrate >= 16 && bitrate <= 320 ? configured : DEFAULT_MP3_BITRATE;
}

function getTimeoutMs(): number {
    const rawValue = process.env.VOICEVOX_FFMPEG_TIMEOUT_MS?.trim() || '';
    const configured = /^\d+$/.test(rawValue) ? Number.parseInt(rawValue, 10) : Number.NaN;
    return Number.isFinite(configured) && configured >= 1000 ? configured : DEFAULT_TIMEOUT_MS;
}

export function runFfmpeg(command: string, args: string[], input: Buffer, timeoutMs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let settled = false;

        const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            callback();
        };
        const timeoutId = setTimeout(() => {
            child.kill();
            finish(() => reject(new Error(`FFmpeg timed out after ${timeoutMs}ms`)));
        }, timeoutMs);

        child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on('data', chunk => {
            if (Buffer.concat(stderr).length < 8192) stderr.push(Buffer.from(chunk));
        });
        child.on('error', error => finish(() => reject(error)));
        child.on('close', code => finish(() => {
            const output = Buffer.concat(stdout);
            if (code === 0 && output.length > 0) {
                resolve(output);
                return;
            }
            const detail = Buffer.concat(stderr).toString('utf8').trim();
            reject(new Error(`FFmpeg exited with code ${code}${detail ? `: ${detail}` : ''}`));
        }));

        child.stdin.on('error', () => undefined);
        child.stdin.end(input);
    });
}

function createWavPayload(wav: Buffer): Base64AudioPayload {
    return {
        data: wav.toString('base64'),
        mimeType: 'audio/wav',
        extension: 'wav',
        codec: 'pcm_s16le'
    };
}

export function createMp3Payload(mp3: Buffer): Base64AudioPayload {
    return {
        data: mp3.toString('base64'),
        mimeType: 'audio/mpeg',
        extension: 'mp3',
        codec: 'mp3'
    };
}

export async function encodeVoicevoxAudio(wav: Buffer, runner: FfmpegRunner = runFfmpeg): Promise<Base64AudioPayload> {
    if (process.env.VOICEVOX_AUDIO_FORMAT?.trim().toLowerCase() === 'wav') {
        return createWavPayload(wav);
    }

    const command = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
    const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'wav',
        '-i', 'pipe:0',
        '-vn',
        '-ac', '1',
        '-codec:a', 'libmp3lame',
        '-b:a', getMp3Bitrate(),
        '-f', 'mp3',
        'pipe:1'
    ];

    try {
        const mp3 = await runner(command, args, wav, getTimeoutMs());
        return createMp3Payload(mp3);
    } catch (error: any) {
        console.warn(`[VoiceAudio] MP3変換に失敗したためWAVへフォールバックします: ${error.message || error}`);
        return createWavPayload(wav);
    }
}
