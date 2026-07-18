<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfigStore } from '../../store/config';
import ImageGenerationFooter from './ImageGenerationFooter.vue';

const props = defineProps<{
    inputText: string;
    imageGenMode: 't2i' | 'i2i' | null;
    isSecretMode: boolean;
    pendingAttachments: Array<{
        type: string;
        name: string;
        url: string;
    }>;
}>();

const emit = defineEmits<{
    (e: 'update:inputText', value: string): void;
    (e: 'update:imageGenMode', value: 't2i' | 'i2i' | null): void;
    (e: 'submit'): void;
    (e: 'attach-files', event: Event): void;
    (e: 'remove-attachment', index: number): void;
}>();

const configStore = useConfigStore();
const { chatSendKey } = storeToRefs(configStore);

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleAttachFiles = (event: Event) => {
    emit('attach-files', event);
    if (fileInput.value) {
        fileInput.value.value = ''; // ファイル選択をリセット
    }
};

const handleFormSubmit = () => {
    if (isRecording.value) {
        stopSpeech();
    }
    emit('submit');
};

// --- 音声入力 (Speech-to-Text) 制御 ---
const isRecording = ref(false);
let recognition: any = null;
let speechStartText = '';

const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Speech recognition is not supported in this browser.');
        return null;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
        isRecording.value = true;
        speechStartText = props.inputText;
    };

    rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        const currentSpeech = finalTranscript || interimTranscript;
        const spacing = speechStartText && !speechStartText.endsWith(' ') ? ' ' : '';
        emit('update:inputText', speechStartText + spacing + currentSpeech);
    };

    rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        stopSpeech();
    };

    rec.onend = () => {
        isRecording.value = false;
    };

    return rec;
};

const toggleSpeech = () => {
    if (isRecording.value) {
        stopSpeech();
    } else {
        startSpeech();
    }
};

const startSpeech = () => {
    if (!recognition) {
        recognition = initSpeechRecognition();
    }
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    } else {
        alert('お使いのブラウザは音声入力に対応していません。');
    }
};

const stopSpeech = () => {
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error('Failed to stop recognition:', e);
        }
    }
    isRecording.value = false;
};

const onTextareaKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;

    if (chatSendKey.value === 'enter') {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleFormSubmit();
        }
    } else {
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            handleFormSubmit();
        }
    }
};
</script>

<template>
    <footer class="chat-footer" :class="{ 'secret-mode': isSecretMode }">
        <!-- 画像生成・編集モードインジケーター -->
        <ImageGenerationFooter 
            :mode="imageGenMode" 
            @update:mode="emit('update:imageGenMode', $event)" 
            :isSecretMode="isSecretMode" 
        />
        
        <!-- 送信前プレビュー一覧 -->
        <div v-if="pendingAttachments.length > 0" class="preview-panel">
            <div v-for="(att, idx) in pendingAttachments" :key="idx" class="preview-item">
                <img v-if="att.type === 'image'" :src="att.url" class="preview-thumb" />
                <div v-else class="preview-file-icon">
                    <i class="pi pi-file"></i>
                    <span class="preview-file-name" :title="att.name">{{ att.name }}</span>
                </div>
                <button class="remove-preview-btn" @click="emit('remove-attachment', idx)" type="button">
                    <i class="pi pi-times"></i>
                </button>
            </div>
        </div>

        <form @submit.prevent="handleFormSubmit()" class="input-form">
            <!-- ファイル選択用の隠しinput -->
            <input 
                type="file" 
                ref="fileInput" 
                style="display: none" 
                multiple 
                @change="handleAttachFiles" 
            />
            <button type="button" class="attach-btn" @click="triggerFileInput" title="ファイル・画像を添付">
                <i class="pi pi-paperclip"></i>
            </button>
            <button 
                type="button" 
                class="mic-btn" 
                :class="{ 'recording': isRecording, 'secret-mode': isSecretMode }" 
                @click="toggleSpeech" 
                :title="isRecording ? '音声入力を停止' : '音声入力を開始'"
            >
                <i class="pi" :class="isRecording ? 'pi-mic-slash' : 'pi-mic'"></i>
            </button>
            <textarea 
                :value="inputText"
                @input="emit('update:inputText', ($event.target as HTMLTextAreaElement).value)"
                :placeholder="imageGenMode ? (imageGenMode === 't2i' ? '[画像生成] プロンプトを入力...' : '[画像編集] 編集指示を入力...（元画像が必要です）') : 'メッセージを入力...'" 
                class="message-input"
                :class="{ 'secret-mode': isSecretMode }"
                rows="1"
                @keydown="onTextareaKeyDown"
            ></textarea>
            <button type="submit" class="send-btn" :class="{ 'secret-mode': isSecretMode }" :disabled="!inputText.trim() && pendingAttachments.length === 0">
                <i class="pi pi-send"></i>
            </button>
        </form>
    </footer>
</template>

<style scoped>
.chat-footer {
    padding: 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.2);
}

.input-form {
    display: flex;
    gap: 8px;
}

.message-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    padding: 8px 12px;
    color: #1e293b;
    font-size: 13px;
    outline: none;
    transition: all 0.2s ease;
    resize: none;
    font-family: inherit;
    height: 34px;
    box-sizing: border-box;
}

.message-input:focus {
    border-color: var(--color-primary);
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 0 2px var(--color-primary-alpha-10);
}

.message-input::placeholder {
    color: #94a3b8;
}

.send-btn {
    background: var(--theme-accent-400);
    border: none;
    color: #fff;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
    background: var(--color-primary);
}

.send-btn:disabled {
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.25);
    cursor: not-allowed;
}

/* 送信前プレビューパネル */
.preview-panel {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.3);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    overflow-x: auto;
}

.preview-item {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex-shrink: 0;
}

.preview-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
}

.preview-file-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 4px;
    color: #64748b;
}

.preview-file-icon i {
    font-size: 20px;
    color: var(--color-primary);
}

.preview-file-name {
    font-size: 8px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 4px;
}

.remove-preview-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.remove-preview-btn:hover {
    background: #dc2626;
}

.attach-btn {
    background: transparent;
    border: none;
    color: #64748b;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.attach-btn:hover {
    color: var(--color-primary);
    background: var(--color-primary-alpha-08);
}

/* シークレットモードスタイル */
.chat-footer.secret-mode {
    background: rgba(30, 27, 75, 0.4);
    border-top: 1px solid var(--color-primary-alpha-15);
}

.message-input.secret-mode {
    color: var(--color-primary-soft);
}

.message-input.secret-mode::placeholder {
    color: var(--color-primary-hover);
    opacity: 0.6;
}

.send-btn.secret-mode {
    color: #ffffff;
    background: var(--color-primary);
}

.send-btn.secret-mode:hover:not(:disabled) {
    background: var(--theme-accent-400);
    box-shadow: 0 0 8px var(--color-primary-alpha-40);
}

.chat-footer.secret-mode .attach-btn {
    color: var(--theme-accent-400);
}

.chat-footer.secret-mode .attach-btn:hover {
    color: var(--theme-accent-400);
    background: var(--color-primary-alpha-15);
}

/* 音声入力ボタン */
.mic-btn {
    background: transparent;
    border: none;
    color: #64748b;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.mic-btn:hover {
    color: var(--color-primary);
    background: var(--color-primary-alpha-08);
}

.mic-btn.recording {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    animation: mic-pulse 1.5s infinite;
}

@keyframes mic-pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    70% {
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    }
}

.chat-footer.secret-mode .mic-btn {
    color: var(--theme-accent-400);
}

.chat-footer.secret-mode .mic-btn:hover {
    color: var(--theme-accent-400);
    background: var(--color-primary-alpha-15);
}

.chat-footer.secret-mode .mic-btn.recording {
    color: #f87171;
    background: rgba(239, 68, 68, 0.2);
}
</style>
