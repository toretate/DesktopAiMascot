<script setup lang="ts">
import { ChatSession } from './useChatHistory';

defineProps<{
    sessions: ChatSession[];
    activeSessionId: string | null;
}>();

const emit = defineEmits<{
    (e: 'select-session', sessionId: string): void;
    (e: 'delete-session', payload: { sessionId: string; event: Event }): void;
}>();
</script>

<template>
    <div class="history-container">
        <div class="history-list-header">
            <h3>対話履歴スレッド一覧</h3>
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
                    <span class="history-item-time">{{ new Date(session.timestamp).toLocaleString() }}</span>
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
    background: rgba(168, 85, 247, 0.05);
    border-color: rgba(168, 85, 247, 0.2);
}

.history-item.active {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.3);
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
</style>
