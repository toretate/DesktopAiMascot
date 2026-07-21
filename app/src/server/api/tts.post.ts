import { defineEventHandler, readBody } from 'h3';
import { VoiceAiService } from '../utils/voice-ai-service';
import { normalizeTextForTts, stripResidualAsterisks } from '../utils/tts-normalizer';
import { filterDialogue } from '../utils/dialogue-filter';
import { splitSentences } from '../utils/sentence-splitter';
import { sanitizeForIrodoriTTS } from '../utils/irodori-sanitizer';
import type { Base64AudioPayload } from '../../types/audio';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const {
        action,
        engine,
        text,
        endpoint,
        model,
        voice,
        speakerId,
        emotion,
        ttsDictionary,
        ttsReadNarrative,
        showVoiceLog
    } = body;

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

        const normalizedText = stripResidualAsterisks(normalizeTextForTts(text || '', ttsDictionary));

        // チャットメッセージの再送時は通常の読み上げと同じ文分割・地の文設定を適用する
        if (action === 'synthesizeBatch') {
            const dialogueFiltered = ttsReadNarrative === false ? filterDialogue(normalizedText) : normalizedText;
            const sentences = splitSentences(dialogueFiltered)
                .map(sentence => engine === 'irodori' ? sanitizeForIrodoriTTS(sentence).trim() : sentence.trim())
                .filter(Boolean);

            const audios = await Promise.all(sentences.map(sentence => {
                if (engine === 'irodori') {
                    return VoiceAiService.synthesizeIrodori(
                        sentence,
                        endpoint,
                        model,
                        voice,
                        emotion,
                        showVoiceLog !== false
                    );
                }
                return VoiceAiService.synthesize(
                    sentence,
                    speakerId !== undefined ? Number(speakerId) : 1,
                    endpoint,
                    showVoiceLog !== false
                );
            }));

            const validAudios = audios.filter((audio): audio is Base64AudioPayload => Boolean(audio?.data));
            return {
                success: validAudios.length > 0,
                audios: validAudios
            };
        }

        // デフォルト: 音声合成 (action === 'synthesize' もしくは未指定)
        let audio: Base64AudioPayload | null = null;

        if (engine === 'irodori') {
            audio = await VoiceAiService.synthesizeIrodori(
                sanitizeForIrodoriTTS(normalizedText),
                endpoint,
                model,
                voice,
                emotion,
                true
            );
        } else {
            // デフォルトは VOICEVOX
            const targetSpeakerId = speakerId !== undefined ? Number(speakerId) : 1;
            audio = await VoiceAiService.synthesize(
                normalizedText,
                targetSpeakerId,
                endpoint,
                true
            );
        }

        return {
            success: audio !== null,
            audio
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
