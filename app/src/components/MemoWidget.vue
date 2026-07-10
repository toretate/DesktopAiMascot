<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useMemoStore, Memo } from '../store/memo';
import { useConfigStore } from '../store/config';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';

const memoStore = useMemoStore();
const configStore = useConfigStore();
const { windowMode } = storeToRefs(configStore);

// 新規メモ追加
const newMemoContent = ref('');

const handleAddMemo = () => {
    const content = newMemoContent.value.trim();
    if (!content) return;
    memoStore.addMemo(content);
    newMemoContent.value = '';
};

// インライン編集
const editingMemoId = ref<string | null>(null);
const editingContent = ref('');

const startEdit = (memo: Memo) => {
    editingMemoId.value = memo.id;
    editingContent.value = memo.content;
};

const saveEdit = () => {
    if (!editingMemoId.value) return;
    const content = editingContent.value.trim();
    if (content) {
        memoStore.updateMemo(editingMemoId.value, { content });
    }
    cancelEdit();
};

const cancelEdit = () => {
    editingMemoId.value = null;
    editingContent.value = '';
};

const handleDelete = (id: string) => {
    if (confirm('このメモを削除しますか？')) {
        memoStore.deleteMemo(id);
    }
};

// 統合モード用ドラッグ・リサイズ制御 (TaskManagement.vue に準拠)
const posX = ref(window.innerWidth - 750); // タスクウィジェットの左側に配置
const posY = ref(80);
const width = ref(340);
const height = ref(480);
const isLocalDragging = ref(false);
let localDragStartX = 0;
let localDragStartY = 0;

let isResizing = false;
let resizeDirection = '';
let startWidth = 0;
let startHeight = 0;
let startMouseX = 0;
let startMouseY = 0;

const initResize = (e: MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    resizeDirection = direction;
    startWidth = width.value;
    startHeight = height.value;
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', stopResize);
};

const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    let newWidth = startWidth;
    let newHeight = startHeight;

    if (resizeDirection === 'right' || resizeDirection === 'corner') {
        newWidth = Math.max(300, startWidth + dx);
    }
    if (resizeDirection === 'bottom' || resizeDirection === 'corner') {
        newHeight = Math.max(350, startHeight + dy);
    }

    width.value = newWidth;
    height.value = newHeight;

    if (windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
        if (window.electronAPI && window.electronAPI.resizeWindow) {
            window.electronAPI.resizeWindow({ width: newWidth, height: newHeight });
        }
    }
};

const stopResize = () => {
    isResizing = false;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', stopResize);
};

let isElectronDragging = false;
let electronDragStartX = 0;
let electronDragStartY = 0;

const startWidgetDrag = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || target.closest('button') || target.closest('input') || target.closest('textarea')) return;
    e.preventDefault();

    if (window.location.hash !== '#memo' && windowMode.value === 'integrated') {
        isLocalDragging.value = true;
        localDragStartX = e.clientX - posX.value;
        localDragStartY = e.clientY - posY.value;
        
        window.addEventListener('mousemove', onLocalMouseMove);
        window.addEventListener('mouseup', onLocalMouseUp);
    } else {
        if (window.electronAPI && window.electronAPI.dragWindow) {
            isElectronDragging = true;
            electronDragStartX = e.screenX;
            electronDragStartY = e.screenY;
            window.electronAPI.dragWindow({ dx: 0, dy: 0, isStart: true });
            
            window.addEventListener('mousemove', onElectronMouseMove);
            window.addEventListener('mouseup', onElectronMouseUp);
        }
    }
};

const onLocalMouseMove = (e: MouseEvent) => {
    if (!isLocalDragging.value) return;
    const x = e.clientX - localDragStartX;
    const y = e.clientY - localDragStartY;
    posX.value = Math.max(10, Math.min(window.innerWidth - width.value - 10, x));
    posY.value = Math.max(10, Math.min(window.innerHeight - height.value - 10, y));
};

const onLocalMouseUp = () => {
    isLocalDragging.value = false;
    window.removeEventListener('mousemove', onLocalMouseMove);
    window.removeEventListener('mouseup', onLocalMouseUp);
    
    localStorage.setItem('memo_widget_pos_x', posX.value.toString());
    localStorage.setItem('memo_widget_pos_y', posY.value.toString());
};

const onElectronMouseMove = (e: MouseEvent) => {
    if (!isElectronDragging) return;
    if (e.buttons !== 1) {
        onElectronMouseUp();
        return;
    }
    const dx = e.screenX - electronDragStartX;
    const dy = e.screenY - electronDragStartY;
    
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (window.electronAPI && window.electronAPI.dragWindow) {
            window.electronAPI.dragWindow({ dx, dy });
        }
        electronDragStartX = e.screenX;
        electronDragStartY = e.screenY;
    }
};

const onElectronMouseUp = () => {
    if (!isElectronDragging) return;
    isElectronDragging = false;
    window.removeEventListener('mousemove', onElectronMouseMove);
    window.removeEventListener('mouseup', onElectronMouseUp);
    if (window.electronAPI && window.electronAPI.dragWindow) {
        window.electronAPI.dragWindow({ dx: 0, dy: 0, isEnd: true });
    }
};

const closeWidget = () => {
    memoStore.showMemoWidget = false;
    if (window.location.hash !== '#memo' && windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
        if (window.electronAPI && window.electronAPI.toggleMemo) {
            window.electronAPI.toggleMemo();
        }
    }
};

const widgetStyle = computed(() => {
    const opacityValue = configStore.taskOpacity !== undefined ? configStore.taskOpacity : 1.0;
    const hash = window.location.hash;
    
    if (hash === '#memo') {
        return {
            width: '100%',
            height: '100%',
            opacity: opacityValue
        };
    }
    
    if (hash === '#compact') {
        return {
            width: '100%',
            height: '100%',
            opacity: opacityValue
        };
    }
    
    return {
        position: 'absolute' as const,
        left: `${posX.value}px`,
        top: `${posY.value}px`,
        width: `${width.value}px`,
        height: `${height.value}px`,
        opacity: opacityValue,
        zIndex: 100
    };
});

const isCompactView = computed(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash === '#compact';
});

onMounted(() => {
    memoStore.loadFromLocalStorage();

    const savedX = localStorage.getItem('memo_widget_pos_x');
    const savedY = localStorage.getItem('memo_widget_pos_y');
    
    let xVal = parseInt(savedX || '', 10);
    let yVal = parseInt(savedY || '', 10);
    
    if (!isNaN(xVal) && xVal >= 0 && xVal < window.innerWidth - 50) {
        posX.value = xVal;
    } else {
        posX.value = window.innerWidth - 750;
    }
    
    if (!isNaN(yVal) && yVal >= 0 && yVal < window.innerHeight - 50) {
        posY.value = yVal;
    } else {
        posY.value = 80;
    }
});
</script>

<template>
    <div 
        class="memo-widget-container shadow-sm relative overflow-hidden" 
        :style="widgetStyle"
    >
        <!-- Header / Drag Handle -->
        <header class="widget-header" @mousedown="startWidgetDrag">
            <h2 class="title">MEMO</h2>
            <Button 
                icon="pi pi-times" 
                class="p-button-text p-button-secondary widget-close-btn" 
                @click="closeWidget" 
                title="メモを閉じる" 
            />
        </header>

        <!-- Memo List -->
        <main class="main-scroll-area flex-grow-1" :class="{'opacity-50 pointer-events-none': !memoStore.isLoaded}">
            <div v-for="memo in memoStore.sortedMemos" :key="memo.id" class="memo-card relative">
                <div v-if="editingMemoId === memo.id" class="memo-edit w-full">
                    <Textarea v-model="editingContent" class="edit-textarea w-full text-sm" autoResize @keydown.ctrl.enter.prevent="saveEdit" />
                    <div class="flex justify-content-end gap-2 mt-2">
                        <Button icon="pi pi-times" class="p-button-text p-button-sm p-button-secondary p-0 h-2rem w-2rem" @click="cancelEdit" />
                        <Button icon="pi pi-check" class="p-button-text p-button-sm p-button-primary p-0 h-2rem w-2rem" @click="saveEdit" />
                    </div>
                </div>
                <div v-else class="memo-display w-full cursor-pointer" @click="startEdit(memo)">
                    <div class="memo-content text-sm white-space-pre-wrap">{{ memo.content }}</div>
                    <div class="flex justify-content-between align-items-center mt-2">
                        <div class="text-xs text-500">{{ new Date(memo.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) }}</div>
                        <Button icon="pi pi-trash" class="p-button-rounded p-button-text p-button-sm p-button-danger p-0 h-2rem w-2rem" @click.stop="handleDelete(memo.id)" />
                    </div>
                </div>
            </div>
            
            <div v-if="memoStore.sortedMemos.length === 0" class="empty-state">
                メモがありません。下部フォームから追加しましょう！
            </div>
        </main>

        <!-- Add Memo Form -->
        <div class="widget-footer-form">
            <InputText 
                v-model="newMemoContent" 
                placeholder="新しいメモを追加..." 
                class="flex-grow-1 task-input-field" 
                @keydown.enter="handleAddMemo" 
            />
            <Button icon="pi pi-plus" class="add-task-btn p-button-sm flex-shrink-0" @click="handleAddMemo" :disabled="!newMemoContent.trim()" />
        </div>

        <!-- Resize Handles -->
        <template v-if="!isCompactView">
            <div class="resize-handle right" @mousedown="initResize($event, 'right')"></div>
            <div class="resize-handle bottom" @mousedown="initResize($event, 'bottom')"></div>
            <div class="resize-handle corner" @mousedown="initResize($event, 'corner')"></div>
        </template>
    </div>
</template>

<style scoped>
.memo-widget-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    font-family: 'Outfit', 'Inter', sans-serif;
    color: #1e293b;
}

/* ヘッダー */
.widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid #f1f5f9;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
}

.widget-header:active {
    cursor: grabbing;
}

.title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #475569;
    margin: 0;
}

.widget-close-btn {
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
}

/* メインスクロールエリア */
.main-scroll-area {
    overflow-y: auto;
    padding: 8px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* メモカード (付箋風ではなくTODO LISTのタスクカードと統一) */
.memo-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    overflow: hidden;
    padding: 8px 12px;
    border-left: 3px solid #10b981; /* メモ用のエメラルドグリーン左枠線 */
    transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.memo-card:hover {
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.04);
}

.memo-content {
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    line-height: 1.4;
}

.empty-state {
    text-align: center;
    color: #64748b;
    padding: 24px 0;
    font-size: 12px;
}

/* 最下部固定フォーム */
.widget-footer-form {
    display: flex;
    padding: 8px;
    gap: 8px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
}

.task-input-field {
    border-color: #cbd5e1;
    height: 30px;
    font-size: 12px;
}

.task-input-field:focus {
    border-color: #3b82f6;
}

.add-task-btn {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

.add-task-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
}

.edit-textarea {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    color: #334155;
    background: #ffffff;
    resize: vertical;
    min-height: 60px;
}

.edit-textarea:focus {
    border-color: #3b82f6;
    outline: none;
}

/* リサイズハンドル */
.resize-handle {
    position: absolute;
    background: transparent;
    z-index: 9999;
}
.resize-handle.right {
    top: 0;
    right: 0;
    width: 6px;
    height: calc(100% - 10px);
    cursor: e-resize;
}
.resize-handle.bottom {
    bottom: 0;
    left: 0;
    width: calc(100% - 10px);
    height: 6px;
    cursor: s-resize;
}
.resize-handle.corner {
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    cursor: se-resize;
}
</style>
