import { ref, nextTick, computed, watch, ComputedRef } from 'vue';
import { useConfigStore } from '../../store/config';
import { useMascotStore } from '../../store/mascot';
import { storeToRefs } from 'pinia';

export interface MessageAttachment {
    type: 'image' | 'file';
    name: string;
    url: string;
    size?: number;
}

export interface Message {
    id: number;
    sender: 'user' | 'mascot';
    text: string;
    attachments?: MessageAttachment[];
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
    summary?: string;
    isSecret?: boolean;
}

export interface MascotHistory {
    activeSessionId?: string;
    sessions: ChatSession[];
    activeSecretSessionId?: string;
    secretSessions?: ChatSession[];
}

export function useChatHistory(scrollToBottom: () => void) {
    const configStore = useConfigStore();
    const mascotStore = useMascotStore();

    const { activeMascot } = storeToRefs(configStore);
    const { isSecretMode } = storeToRefs(mascotStore);

    const allHistories = ref<Record<string, MascotHistory>>({});
    const sessions = ref<ChatSession[]>([]);
    const activeSessionId = ref<string | null>(null);
    const messages = ref<Message[]>([]);
    const showHistoryList = ref(false);
    const isHistoryLoaded = ref(false);

    const getDefaultMessage = () => {
        return { id: 1, sender: 'mascot' as const, text: 'こんにちは！今日はどんなお話をしますか？' };
    };

    const createNewSession = (isSecret = false): ChatSession => {
        return {
            id: Date.now().toString(),
            title: isSecret ? 'シークレットの話題' : '新しい話題',
            timestamp: Date.now(),
            messages: [getDefaultMessage()],
            isSecret
        };
    };

    const applyActiveMascotHistory = () => {
        if (!isHistoryLoaded.value) return;

        const mascotId = activeMascot.value?.id || 'default';
        if (!allHistories.value[mascotId]) {
            const initialSession = createNewSession(isSecretMode.value);
            allHistories.value[mascotId] = isSecretMode.value ? {
                activeSecretSessionId: initialSession.id,
                secretSessions: [initialSession],
                sessions: []
            } : {
                activeSessionId: initialSession.id,
                sessions: [initialSession]
            };
        }
        
        const mascotHistory = allHistories.value[mascotId];
        
        if (isSecretMode.value) {
            if (!mascotHistory.secretSessions || mascotHistory.secretSessions.length === 0) {
                const initialSession = createNewSession(true);
                mascotHistory.secretSessions = [initialSession];
                mascotHistory.activeSecretSessionId = initialSession.id;
            }
            sessions.value = mascotHistory.secretSessions;
            
            let currentSession = sessions.value.find(s => s.id === mascotHistory.activeSecretSessionId);
            if (!currentSession && sessions.value.length > 0) {
                currentSession = sessions.value[0];
            }
            
            if (currentSession) {
                activeSessionId.value = currentSession.id;
                messages.value = [...currentSession.messages];
            } else {
                const initialSession = createNewSession(true);
                sessions.value = [initialSession];
                mascotHistory.secretSessions = sessions.value;
                mascotHistory.activeSecretSessionId = initialSession.id;
                activeSessionId.value = initialSession.id;
                messages.value = [...initialSession.messages];
            }
        } else {
            sessions.value = mascotHistory.sessions || [];
            
            let currentSession = sessions.value.find(s => s.id === mascotHistory.activeSessionId);
            if (!currentSession && sessions.value.length > 0) {
                currentSession = sessions.value[0];
            }
            
            if (currentSession) {
                activeSessionId.value = currentSession.id;
                messages.value = [...currentSession.messages];
            } else {
                const initialSession = createNewSession(false);
                sessions.value = [initialSession];
                mascotHistory.sessions = sessions.value;
                mascotHistory.activeSessionId = initialSession.id;
                activeSessionId.value = initialSession.id;
                messages.value = [...initialSession.messages];
            }
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
                currentSession.timestamp = Date.now();
                const firstUserMsg = messages.value.find(m => m.sender === 'user');
                const defaultTitle = isSecretMode.value ? 'シークレットの話題' : '新しい話題';
                if (firstUserMsg && currentSession.title === defaultTitle) {
                    currentSession.title = firstUserMsg.text.substring(0, 15) + (firstUserMsg.text.length > 15 ? '...' : '');
                }
            }
        }
        
        // タイムスタンプ降順でソート
        sessions.value.sort((a, b) => b.timestamp - a.timestamp);
        
        if (!allHistories.value[mascotId]) {
            allHistories.value[mascotId] = { sessions: [] };
        }
        
        if (isSecretMode.value) {
            allHistories.value[mascotId].activeSecretSessionId = activeSessionId.value || undefined;
            allHistories.value[mascotId].secretSessions = sessions.value;
        } else {
            allHistories.value[mascotId].activeSessionId = activeSessionId.value || undefined;
            allHistories.value[mascotId].sessions = sessions.value;
        }
        
        if (window.electronAPI) {
            try {
                const rawHistory = JSON.parse(JSON.stringify(allHistories.value));
                await window.electronAPI.saveChatHistory(rawHistory);
            } catch (e) {
                console.error('Failed to save chat history:', e);
            }
        }
    };

    const saveHistory = async () => {
        if (!isHistoryLoaded.value) return;
        const mascotId = activeMascot.value?.id || 'default';
        await saveHistoryForMascot(mascotId);
    };

    const clearHistory = async () => {
        if (!isHistoryLoaded.value) return;
        const newSession = createNewSession(isSecretMode.value);
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
            if (isSecretMode.value) {
                allHistories.value[mascotId].activeSecretSessionId = sessionId;
            } else {
                allHistories.value[mascotId].activeSessionId = sessionId;
            }
        }
        saveHistory();
        nextTick(() => scrollToBottom());
    };

    const deleteSession = async (sessionId: string, event: Event) => {
        event.stopPropagation();
        
        sessions.value = sessions.value.filter(s => s.id !== sessionId);
        
        if (sessions.value.length === 0) {
            const newSession = createNewSession(isSecretMode.value);
            sessions.value = [newSession];
        }
        
        if (activeSessionId.value === sessionId) {
            activeSessionId.value = sessions.value[0].id;
            messages.value = [...sessions.value[0].messages];
        }
        
        const mascotId = activeMascot.value?.id || 'default';
        if (allHistories.value[mascotId]) {
            if (isSecretMode.value) {
                allHistories.value[mascotId].secretSessions = sessions.value;
                allHistories.value[mascotId].activeSecretSessionId = activeSessionId.value || undefined;
            } else {
                allHistories.value[mascotId].sessions = sessions.value;
                allHistories.value[mascotId].activeSessionId = activeSessionId.value || undefined;
            }
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

        // トークン上限や特殊制御文字によるエラーを防ぐため、要約対象の会話履歴全体の総文字数を制限します（UIから設定可能、デフォルト 2500文字）。
        // 最新の対話から順に遡って文字数の上限まで収集します。
        const maxCharLimit = configStore.summaryMaxCharLimit !== undefined ? Number(configStore.summaryMaxCharLimit) : 2500;
        let chatTextParts: string[] = [];
        let currentLength = 0;

        for (let i = messagesToSummarize.length - 1; i >= 0; i--) {
            const m = messagesToSummarize[i];
            const textContent = m.text || '';
            const limitedText = textContent.length > 300 ? textContent.substring(0, 300) + '... (長文のため中略)' : textContent;
            const line = `${m.sender === 'user' ? 'ユーザー' : 'マスコット'}: ${limitedText}`;

            if (currentLength + line.length + 1 > maxCharLimit) {
                chatTextParts.unshift('... (これより前の古い会話履歴は省略) ...');
                break;
            }

            chatTextParts.unshift(line);
            currentLength += line.length + 1;
        }
        const chatText = chatTextParts.join('\n');
        let summarizationPrompt = `以下の会話履歴を、今後の対話に必要な重要情報を残したまま、簡潔かつ日本語で1つの段落に要約してください。\n\n`;
        if (session.summary) {
            summarizationPrompt += `以前の要約:\n${session.summary}\n\n`;
        }
        summarizationPrompt += `要約対象の会話:\n${chatText}\n\n`;
        summarizationPrompt += `要約には、決定事項、重要な話題、マスターとの約束事などを含め、語尾などの不要な会話表現は取り除いてください。`;

        const mascot = activeMascot.value;
        let engine = configStore.summaryEngine || 'chat-sync';
        if (engine === 'chat-sync') {
            engine = configStore.selectedEngine || mascot?.aiConfig?.chat?.engine || 'gemini';
        }

        let model = '';
        if (configStore.summaryEngine === 'chat-sync') {
            if (engine === 'lmstudio') {
                model = configStore.lmstudioModel || mascot?.aiConfig?.chat?.model || '';
            } else if (engine === 'gemini') {
                model = configStore.geminiModel || mascot?.aiConfig?.chat?.model || 'gemini-1.5-flash';
            } else if (engine === 'openai') {
                model = configStore.openaiModel || mascot?.aiConfig?.chat?.model || 'gpt-4o';
            } else if (engine === 'anthropic') {
                model = configStore.anthropicModel || mascot?.aiConfig?.chat?.model || 'claude-3-5-sonnet-latest';
            }
        } else {
            if (engine === 'lmstudio') {
                model = configStore.summaryLmstudioModel || configStore.lmstudioModel || mascot?.aiConfig?.chat?.model || '';
            } else if (engine === 'gemini') {
                model = configStore.summaryGeminiModel || configStore.geminiModel || mascot?.aiConfig?.chat?.model || 'gemini-1.5-flash';
            } else if (engine === 'openai') {
                model = configStore.summaryOpenaiModel || configStore.openaiModel || mascot?.aiConfig?.chat?.model || 'gpt-4o-mini';
            } else if (engine === 'anthropic') {
                model = configStore.summaryAnthropicModel || configStore.anthropicModel || mascot?.aiConfig?.chat?.model || 'claude-3-5-haiku-latest';
            }
        }

        let apiKey = '';
        if (engine === 'gemini') {
            apiKey = configStore.googleAiStudioApiKey || '';
        } else if (engine === 'openai') {
            apiKey = configStore.openaiApiKey || '';
        } else if (engine === 'anthropic') {
            apiKey = configStore.anthropicApiKey || '';
        }

        const lmsEndpoint = configStore.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';

        let summary = '';
        try {
            console.log(`[Compaction] Calling /api/summarize. Engine: ${engine}, Model: ${model}`);
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: summarizationPrompt,
                    engine,
                    model,
                    apiKey,
                    lmstudioEndpoint: lmsEndpoint
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const resJson = await response.json();
            if (resJson && resJson.success && resJson.summary) {
                summary = resJson.summary;
            } else {
                throw new Error(resJson.error || 'Failed to summarize conversation');
            }
        } catch (e) {
            console.error('[Compaction] Summarization failed:', e);
            return;
        }

        // --- 長期記憶の自動更新 (Memory Compaction) ---
        if (window.electronAPI && mascot) {
            try {
                // シークレットセッションの場合は長期記憶の自動更新をスキップする
                const isSecretSession = session.isSecret || isSecretMode.value;
                if (!isSecretSession) {
                    const mascotPrompts = await window.electronAPI.getMascotPrompts(mascot.id);
                    const currentMemory = mascotPrompts.memory || '';
                    
                    console.log(`[Compaction] Calling /api/update-memory. Engine: ${engine}, Model: ${model}`);
                    const memResponse = await fetch('/api/update-memory', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            currentMemory,
                            chatHistory: chatText,
                            engine,
                            model,
                            apiKey,
                            lmstudioEndpoint: lmsEndpoint
                        })
                    });

                    if (memResponse.ok) {
                        const memJson = await memResponse.json();
                        if (memJson && memJson.success && memJson.memory) {
                            let newMemory = memJson.memory;
                            newMemory = newMemory.replace(/\[\w+\]/g, '').trim();
                            
                            mascotPrompts.memory = newMemory;
                            await window.electronAPI.saveMascotPrompts(mascot.id, mascotPrompts);
                            console.log('[Compaction] Memory update succeeded. New memory length:', newMemory.length);
                        } else {
                            console.error('[Compaction] Memory update failed:', memJson.error || 'No memory returned');
                        }
                    } else {
                        console.error('[Compaction] Memory update HTTP error! status:', memResponse.status);
                    }
                } else {
                    console.log('[Compaction] Secret session. Skipping long-term memory update.');
                }
            } catch (memError) {
                console.error('[Compaction] Memory update failed with error:', memError);
            }
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
        if (oldId && newId && newId !== oldId) {
            saveHistoryForMascot(oldId);
        }
        applyActiveMascotHistory();
    });

    // シークレットモード切り替え時の履歴適用
    watch(isSecretMode, async (newVal, oldVal) => {
        if (!isHistoryLoaded.value) return;
        const mascotId = activeMascot.value?.id || 'default';
        if (!allHistories.value[mascotId]) {
            allHistories.value[mascotId] = { sessions: [] };
        }
        
        // 切り替え前のデータを退避
        const wasSecret = oldVal;
        if (wasSecret) {
            allHistories.value[mascotId].activeSecretSessionId = activeSessionId.value || undefined;
            allHistories.value[mascotId].secretSessions = sessions.value;
        } else {
            allHistories.value[mascotId].activeSessionId = activeSessionId.value || undefined;
            allHistories.value[mascotId].sessions = sessions.value;
        }
        
        // 切り替え後のデータを適用
        applyActiveMascotHistory();
    });

    const deleteMessage = async (messageId: number) => {
        messages.value = messages.value.filter(m => m.id !== messageId);
        await saveHistory();
    };

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
        deleteMessage,
        runCompaction,
        toggleHistoryList,
        applyActiveMascotHistory
    };
}
