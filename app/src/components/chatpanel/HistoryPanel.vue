<script setup lang="ts">
import { ChatSession } from './useChatHistory';
import { useMascotStore } from '../../store/mascot';
import { storeToRefs } from 'pinia';

defineProps<{
    sessions: ChatSession[];
    activeSessionId: string | null;
}>();

const emit = defineEmits<{
    (e: 'select-session', sessionId: string): void;
    (e: 'delete-session', payload: { sessionId: string; event: Event }): void;
}>();

const mascotStore = useMascotStore();
const { isSecretMode } = storeToRefs(mascotStore);

const formatTimestamp = (timestamp: number | undefined, sessionId: string) => {
    let timeVal = timestamp;
    if (!timeVal && sessionId) {
        const parsed = parseInt(sessionId, 10);
        if (!isNaN(parsed) && parsed > 1000000000000) {
            timeVal = parsed;
        }
    }
    return timeVal ? new Date(timeVal).toLocaleString() : '不明な日時';
};
</script>

<template>
    <div class="history-container" :class="{ 'secret-history': isSecretMode }">
        <div class="history-list-header">
            <h3>{{ isSecretMode ? 'シークレット対話履歴一覧' : '対話履歴スレッド一覧' }}</h3>
        </div>
        <div class="history-list">
            <div 
                v-for="session in sessions" 
                :key="session.id" 
                class="history-item"
                :class="{ active: session.id === activeSessionId }"
                @click="emit('select-session', session.id)"
            >
                <div class="history-item-content">
                    <span class="history-item-title">{{ session.title }}</span>
                    <span class="history-item-time">{{ formatTimestamp(session.timestamp, session.id) }}</span>
                </div>
                <button class="delete-session-btn" @click="emit('delete-session', { sessionId: session.id, event: $event })" title="削除">
                    <i class="pi pi-trash"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.history-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.4);
}

.history-list-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.history-list-header h3 {
    margin: 0;
    font-size: 13px;
    color: #475569;
    text-align: left;
}

.history-list {
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 8px;
}

.history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
}

.history-item:hover {
    background: var(--color-primary-alpha-05);
    border-color: var(--color-primary-alpha-20);
}

.history-item.active {
    background: var(--color-primary-alpha-10);
    border-color: var(--color-primary-alpha-30);
}

.history-item-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow: hidden;
}

.history-item-title {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
}

.history-item-time {
    font-size: 10px;
    color: #94a3b8;
    text-align: left;
}

.delete-session-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.delete-session-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

/* シークレットモード時のスタイル */
.history-container.secret-history {
    background: rgba(15, 12, 30, 0.65);
    backdrop-filter: blur(10px);
}

.history-container.secret-history .history-list-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.history-container.secret-history .history-list-header h3 {
    color: #cbd5e1;
}

.history-container.secret-history .history-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.history-container.secret-history .history-item:hover {
    background: var(--color-primary-alpha-15);
    border-color: var(--color-primary-alpha-30);
}

.history-container.secret-history .history-item.active {
    background: var(--color-primary-alpha-25);
    border-color: var(--color-primary-alpha-45);
}

.history-container.secret-history .history-item-title {
    color: #f1f5f9;
}

.history-container.secret-history .history-item-time {
    color: #64748b;
}

.history-container.secret-history .delete-session-btn {
    color: #64748b;
}

.history-container.secret-history .delete-session-btn:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.2);
}
</style>
