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
    emit('submit');
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
    border-color: #a855f7;
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.1);
}

.message-input::placeholder {
    color: #94a3b8;
}

.send-btn {
    background: #c084fc;
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
    background: #a855f7;
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
    color: #a855f7;
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
    color: #a855f7;
    background: rgba(168, 85, 247, 0.08);
}

/* シークレットモードスタイル */
.chat-footer.secret-mode {
    background: rgba(30, 27, 75, 0.4);
    border-top: 1px solid rgba(168, 85, 247, 0.15);
}

.message-input.secret-mode {
    color: #f3e8ff;
}

.message-input.secret-mode::placeholder {
    color: #7c3aed;
    opacity: 0.6;
}

.send-btn.secret-mode {
    color: #ffffff;
    background: #8b5cf6;
}

.send-btn.secret-mode:hover:not(:disabled) {
    background: #a78bfa;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
}

.chat-footer.secret-mode .attach-btn {
    color: #a78bfa;
}

.chat-footer.secret-mode .attach-btn:hover {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
}
</style>
