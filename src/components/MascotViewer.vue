<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isChatVisible = ref(false);
const mascotEmoji = ref('🤖');
const emotionClass = ref('');

const toggleChat = () => {
    if (window.electronAPI) {
        window.electronAPI.toggleChat();
    }
};

const openSettings = () => {
    if (window.electronAPI) {
        window.electronAPI.openSettings();
    }
};

const emotionMap: Record<string, string> = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    surprised: '😲',
    neutral: '🤖'
};

onMounted(() => {
    if (window.electronAPI) {
        // チャットウィンドウ開閉の検知
        window.electronAPI.onChatToggled((visible: boolean) => {
            isChatVisible.value = visible;
        });

        // 感情変化イベントの検知
        window.electronAPI.onEmotionChanged((emotion: string) => {
            const normalized = emotion.toLowerCase();
            const emoji = emotionMap[normalized] || '🤖';
            mascotEmoji.value = emoji;

            // 表情変化時にポップアップアニメーションを実行
            emotionClass.value = 'emotion-pop';
            setTimeout(() => {
                emotionClass.value = '';
            }, 600);
        });
    }
});
</script>

<template>
    <div class="mascot-wrapper app-dark">
        <!-- マスコットのキャラクター描画部分 -->
        <div class="mascot-character drag-area" @contextmenu.prevent="openSettings">
            <div class="mascot-visual" :class="emotionClass">{{ mascotEmoji }}</div>
            <div class="hover-tip no-drag">右クリックで設定</div>
        </div>
        
        <!-- コントロールボタン -->
        <div class="control-panel no-drag">
            <button class="control-btn" :class="{ active: isChatVisible }" @click="toggleChat" title="チャットを開く">
                <i class="pi pi-comments"></i>
            </button>
            <button class="control-btn" @click="openSettings" title="設定画面を開く">
                <i class="pi pi-cog"></i>
            </button>
        </div>
    </div>
</template>

<style scoped>
.mascot-wrapper {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
}

.mascot-character {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: grab;
    user-select: none;
}

.mascot-character:active {
    cursor: grabbing;
}

.mascot-visual {
    font-size: 110px;
    animation: float 4s ease-in-out infinite;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
}

.hover-tip {
    font-size: 11px;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.8);
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 8px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.mascot-character:hover .hover-tip {
    opacity: 1;
}

.control-panel {
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 12px;
    background: rgba(18, 18, 18, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.control-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.control-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
}

.control-btn.active {
    color: #a855f7; /* パープルのアクセント */
    background: rgba(168, 85, 247, 0.15);
}

.mascot-visual.emotion-pop {
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes float {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-8px);
    }
}

@keyframes popIn {
    0% {
        transform: scale(0.6);
        opacity: 0.5;
    }
    50% {
        transform: scale(1.2);
    }
    100% {
        transform: scale(1.0);
        opacity: 1;
    }
}
</style>
