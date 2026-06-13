import { ref, nextTick, Ref, watch } from 'vue';
import { useConfigStore } from '../../store/config';
import { useMascotStore } from '../../store/mascot';
import { storeToRefs } from 'pinia';
import { AudioPlaylist } from '../../utils/AudioPlaylist';
import { Message, ChatSession, MessageAttachment } from './useChatHistory';

export function useChatConnection(params: {
    messages: Ref<Message[]>;
    activeSessionId: Ref<string | null>;
    sessions: Ref<ChatSession[]>;
    inputText: Ref<string>;
    saveHistory: () => Promise<void>;
    runCompaction: (mascotId: string, sessionId: string) => Promise<void>;
    scrollToBottom: () => void;
}) {
    const {
        messages,
        activeSessionId,
        sessions,
        inputText,
        saveHistory,
        runCompaction,
        scrollToBottom
    } = params;

    const configStore = useConfigStore();
    const mascotStore = useMascotStore();

    const playlist = new AudioPlaylist((speaking) => {
        mascotStore.setSpeaking(speaking);
    });

    const {
        chatSendKey,
        activeMascot,
        useServer,
        serverHost,
        serverPort,
        useTts
    } = storeToRefs(configStore);

    const { isLoading: isAiResponding } = storeToRefs(mascotStore);

    let socket: WebSocket | null = null;
    const isWsConnected = ref(false);

    // mascot側メッセージの最後の一つを更新するヘルパー
    const updateLastMascotMessage = (text: string) => {
        for (let i = messages.value.length - 1; i >= 0; i--) {
            if (messages.value[i].sender === 'mascot') {
                messages.value[i].text = text;
                break;
            }
        }
    };

    const connectWebSocket = () => {
        if (!useServer.value) {
            disconnectWebSocket();
            return;
        }

        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const wsUrl = `ws://${serverHost.value}:${serverPort.value}`;
        console.log(`[useChatConnection] Connecting to WebSocket: ${wsUrl}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('[useChatConnection] WebSocket connected');
            isWsConnected.value = true;
        };

        socket.onmessage = async (event) => {
            try {
                const parsed = JSON.parse(event.data);
                const { event: wsEvent, data } = parsed;

                if (wsEvent === 'chat-status') {
                    if (data.status === 'thinking') {
                        mascotStore.setLoading(true);
                    }
                } else if (wsEvent === 'chat-response') {
                    const { text, emotion } = data;
                    
                    updateLastMascotMessage(text);
                    const mascotId = activeMascot.value?.id || 'default';
                    await runCompaction(mascotId, activeSessionId.value!);
                    await saveHistory();
                    
                    mascotStore.setEmotion(emotion);
                    if (window.electronAPI) {
                        window.electronAPI.changeEmotion(emotion);
                    }

                    mascotStore.setLoading(false);
                    await nextTick();
                    scrollToBottom();
                } else if (wsEvent === 'chat-audio') {
                    const { audio: base64Audio } = data;
                    if (base64Audio && useTts.value) {
                        playlist.push(base64Audio);
                    }
                } else if (wsEvent === 'timer-trigger') {
                    const { memo } = data;
                    console.log('[useChatConnection] Timer triggered from server:', memo);
                    if (window.electronAPI) {
                        window.electronAPI.triggerTimerNotification(memo);
                    }
                } else if (wsEvent === 'chat-error') {
                    updateLastMascotMessage(`接続エラー: ${data.message}`);
                    await saveHistory();
                    mascotStore.setLoading(false);
                    mascotStore.setSpeaking(false);
                }
            } catch (e: any) {
                console.error('[useChatConnection] WebSocket message parsing error:', e.message);
            }
        };

        socket.onclose = () => {
            console.log('[useChatConnection] WebSocket disconnected');
            isWsConnected.value = false;
            socket = null;
            if (useServer.value) {
                setTimeout(connectWebSocket, 5000);
            }
        };

        socket.onerror = (err) => {
            console.error('[useChatConnection] WebSocket connection error:', err);
        };
    };

    const disconnectWebSocket = () => {
        if (socket) {
            socket.close();
            socket = null;
        }
        isWsConnected.value = false;
    };

    const pendingAttachments = ref<MessageAttachment[]>([]);

    const attachFiles = (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;
        
        for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            const reader = new FileReader();
            reader.onload = (e) => {
                const url = e.target?.result as string;
                const type = file.type.startsWith('image/') ? 'image' as const : 'file' as const;
                pendingAttachments.value.push({
                    type,
                    name: file.name,
                    url,
                    size: file.size
                });
            };
            reader.readAsDataURL(file);
        }
        input.value = '';
    };

    const removeAttachment = (index: number) => {
        pendingAttachments.value.splice(index, 1);
    };

    const sendMessage = async (isActiveTalk: boolean = false) => {
        if (!isActiveTalk && !inputText.value.trim() && pendingAttachments.value.length === 0) return;
        if (isAiResponding.value) return;

        playlist.stop();

        const userQuery = isActiveTalk ? '（ラジオ番組のフリートークとして、新しい話題を切り出してください。リスナーに問いかけたり、最近の出来事や季節の話題など何でも良いです）' : inputText.value;
        if (!isActiveTalk) {
            inputText.value = '';
        }

        // ラジオモード of ON/OFF指示検出
        if (!isActiveTalk) {
            const query = userQuery.trim().toLowerCase();
            if (query.includes('ラジオモード') || query.includes('radio mode')) {
                if (query.includes('オフ') || query.includes('終了') || query.includes('やめて') || query.includes('off') || query.includes('停止') || query.includes('無効') || query.includes('キャンセル')) {
                    mascotStore.setRadioMode(false);
                } else if (query.includes('オン') || query.includes('開始') || query.includes('はじめて') || query.includes('起動') || query.includes('on') || query.includes('入') || query.includes('有効') || query.includes('つけて')) {
                    mascotStore.setRadioMode(true);
                }
            }
        }

        const attachments = isActiveTalk ? [] : [...pendingAttachments.value];
        if (!isActiveTalk) {
            pendingAttachments.value = [];
        }

        if (!isActiveTalk) {
            messages.value.push({
                id: Date.now(),
                sender: 'user',
                text: userQuery,
                attachments: attachments.length > 0 ? attachments : undefined
            });
        }

        const historyBase = isActiveTalk ? messages.value : messages.value.slice(0, -1);
        const historyToSend = historyBase
            .filter(m => m.sender === 'user' || (m.sender === 'mascot' && m.text !== '考え中...' && !m.text.startsWith('接続に失敗しました') && !m.text.startsWith('サーバーに接続されていません') && !m.text.startsWith('接続エラー')))
            .slice(-10)
            .map(m => ({ sender: m.sender, text: m.text }));

        mascotStore.setLoading(true);

        await nextTick();
        scrollToBottom();

        const mascot = activeMascot.value;
        const engine = configStore.selectedEngine || mascot?.aiConfig?.chat?.engine || 'gemini';
        
        let apiKey = '';
        if (engine === 'gemini') {
            apiKey = configStore.googleAiStudioApiKey || '';
        } else if (engine === 'openai') {
            apiKey = configStore.openaiApiKey || '';
        } else if (engine === 'anthropic') {
            apiKey = configStore.anthropicApiKey || '';
        }

        const lmsEndpoint = configStore.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';
        const voicevoxEndpointUrl = configStore.voicevoxEndpoint || 'http://localhost:50021';

        let model = '';
        if (engine === 'lmstudio') {
            model = configStore.lmstudioModel || mascot?.aiConfig?.chat?.model || '';
        } else if (engine === 'gemini') {
            model = configStore.geminiModel || mascot?.aiConfig?.chat?.model || 'gemini-1.5-flash';
        } else if (engine === 'openai') {
            model = configStore.openaiModel || mascot?.aiConfig?.chat?.model || 'gpt-4o';
        } else if (engine === 'anthropic') {
            model = configStore.anthropicModel || mascot?.aiConfig?.chat?.model || 'claude-3-5-sonnet-latest';
        }

        const voicevoxSpeakerId = mascot?.aiConfig?.voice?.speaker_id !== undefined 
            ? mascot.aiConfig.voice.speaker_id 
            : (configStore.voicevoxSpeaker !== undefined ? configStore.voicevoxSpeaker : 2);

        const voiceEngine = configStore.selectedVoiceEngine || mascot?.aiConfig?.voice?.engine || 'voicevox';
        const irodoriEndpointUrl = configStore.irodoriEndpoint || 'http://localhost:7861';
        const irodoriModel = configStore.irodoriModel || 'irodori-tts-500m-v3';
        const irodoriVoice = configStore.irodoriVoice || 'default';

        let systemPrompt = '';
        if (mascot && mascot.profile) {
            systemPrompt += `# Mascot Character Profile\n${mascot.profile}\n\n`;
        }

        if (mascotStore.isRadioMode) {
            if (isActiveTalk) {
                systemPrompt += `# Active Radio Talk Instructions\n現在、リスナー（ユーザー）からの発話がない状態（沈黙）です。ラジオパーソナリティとして沈黙を破り、リスナーを退屈させないように能動的にフリートークを開始するか、新しい面白い話題（季節、天気、雑談、リスナーへの問いかけなど）を自発的に切り出して、リスナーに楽しく語りかけてください。余計なメタテキストは出力せず、セリフのみを出力してください。\n\n`;
            } else {
                systemPrompt += `# Radio Mode Instructions\nあなたは現在、1人喋りの「ラジオパーソナリティ（MC）」としてラジオ番組を配信しています。目の前のリスナー（マスター）に向けてラジオ風の楽しいトークを展開してください。挨拶（「リスナーのみなさんこんにちは！」「お便りありがとうございます」など）や、ラジオ番組らしい進行の言い回しを効果的に使ってください。\n\n`;
            }
        }

        if (window.electronAPI && window.electronAPI.getMascotPrompts && mascot) {
            try {
                const mascotPrompts = await window.electronAPI.getMascotPrompts(mascot.id);
                if (mascotPrompts.identity) {
                    systemPrompt += `# Mascot Identity\n${mascotPrompts.identity}\n\n`;
                }
                if (mascotPrompts.soul) {
                    systemPrompt += `# Mascot Soul / Tone / Personality\n${mascotPrompts.soul}\n\n`;
                }
                if (mascotPrompts.user) {
                    systemPrompt += `# User Context & Relations\n${mascotPrompts.user}\n\n`;
                }
                if (mascotPrompts.agents) {
                    systemPrompt += `# Mascot Rules & Action Guidelines\n${mascotPrompts.agents}\n\n`;
                }
                if (mascotPrompts.memory) {
                    systemPrompt += `# Mascot Long-term Memory\n${mascotPrompts.memory}\n\n`;
                }
            } catch (e) {
                console.error('Failed to load mascot prompts via IPC:', e);
            }
        }

        if (!systemPrompt.trim()) {
            systemPrompt = `あなたは対話型のAIデスクトップマスコットです。親しみやすく返答してください。`;
        }

        if (!systemPrompt.includes('[happy]') && !systemPrompt.includes('感情タグ')) {
            systemPrompt += "\n# System Instructions\n回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。例:「こんにちは！ [happy]」";
        }

        if (!systemPrompt.includes('[TIMER:')) {
            systemPrompt += "\n# Timer Instructions\nユーザーから「〇分後に教えて」「後でお知らせして」「カップラーメンにお湯を入れた」など、特定の時間経過後のお知らせやリマインドを求められた場合は、会話 of 応答テキストの末尾（感情タグの直前）に、必ず次のフォーマットでタイマー起動タグを付与してください。\n[TIMER:秒数,お知らせ内容]\n※秒数は半角数字で指定してください。お知らせ内容には具体的なリマインド内容を記述してください。例:「了解、3分測るね。[TIMER:180,カップラーメンができました！] [happy]」";
        }

        // 思考プロセスの非表示・出力防止指示をシステムプロンプトに追加
        systemPrompt += "\n# Output Restrictions\n出力の際、<think>タグや思考プロセス、推論ログ(Reasoning/Thinking)は一切出力しないでください。ユーザーへの回答文(セリフ)のみを直接出力してください。";

        const currentSession = sessions.value.find(s => s.id === activeSessionId.value);
        if (currentSession && currentSession.summary) {
            systemPrompt += `\n\n# Previous Conversation Summary\n以下はこれまでのマスターとの会話履歴の要約です。この文脈を考慮して返答してください。\n${currentSession.summary}\n`;
        }

        const aiMessageId = Date.now() + 1;
        messages.value.push({
            id: aiMessageId,
            sender: 'mascot',
            text: '考え中...'
        });
        
        await nextTick();
        scrollToBottom();

        if (useServer.value) {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                connectWebSocket();
                const errorMsg = messages.value.find(m => m.id === aiMessageId);
                if (errorMsg) {
                    errorMsg.text = 'サーバーに接続されていません。再接続を試みています。もう一度送信してください。';
                }
                mascotStore.setLoading(false);
                return;
            }

            socket.send(JSON.stringify({
                event: 'chat-send',
                data: {
                    message: userQuery,
                    apiKey: apiKey,
                    systemPrompt: systemPrompt,
                    model: model,
                    voicevoxSpeakerId: voicevoxSpeakerId,
                    voicevoxEndpoint: voicevoxEndpointUrl,
                    selectedVoiceEngine: voiceEngine,
                    irodoriEndpoint: irodoriEndpointUrl,
                    irodoriModel: irodoriModel,
                    irodoriVoice: irodoriVoice,
                    engine: engine,
                    lmstudioEndpoint: lmsEndpoint,
                    history: historyToSend,
                    useTts: useTts.value,
                    attachments: attachments.length > 0 ? attachments : undefined
                }
            }));
            await saveHistory();
            return;
        }

        try {
            let reply = '';
            if (window.electronAPI) {
                const rawHistory = JSON.parse(JSON.stringify(historyToSend));
                const rawAttachments = attachments.length > 0 ? JSON.parse(JSON.stringify(attachments)) : undefined;
                if (engine === 'lmstudio') {
                    reply = await window.electronAPI.askLmStudio(userQuery, systemPrompt, model, lmsEndpoint, rawHistory, rawAttachments);
                } else {
                    if (!apiKey) {
                        throw new Error(`${engine.toUpperCase()} APIキーが未設定です。右クリックから設定画面を開き、APIキーを登録してください。`);
                    }
                    reply = await window.electronAPI.askGemini(userQuery, apiKey, systemPrompt, model, rawHistory, rawAttachments);
                }
            } else {
                reply = 'ブラウザ実行時のモック回答です。[happy]';
            }

            let timerData: { seconds: number; memo: string } | null = null;
            const timerMatch = reply.match(/\[TIMER:(\d+),(.+?)\]/i);
            if (timerMatch && timerMatch[1] && timerMatch[2]) {
                timerData = {
                    seconds: parseInt(timerMatch[1], 10),
                    memo: timerMatch[2].trim()
                };
            }

            const cleanReply = reply.replace(/\[TIMER:.*?\]/gi, '').trim();

            const mascotMsg = messages.value.find(m => m.id === aiMessageId);
            if (mascotMsg) {
                mascotMsg.text = cleanReply;
            }
            await runCompaction(mascot?.id || 'default', activeSessionId.value!);
            await saveHistory();

            if (timerData && window.electronAPI) {
                window.electronAPI.startTimer(timerData.seconds, timerData.memo);
            }

            let detectedEmotion = 'neutral';
            const emotionMatch = cleanReply.match(/\[(\w+)\]/);
            if (emotionMatch && emotionMatch[1]) {
                detectedEmotion = emotionMatch[1].toLowerCase();
                mascotStore.setEmotion(detectedEmotion);
                if (window.electronAPI) {
                    window.electronAPI.changeEmotion(detectedEmotion);
                }
            }

            await nextTick();
            scrollToBottom();

            if (window.electronAPI && useTts.value) {
                const api = window.electronAPI;
                const speechText = cleanReply.replace(/\[\w+\]/g, '').trim();
                
                const sentences = speechText
                    .split(/(?<=[。！？\n])/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                const synthPromises = sentences.map(sentence => {
                    if (voiceEngine === 'irodori') {
                        return api.synthesizeIrodori(sentence, irodoriEndpointUrl, irodoriModel, irodoriVoice, detectedEmotion);
                    } else {
                        return api.synthesizeVoicevox(sentence, voicevoxSpeakerId, voicevoxEndpointUrl);
                    }
                });

                (async () => {
                    for (const promise of synthPromises) {
                        try {
                            const base64Audio = await promise;
                            if (base64Audio) {
                                playlist.push(base64Audio);
                            }
                        } catch (err) {
                            console.error('[ChatPanel] VOICEVOX並行合成エラー:', err);
                        }
                    }
                })();
            }

        } catch (error: any) {
            const mascotMsg = messages.value.find(m => m.id === aiMessageId);
            if (mascotMsg) {
                mascotMsg.text = `接続に失敗しました: ${error.message}`;
            }
            mascotStore.setSpeaking(false);
            await saveHistory();
        } finally {
            mascotStore.setLoading(false);
            await nextTick();
            scrollToBottom();
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.isComposing) return;

        if (chatSendKey.value === 'enter') {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        } else {
            if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }
    };

    // 設定変更時の再接続トリガーの監視
    watch(() => useServer.value, (val) => {
        if (val) connectWebSocket();
        else disconnectWebSocket();
    });

    watch([() => serverHost.value, () => serverPort.value], () => {
        if (useServer.value) {
            disconnectWebSocket();
            connectWebSocket();
        }
    });

    return {
        isWsConnected,
        sendMessage,
        connectWebSocket,
        disconnectWebSocket,
        handleKeyDown,
        pendingAttachments,
        attachFiles,
        removeAttachment
    };
}
