export type AudioCodec = 'pcm_s16le' | 'mp3';

export interface Base64AudioPayload {
    data: string;
    mimeType: 'audio/wav' | 'audio/mpeg';
    extension: 'wav' | 'mp3';
    codec: AudioCodec;
}

export type PlayableAudio = Base64AudioPayload | string;

export function isBase64AudioPayload(value: unknown): value is Base64AudioPayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Partial<Base64AudioPayload>;
    return typeof payload.data === 'string'
        && (payload.mimeType === 'audio/wav' || payload.mimeType === 'audio/mpeg')
        && (payload.extension === 'wav' || payload.extension === 'mp3')
        && (payload.codec === 'pcm_s16le' || payload.codec === 'mp3');
}

export function normalizeAudioPayload(audio: PlayableAudio): Base64AudioPayload {
    if (isBase64AudioPayload(audio)) return audio;
    return {
        data: audio,
        mimeType: 'audio/wav',
        extension: 'wav',
        codec: 'pcm_s16le'
    };
}
