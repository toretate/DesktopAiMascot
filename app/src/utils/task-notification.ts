import { normalizeTextForTts, stripResidualAsterisks } from './tts-normalizer';

let checkInterval: any = null;
let playlistInstance: any = null;

// 音声を合成して再生するヘルパー
export const playNotificationVoice = async (text: string) => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    try {
        // configStore を動的インポートして現在の音声設定を取得
        const configStore = (await import('../store/config')).useConfigStore();

        const dict = configStore.activeMascot?.aiConfig?.ttsDictionary;
        const normalizedText = stripResidualAsterisks(normalizeTextForTts(text, dict));

        let base64Audio = '';

        const engine = configStore.selectedVoiceEngine || 'voicevox';
        if (engine === 'voicevox') {
            const speakerId = configStore.voicevoxSpeaker ?? 1;
            const endpoint = configStore.voicevoxEndpoint;
            const res = await window.electronAPI.synthesizeVoicevox(normalizedText, speakerId, endpoint || undefined);
            base64Audio = res || '';
        } else if (engine === 'irodori') {
            const endpoint = configStore.irodoriEndpoint || 'http://localhost:5000';
            const model = configStore.irodoriModel || 'default';
            const voice = configStore.irodoriVoice || 'default';
            const res = await window.electronAPI.synthesizeIrodori(normalizedText, endpoint, model, voice, 'neutral');
            base64Audio = res || '';
        }

        if (base64Audio) {
            if (!playlistInstance) {
                const { AudioPlaylist } = await import('./AudioPlaylist');
                const mascotStore = (await import('../store/mascot')).useMascotStore();
                playlistInstance = new AudioPlaylist((speaking) => {
                    mascotStore.setSpeaking(speaking);
                });
            }
            playlistInstance.push(base64Audio);
        }
    } catch (e) {
        console.error('[TaskNotification] 音声合成・再生に失敗しました:', e);
    }
};

// 定期監視関数
export const startNotificationCheck = () => {
    if (typeof window === 'undefined') return;
    if (checkInterval) clearInterval(checkInterval);

    checkInterval = setInterval(async () => {
        // useTaskStore を動的インポートして状態を取得
        const taskStore = (await import('../store/task')).useTaskStore();

        if (!taskStore.enableNotification) return;

        const now = new Date();
        const minutesBefore = taskStore.notificationMinutes;

        // 予定日時があり、まだ通知されておらず、現在時刻が「予定時刻の n 分前」を過ぎているタスクを検索
        const tasksToNotify = taskStore.tasks.filter((t: any) => {
            if (!t.scheduledAt || t.completed || t.notified) return false;
            
            try {
                const scheduledTime = new Date(t.scheduledAt);
                const notifyThresholdTime = new Date(scheduledTime.getTime() - minutesBefore * 60 * 1000);
                const tenMinutesAfter = new Date(scheduledTime.getTime() + 10 * 60 * 1000);
                
                return now >= notifyThresholdTime && now <= tenMinutesAfter;
            } catch (e) {
                return false;
            }
        });

        for (const task of tasksToNotify) {
            // 即座に通知済みフラグを立てて保存 (二重通知防止)
            task.notified = true;
            taskStore.saveToLocalStorage();

            const text = `予定の、${minutesBefore}分前になりました。${task.title}、の時間です。`;
            console.log(`[TaskNotification] Notifying task: ${task.title}`);
            
            if (window.electronAPI) {
                window.electronAPI.triggerTimerNotification(text);
            }

            await playNotificationVoice(text);
        }
    }, 10000); // 10秒に1回チェック
};

export const stopNotificationCheck = () => {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
};
