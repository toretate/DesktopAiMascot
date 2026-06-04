import { ref, nextTick, computed, watch, ComputedRef } from 'vue';
import { useConfigStore } from '../../store/config';
import { useMascotStore } from '../../store/mascot';
import { storeToRefs } from 'pinia';

export interface Message {
    id: number;
    sender: 'user' | 'mascot';
    text: string;
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
    summary?: string;
}

export interface MascotHistory {
    activeSessionId?: string;
    sessions: ChatSession[];
}

export function useChatHistory(scrollToBottom: () => void) {
    const configStore = useConfigStore();
    const mascotStore = useMascotStore();

    const { activeMascot } = storeToRefs(configStore);

    const allHistories = ref<Record<string, MascotHistory>>({});
    const sessions = ref<ChatSession[]>([]);
    const activeSessionId = ref<string | null>(null);
    const messages = ref<Message[]>([]);
    const showHistoryList = ref(false);
    const isHistoryLoaded = ref(false);

    const getDefaultMessage = () => {
        return { id: 1, sender: 'mascot' as const, text: 'こんにちは！今日はどんなお話をしますか？' };
    };

    const createNewSession = (): ChatSession => {
        return {
            id: Date.now().toString(),
            title: '新しい話題',
            timestamp: Date.now(),
            messages: [getDefaultMessage()]
        };
    };

    const applyActiveMascotHistory = () => {
        if (!isHistoryLoaded.value) return;

        const mascotId = activeMascot.value?.id || 'default';
        if (!allHistories.value[mascotId]) {
            const initialSession = createNewSession();
            allHistories.value[mascotId] = {
                activeSessionId: initialSession.id,
                sessions: [initialSession]
            };
        }
        
        const mascotHistory = allHistories.value[mascotId];
        sessions.value = mascotHistory.sessions || [];
        
        let currentSession = sessions.value.find(s => s.id === mascotHistory.activeSessionId);
        if (!currentSession && sessions.value.length > 0) {
            currentSession = sessions.value[0];
        }
        
        if (currentSession) {
            activeSessionId.value = currentSession.id;
            messages.value = [...currentSession.messages];
        } else {
            const initialSession = createNewSession();
            sessions.value = [initialSession];
            allHistories.value[mascotId].sessions = sessions.value;
            allHistories.value[mascotId].activeSessionId = initialSession.id;
            activeSessionId.value = initialSession.id;
            messages.value = [...initialSession.messages];
        }
        nextTick(() => scrollToBottom());
    };

    const loadHistory = async () => {
        if (window.electronAPI) {
            try {
                const history = await window.electronAPI.getChatHistory();
                allHistories.value = history || {};
            } catch (e) {
                console.error('Failed to load chat history:', e);
                allHistories.value = {};
            }
        }
        isHistoryLoaded.value = true;
        applyActiveMascotHistory();
    };

    const saveHistoryForMascot = async (mascotId: string) => {
        if (!isHistoryLoaded.value) return;

        if (activeSessionId.value) {
            const currentSession = sessions.value.find(s => s.id === activeSessionId.value);
            if (currentSession) {
                currentSession.messages = [...messages.value];
                const firstUserMsg = messages.value.find(m => m.sender === 'user');
                if (firstUserMsg && currentSession.title === '新しい話題') {
                    currentSession.title = firstUserMsg.text.substring(0, 15) + (firstUserMsg.text.length > 15 ? '...' : '');
                }
            }
        }
        
        allHistories.value[mascotId] = {
            activeSessionId: activeSessionId.value || undefined,
            sessions: sessions.value
        };
        
        if (window.electronAPI) {
            try {
                await window.electronAPI.saveChatHistory(allHistories.value);
            } catch (e) {
                console.error('Failed to save chat history:', e);
            }
        }
    };

    const saveHistory = async () => {
        const mascotId = activeMascot.value?.id || 'default';
        await saveHistoryForMascot(mascotId);
    };

    const clearHistory = async () => {
        const newSession = createNewSession();
        sessions.value.unshift(newSession);
        activeSessionId.value = newSession.id;
        messages.value = [...newSession.messages];
        showHistoryList.value = false;
        await saveHistory();
    };

    const selectSession = (sessionId: string) => {
        activeSessionId.value = sessionId;
        const currentSession = sessions.value.find(s => s.id === sessionId);
        if (currentSession) {
            messages.value = [...currentSession.messages];
        }
        showHistoryList.value = false;
        const mascotId = activeMascot.value?.id || 'default';
        if (allHistories.value[mascotId]) {
            allHistories.value[mascotId].activeSessionId = sessionId;
        }
        saveHistory();
        nextTick(() => scrollToBottom());
    };

    const deleteSession = async (sessionId: string, event: Event) => {
        event.stopPropagation();
        
        sessions.value = sessions.value.filter(s => s.id !== sessionId);
        
        if (sessions.value.length === 0) {
            const newSession = createNewSession();
            sessions.value = [newSession];
        }
        
        if (activeSessionId.value === sessionId) {
            activeSessionId.value = sessions.value[0].id;
            messages.value = [...sessions.value[0].messages];
        }
        
        const mascotId = activeMascot.value?.id || 'default';
        if (allHistories.value[mascotId]) {
            allHistories.value[mascotId].sessions = sessions.value;
            allHistories.value[mascotId].activeSessionId = activeSessionId.value || undefined;
        }
        
        await saveHistory();
    };

    const runCompaction = async (mascotId: string, sessionId: string) => {
        const session = sessions.value.find(s => s.id === sessionId);
        const COMPACTION_THRESHOLD = 15;
        const PRESERVE_COUNT = 6;

        if (!session || session.messages.length < COMPACTION_THRESHOLD) return;

        const messagesToSummarize = session.messages.slice(1, -PRESERVE_COUNT);
        if (messagesToSummarize.length < 2) return;

        console.log(`[Compaction] Running compaction for session ${sessionId}. Messages to summarize: ${messagesToSummarize.length}`);

        const chatText = messagesToSummarize.map(m => `${m.sender === 'user' ? 'ユーザー' : 'マスコット'}: ${m.text}`).join('\n');
        let summarizationPrompt = `以下の会話履歴を、今後の対話に必要な重要情報を残したまま、簡潔かつ日本語で1つの段落に要約してください。\n\n`;
        if (session.summary) {
            summarizationPrompt += `以前の要約:\n${session.summary}\n\n`;
        }
        summarizationPrompt += `要約対象の会話:\n${chatText}\n\n`;
        summarizationPrompt += `要約には、決定事項、重要な話題、マスターとの約束事などを含め、語尾などの不要な会話表現は取り除いてください。`;

        const mascot = activeMascot.value;
        const engine = configStore.selectedEngine || mascot?.aiConfig?.chat?.engine || 'gemini';
        let apiKey = '';
        if (engine === 'gemini') {
            apiKey = configStore.googleAiStudioApiKey || '';
        } else if (engine === 'openai') {
            apiKey = configStore.openaiApiKey || '';
        }
        const model = configStore.geminiModel || mascot?.aiConfig?.chat?.model || 'gemini-1.5-flash';
        const lmsEndpoint = configStore.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';

        let summary = '';
        try {
            if (window.electronAPI) {
                if (engine === 'lmstudio') {
                    summary = await window.electronAPI.askLmStudio(summarizationPrompt, "あなたは優秀な対話要約アシスタントです。", model, lmsEndpoint);
                } else {
                    if (!apiKey) return;
                    summary = await window.electronAPI.askGemini(summarizationPrompt, apiKey, "あなたは優秀な対話要約アシスタントです。", model);
                }
            }
        } catch (e) {
            console.error('[Compaction] Summarization failed:', e);
            return;
        }

        if (summary && !summary.startsWith('Error:')) {
            summary = summary.replace(/\[\w+\]/g, '').trim();

            session.summary = summary;
            const defaultMsg = session.messages[0];
            const preservedMessages = session.messages.slice(-PRESERVE_COUNT);
            session.messages = [defaultMsg, ...preservedMessages];
            
            if (activeSessionId.value === sessionId) {
                messages.value = [...session.messages];
            }
            console.log('[Compaction] Compaction succeeded. New summary:', summary);
        }
    };

    const toggleHistoryList = () => {
        showHistoryList.value = !showHistoryList.value;
    };

    // マスコット切り替え時の履歴適用
    watch(() => activeMascot.value?.id, (newId, oldId) => {
        if (!isHistoryLoaded.value) return;
        if (oldId && newId !== oldId) {
            saveHistoryForMascot(oldId);
        }
        applyActiveMascotHistory();
    });

    return {
        allHistories,
        sessions,
        activeSessionId,
        messages,
        showHistoryList,
        isHistoryLoaded,
        loadHistory,
        saveHistory,
        saveHistoryForMascot,
        clearHistory,
        selectSession,
        deleteSession,
        runCompaction,
        toggleHistoryList,
        applyActiveMascotHistory
    };
}
