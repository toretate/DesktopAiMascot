import { defineEventHandler, readBody } from 'h3';
import { VoiceAiService } from '../utils/voice-ai-service';
import { normalizeTextForTts, stripResidualAsterisks } from '../utils/tts-normalizer';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { action, engine, text, endpoint, model, voice, speakerId, emotion, ttsDictionary } = body;

    try {
        if (action === 'getIrodoriVoices') {
            const defaultEndpoint = 'http://127.0.0.1:8088';
            const apiBase = endpoint || defaultEndpoint;
            const url = apiBase.endsWith('/') ? `${apiBase}v1/audio/voices` : `${apiBase}/v1/audio/voices`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return {
                success: true,
                voices: data.data || []
            };
        }

        if (action === 'getVoicevoxSpeakers') {
            const defaultEndpoint = 'http://localhost:50021';
            const apiBase = endpoint || defaultEndpoint;
            const url = `${apiBase}/speakers`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const speakers = data.map((sp: any) => {
                const style = sp.styles?.[0]?.id !== undefined ? sp.styles[0].id : 0;
                return { name: `${sp.name} (${sp.styles?.[0]?.name || ''})`, value: style };
            });
            return {
                success: true,
                speakers
            };
        }

        // デフォルト: 音声合成 (action === 'synthesize' もしくは未指定)
        let base64Audio: string | null = null;
        const normalizedText = stripResidualAsterisks(normalizeTextForTts(text || '', ttsDictionary));

        if (engine === 'irodori') {
            base64Audio = await VoiceAiService.synthesizeIrodori(
                normalizedText,
                endpoint,
                model,
                voice,
                emotion,
                true
            );
        } else {
            // デフォルトは VOICEVOX
            const targetSpeakerId = speakerId !== undefined ? Number(speakerId) : 1;
            base64Audio = await VoiceAiService.synthesize(
                normalizedText,
                targetSpeakerId,
                endpoint,
                true
            );
        }

        return {
            success: base64Audio !== null,
            audio: base64Audio
        };
    } catch (error: any) {
        console.error('[API TTS] エラー:', error);
        return {
            success: false,
            audio: null,
            voices: [],
            speakers: [],
            error: error.message
        };
    }
});
