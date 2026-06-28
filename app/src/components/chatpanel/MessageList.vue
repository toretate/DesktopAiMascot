<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
    messages: Array<{
        id: number;
        sender: 'user' | 'mascot';
        text: string;
        attachments?: Array<{
            type: 'image' | 'file';
            name: string;
            url: string;
            size?: number;
        }>;
    }>;
    isSecretMode: boolean;
}>();

const emit = defineEmits<{
    (e: 'open-image', url: string): void;
    (e: 'use-i2i', url: string): void;
    (e: 'delete-message', id: number): void;
}>();

const messageContainer = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
    if (messageContainer.value) {
        messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
};

defineExpose({
    scrollToBottom
});

const downloadFile = (att: any) => {
    const link = document.createElement('a');
    link.href = att.url;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    return mb.toFixed(1) + ' MB';
};
</script>

<template>
    <div 
        class="message-container" 
        :class="{ 'secret-mode': isSecretMode }" 
        ref="messageContainer"
    >
        <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message-row"
            :class="msg.sender"
        >
            <div class="bubble-wrapper">
                <div class="bubble">
                    <div class="message-text">{{ msg.text }}</div>
                    
                    <!-- 添付ファイル・画像一覧 -->
                    <div v-if="msg.attachments && msg.attachments.length > 0" class="attachments-wrapper">
                        <div 
                            v-for="(att, attIndex) in msg.attachments" 
                            :key="attIndex" 
                            class="attachment-item"
                        >
                            <!-- 画像の場合 -->
                            <div v-if="att.type === 'image'" class="attachment-image-box">
                                <img :src="att.url" :alt="att.name" class="message-image" @click="emit('open-image', att.url)" />
                                <button type="button" class="use-i2i-btn" @click.stop="emit('use-i2i', att.url)" title="この画像を画像編集 (i2i) の元画像に設定">
                                    <i class="pi pi-pencil"></i> i2i元画像に設定
                                </button>
                            </div>
                            <!-- ファイルの場合 -->
                            <div v-else class="attachment-file-box" @click="downloadFile(att)" :title="att.name">
                                <i class="pi pi-file"></i>
                                <span class="file-name">{{ att.name }}</span>
                                <span v-if="att.size" class="file-size">({{ formatFileSize(att.size) }})</span>
                            </div>
                        </div>
                    </div>
                </div>
                <button type="button" class="delete-msg-btn" @click="emit('delete-message', msg.id)" title="メッセージを削除">
                    <i class="pi pi-trash"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.message-container {
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* スクロールバーのカスタマイズ */
.message-container::-webkit-scrollbar {
    width: 6px;
}
.message-container::-webkit-scrollbar-track {
    background: transparent;
}
.message-container::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 3px;
}

.message-row {
    display: flex;
    width: 100%;
}

.message-row.user {
    justify-content: flex-end;
}

.message-row.mascot {
    justify-content: flex-start;
}

.bubble-wrapper {
    position: relative;
    max-width: 85%;
    display: flex;
    align-items: center;
    gap: 6px;
}

.message-row.user .bubble-wrapper {
    flex-direction: row-reverse;
}

.message-row.mascot .bubble-wrapper {
    flex-direction: row;
}

.delete-msg-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.2s ease;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
}

.bubble-wrapper:hover .delete-msg-btn {
    opacity: 1;
}

.delete-msg-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

.bubble {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
}

.user .bubble {
    background: #e9d5ff;
    color: #581c87;
    border-bottom-right-radius: 2px;
    box-shadow: 0 2px 8px rgba(168, 85, 247, 0.08);
}

.mascot .bubble {
    background: rgba(243, 232, 255, 0.7);
    color: #4a2c7a;
    border-bottom-left-radius: 2px;
    border: 1px solid rgba(168, 85, 247, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

/* 添付ファイル・画像一覧スタイル */
.attachments-wrapper {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.attachment-item {
    max-width: 100%;
}

.attachment-image-box {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: transform 0.2s ease;
}

.attachment-image-box:hover {
    transform: scale(1.02);
}

.message-image {
    display: block;
    max-width: 200px;
    max-height: 150px;
    object-fit: cover;
}

.attachment-file-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    color: #475569;
    transition: all 0.2s ease;
    word-break: break-all;
}

.attachment-file-box:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: #a855f7;
}

.attachment-file-box i {
    color: #a855f7;
    font-size: 14px;
}

.file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-size {
    color: #94a3b8;
    font-size: 10px;
    white-space: nowrap;
}

/* チャット画像ホバー時のi2i設定ボタン */
.use-i2i-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(124, 58, 237, 0.85);
    color: white;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.2s ease, visibility 0.2s ease, background 0.2s ease, transform 0.2s ease;
    backdrop-filter: blur(4px);
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.attachment-image-box:hover .use-i2i-btn {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
}

.use-i2i-btn:hover {
    background: rgba(124, 58, 237, 1);
    transform: scale(1.05);
}

/* シークレットモードスタイル */
.message-container.secret-mode {
    background: transparent;
}

.message-container.secret-mode .message-row.user .bubble {
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.message-container.secret-mode .message-row.mascot .bubble {
    background: rgba(46, 37, 84, 0.8);
    color: #e9d5ff;
    border: 1px solid rgba(168, 85, 247, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
