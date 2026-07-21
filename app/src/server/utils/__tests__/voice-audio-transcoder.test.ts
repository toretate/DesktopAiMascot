import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeVoicevoxAudio } from '../voice-audio-transcoder';

describe('encodeVoicevoxAudio', () => {
    afterEach(() => {
        delete process.env.VOICEVOX_AUDIO_FORMAT;
        delete process.env.VOICEVOX_MP3_BITRATE;
        delete process.env.VOICEVOX_FFMPEG_TIMEOUT_MS;
        delete process.env.FFMPEG_PATH;
        vi.restoreAllMocks();
    });

    it('VOICEVOXのWAVをMP3へ変換し形式情報を返すこと', async () => {
        process.env.FFMPEG_PATH = 'custom-ffmpeg';
        process.env.VOICEVOX_MP3_BITRATE = '96k';
        const runner = vi.fn().mockResolvedValue(Buffer.from('mp3-data'));

        const result = await encodeVoicevoxAudio(Buffer.from('wav-data'), runner);

        expect(result).toEqual({
            data: Buffer.from('mp3-data').toString('base64'),
            mimeType: 'audio/mpeg',
            extension: 'mp3',
            codec: 'mp3'
        });
        expect(runner).toHaveBeenCalledWith(
            'custom-ffmpeg',
            expect.arrayContaining(['-codec:a', 'libmp3lame', '-b:a', '96k', '-ac', '1']),
            Buffer.from('wav-data'),
            30000
        );
    });

    it('FFmpegが失敗した場合は元のWAVへフォールバックすること', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const runner = vi.fn().mockRejectedValue(new Error('not found'));

        const result = await encodeVoicevoxAudio(Buffer.from('wav-data'), runner);

        expect(result).toEqual({
            data: Buffer.from('wav-data').toString('base64'),
            mimeType: 'audio/wav',
            extension: 'wav',
            codec: 'pcm_s16le'
        });
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WAVへフォールバック'));
    });

    it('VOICEVOX_AUDIO_FORMAT=wavの場合はFFmpegを呼ばないこと', async () => {
        process.env.VOICEVOX_AUDIO_FORMAT = 'wav';
        const runner = vi.fn();

        const result = await encodeVoicevoxAudio(Buffer.from('wav-data'), runner);

        expect(result.extension).toBe('wav');
        expect(runner).not.toHaveBeenCalled();
    });
});
