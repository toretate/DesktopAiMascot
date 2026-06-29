<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTaskStore, Task, SubTask } from '../store/task';
import { useConfigStore } from '../store/config';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import Slider from 'primevue/slider';

const taskStore = useTaskStore();
const configStore = useConfigStore();
const { windowMode } = storeToRefs(configStore);

// 自動フォーカス用ディレクティブ
const vFocus = {
    mounted: (el: HTMLElement) => el.focus()
};

// 表示制御
const showCategorySettings = ref(false); // インライン設定パネル表示トグル
const newTaskTitle = ref('');
const newSubTaskTitleMap = ref<Record<string, string>>({});

// インプレース編集用ステート
const editingTaskId = ref<string | null>(null);
const editingSubTaskId = ref<string | null>(null);
const activeCalendarTaskId = ref<string | null>(null);

const getDatetimeLocalString = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
};

const handleDateChange = (taskId: string, event: Event) => {
    const target = event.target as HTMLInputElement;
    const val = target.value;
    if (val) {
        const date = new Date(val);
        taskStore.updateTask(taskId, { scheduledAt: date.toISOString() });
    } else {
        taskStore.updateTask(taskId, { scheduledAt: undefined });
    }
    activeCalendarTaskId.value = null;
};
const editingTitle = ref('');

// 新規カテゴリ名
const newCategoryName = ref('');

// ドラッグ＆ドロップ用ステート (リスト内並び替え用)
const draggedTaskId = ref<string | null>(null);

// 統合モード用ドラッグ座標
const posX = ref(window.innerWidth - 400); // 画面右寄りに配置
const posY = ref(80);
const isLocalDragging = ref(false);
let localDragStartX = 0;
let localDragStartY = 0;

// ウィジェットのサイズ (統合・分離リサイズ用)
const width = ref(360);
const height = ref(550);
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

    // 分離モード時はElectronウィンドウサイズを変更
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

// 閉じるアクション
const closeWidget = () => {
    if (windowMode.value === 'integrated' || windowMode.value === 'compact') {
        taskStore.showTaskWidget = false;
    } else {
        if (window.electronAPI && window.electronAPI.toggleTasks) {
            window.electronAPI.toggleTasks();
        }
    }
};

// Electron用ウィンドウドラッグ状態
let isElectronDragging = false;
let electronDragStartX = 0;
let electronDragStartY = 0;

// ドラッグ開始ハンドラ
const startWidgetDrag = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // ボタンや入力欄、チェックボックス、進捗バー等ではドラッグ移動を開始しない
    if (
        e.button !== 0 || 
        target.closest('button') || 
        target.closest('input') || 
        target.closest('.category-tabs') || 
        target.closest('.completion-progress') ||
        target.closest('.view-selector') ||
        target.closest('.resize-handle')
    ) return;
    
    e.preventDefault();
    
    if (windowMode.value === 'integrated') {
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
    // 画面外への完全な消失を防ぐ境界制限
    const x = e.clientX - localDragStartX;
    const y = e.clientY - localDragStartY;
    posX.value = Math.max(10, Math.min(window.innerWidth - width.value - 10, x));
    posY.value = Math.max(10, Math.min(window.innerHeight - height.value - 10, y));
};

const onLocalMouseUp = () => {
    isLocalDragging.value = false;
    window.removeEventListener('mousemove', onLocalMouseMove);
    window.removeEventListener('mouseup', onLocalMouseUp);
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

// 統合モードと分離モードに応じたスタイルの計算
const widgetStyle = computed(() => {
    const opacityValue = configStore.taskOpacity !== undefined ? configStore.taskOpacity : 1.0;
    if (windowMode.value === 'integrated') {
        return {
            position: 'absolute' as const,
            left: `${posX.value}px`,
            top: `${posY.value}px`,
            width: `${width.value}px`,
            height: `${height.value}px`,
            opacity: opacityValue,
            zIndex: 100
        };
    }
    return {
        width: '100%',
        height: '100%',
        opacity: opacityValue
    };
});

// 初期データロード
onMounted(() => {
    taskStore.loadFromLocalStorage();
});

// インプレース編集メソッド
let pressTimer: any = null;
const handlePressStart = (type: 'task' | 'subtask', item: any, parentId?: string) => {
    pressTimer = setTimeout(() => {
        if (type === 'task') {
            startEditTask(item);
        } else {
            startEditSubTask(parentId!, item);
        }
    }, 700);
};

const handlePressEnd = () => {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
};

const startEditTask = (task: Task) => {
    editingTaskId.value = task.id;
    editingSubTaskId.value = null;
    editingTitle.value = task.title;
};

const startEditSubTask = (taskId: string, subTask: SubTask) => {
    editingTaskId.value = taskId;
    editingSubTaskId.value = subTask.id;
    editingTitle.value = subTask.title;
};

const saveTitleEdit = () => {
    if (!editingTaskId.value) return;
    const title = editingTitle.value.trim();
    if (title) {
        if (editingSubTaskId.value) {
            taskStore.updateSubTask(editingTaskId.value, editingSubTaskId.value, { title });
        } else {
            taskStore.updateTask(editingTaskId.value, { title });
        }
    }
    cancelTitleEdit();
};

const cancelTitleEdit = () => {
    editingTaskId.value = null;
    editingSubTaskId.value = null;
    editingTitle.value = '';
};

// カテゴリ編集インラインメソッド
const handleAddCategory = () => {
    const name = newCategoryName.value.trim();
    if (!name) return;
    taskStore.addCategory(name);
    newCategoryName.value = '';
};

const handleDeleteCategory = (id: string) => {
    if (confirm('このカテゴリを削除しますか？配下のタスクもすべて削除されます。')) {
        taskStore.deleteCategory(id);
    }
};

const moveUp = (index: number) => {
    if (index === 0) return;
    const cats = [...taskStore.categories];
    const temp = cats[index];
    cats[index] = cats[index - 1];
    cats[index - 1] = temp;
    taskStore.updateCategoriesOrder(cats);
};

const moveDown = (index: number) => {
    if (index === taskStore.categories.length - 1) return;
    const cats = [...taskStore.categories];
    const temp = cats[index];
    cats[index] = cats[index + 1];
    cats[index + 1] = temp;
    taskStore.updateCategoriesOrder(cats);
};

const closeSettingsPanel = () => {
    showCategorySettings.value = false;
    configStore.saveConfig();
};

// ビュー切り替えオプション
const viewOptions = [
    { label: 'TODO', value: 'todo' },
    { label: 'TIMELINE', value: 'timeline' }
];

// タスク追加
const handleAddTask = () => {
    const title = newTaskTitle.value.trim();
    if (!title) return;
    taskStore.addTask(taskStore.activeCategoryId, title, 'normal');
    newTaskTitle.value = '';
};

// サブタスク追加
const handleAddSubTask = (taskId: string) => {
    const title = (newSubTaskTitleMap.value[taskId] || '').trim();
    if (!title) return;
    taskStore.addSubTask(taskId, title);
    newSubTaskTitleMap.value[taskId] = '';
};

// 優先度の切り替えサイクル
const cyclePriority = (task: Task) => {
    const priorities: ('normal' | 'star' | 'thunder')[] = ['normal', 'star', 'thunder'];
    const currentIndex = priorities.indexOf(task.priority);
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];
    taskStore.updateTask(task.id, { priority: nextPriority });
};

// サブタスクのステータス切り替えサイクル
const cycleSubTaskStatus = (task: Task, step: SubTask) => {
    const statuses: ('todo' | 'doing' | 'done')[] = ['todo', 'doing', 'done'];
    const currentIndex = statuses.indexOf(step.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    taskStore.updateSubTaskStatus(task.id, step.id, nextStatus);
};

// ドラッグハンドラ (HTML5 ネイティブドラッグ)
const onDragStart = (taskId: string) => {
    draggedTaskId.value = taskId;
};

const onDragOver = (event: DragEvent) => {
    event.preventDefault(); // ドロップ可能にするために必要
};

const onDrop = (targetTaskId: string) => {
    if (!draggedTaskId.value || draggedTaskId.value === targetTaskId) return;

    const currentTasks = [...taskStore.filteredTasks];
    const draggedIdx = currentTasks.findIndex(t => t.id === draggedTaskId.value);
    const targetIdx = currentTasks.findIndex(t => t.id === targetTaskId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
        // 並び替え処理
        const [removed] = currentTasks.splice(draggedIdx, 1);
        currentTasks.splice(targetIdx, 0, removed);
        taskStore.updateTasksOrder(currentTasks);
    }
    draggedTaskId.value = null;
};

// カテゴリ名の取得（タイムライン表示用）
const getCategoryName = (catId: string) => {
    const cat = taskStore.categories.find(c => c.id === catId);
    return cat ? cat.name : '未分類';
};

// 時間フォーマット（タイムライン表示用）
const formatTime = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch {
        return '';
    }
};

const formatScheduledDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch {
        return '';
    }
};
</script>

<template>
    <div class="task-widget-container shadow-sm" :style="widgetStyle">
        <!-- 1. ヘッダー：タイトル ＆ 水平進捗バー -->
        <header class="widget-header" @mousedown="startWidgetDrag">
            <h2 class="title">TODO LIST</h2>
            <div class="progress-section" v-if="taskStore.currentView === 'todo'">
                <ProgressBar 
                    :value="taskStore.activeCategoryCompletionRate" 
                    class="completion-progress"
                />
                <span class="progress-label">{{ taskStore.activeCategoryCompletionRate }}%</span>
            </div>
            <!-- 閉じるボタン -->
            <Button
                icon="pi pi-times"
                class="p-button-text p-button-secondary widget-close-btn"
                @click="closeWidget"
                title="タスク管理を閉じる"
            />
        </header>

        <!-- 2. カスタムタブ列 ＋ タブ管理ボタン (TODO ビュー選択時のみ表示) -->
        <div class="tab-navigation-bar" v-if="taskStore.currentView === 'todo' && !showCategorySettings">
            <div class="category-tabs">
                <button
                    v-for="cat in taskStore.categories"
                    :key="cat.id"
                    class="tab-btn"
                    :class="{ active: taskStore.activeCategoryId === cat.id }"
                    @click="taskStore.activeCategoryId = cat.id"
                >
                    {{ cat.name }}
                </button>
            </div>
            <Button
                icon="pi pi-cog"
                class="p-button-text p-button-secondary tab-settings-btn"
                @click="showCategorySettings = true"
                title="カテゴリ管理を開く"
            />
        </div>

        <!-- 3. メインスクロールエリア -->
        <main class="main-scroll-area">
            <div v-if="!showCategorySettings" style="height: 100%; display: flex; flex-direction: column;">
            <!-- (A) TODOビュー (タスクツリー) -->
            <div class="todo-view" v-if="taskStore.currentView === 'todo'">
                <div 
                    v-for="task in taskStore.filteredTasks" 
                    :key="task.id"
                    class="task-card"
                    :class="{ 'status-doing': task.status === 'doing', 'status-done': task.completed }"
                    draggable="true"
                    @dragstart="onDragStart(task.id)"
                    @dragover="onDragOver"
                    @drop="onDrop(task.id)"
                >
                    <!-- 親タスク行 -->
                    <div class="parent-task-row">
                        <!-- ドラッグハンドル -->
                        <div class="drag-handle" title="ドラッグして並べ替え">
                            <i class="pi pi-bars"></i>
                        </div>

                        <!-- 完了チェックボックス -->
                        <div class="checkbox-wrapper" @click="taskStore.toggleTask(task.id)">
                            <i :class="task.completed ? 'pi pi-check-circle checked' : 'pi pi-circle-off unchecked'"></i>
                        </div>

                        <!-- タイトル ＆ 進行中バッジ -->
                        <div class="task-title-container flex-grow-1" style="display: flex; align-items: center; overflow: hidden; min-width: 0; gap: 6px;">
                            <span v-if="task.status === 'doing'" class="doing-badge-pill">進行中</span>
                            <span 
                                v-if="editingTaskId !== task.id || editingSubTaskId !== null"
                                class="task-title" 
                                :class="{ completed: task.completed }"
                                @click="taskStore.updateTask(task.id, { expanded: !task.expanded })"
                                @dblclick="startEditTask(task)"
                                @mousedown="handlePressStart('task', task)"
                                @mouseup="handlePressEnd"
                                @mouseleave="handlePressEnd"
                                @touchstart="handlePressStart('task', task)"
                                @touchend="handlePressEnd"
                                style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"
                            >
                                {{ task.title }}
                            </span>
                            <InputText
                                v-else
                                v-model="editingTitle"
                                class="p-inputtext-sm edit-title-input w-full"
                                @blur="saveTitleEdit"
                                @keyup.enter="saveTitleEdit"
                                @keyup.esc="cancelTitleEdit"
                                v-focus
                            />
                        </div>

                        <!-- サブタスク完了カウント/展開ボタン -->
                        <div 
                            class="steps-badge"
                            @click="taskStore.updateTask(task.id, { expanded: !task.expanded })"
                            v-if="task.steps.length > 0"
                        >
                            {{ task.steps.filter(s => s.completed).length }}/{{ task.steps.length }} Steps
                        </div>

                        <!-- 開始・終了ボタン -->
                        <button 
                            v-if="task.status === 'todo' && !task.completed"
                            class="action-icon-btn start-task-btn" 
                            @click="taskStore.startTask(task.id)"
                            title="タスクを開始（着手）"
                        >
                            <i class="pi pi-play"></i>
                        </button>
                        <button 
                            v-else-if="task.status === 'doing'"
                            class="action-icon-btn complete-task-btn" 
                            @click="taskStore.completeTask(task.id)"
                            title="タスクを終了（完了）"
                        >
                            <i class="pi pi-stop"></i>
                        </button>

                        <!-- カレンダー設定ボタン (未設定時のみ) -->
                        <button 
                            v-if="!task.scheduledAt"
                            class="action-icon-btn calendar-set-btn" 
                            @click="activeCalendarTaskId = task.id"
                            title="実施予定日時を設定"
                        >
                            <i class="pi pi-calendar"></i>
                        </button>

                        <!-- 優先度切り替え -->
                        <button 
                            class="priority-btn" 
                            :class="task.priority"
                            @click="cyclePriority(task)"
                            title="優先度を切り替え"
                        >
                            <i v-if="task.priority === 'thunder'" class="pi pi-bolt"></i>
                            <i v-else-if="task.priority === 'star'" class="pi pi-star-fill"></i>
                            <i v-else class="pi pi-minus"></i>
                        </button>

                        <!-- アコーディオン開閉矢印 -->
                        <button 
                            class="expand-btn"
                            @click="taskStore.updateTask(task.id, { expanded: !task.expanded })"
                        >
                            <i :class="task.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
                        </button>

                        <!-- 削除ボタン -->
                        <Button 
                            icon="pi pi-trash" 
                            class="p-button-text p-button-danger p-button-sm task-delete-btn"
                            @click="taskStore.deleteTask(task.id)"
                            title="タスクを削除"
                        />
                    </div>

                    <!-- 予定日時 & カレンダー設定用サブ行 -->
                    <div class="task-schedule-row" v-if="task.scheduledAt || activeCalendarTaskId === task.id">
                        <div v-if="activeCalendarTaskId !== task.id" class="scheduled-display" @click="activeCalendarTaskId = task.id" title="クリックして予定を変更">
                            <i class="pi pi-calendar-times icon-cal"></i>
                            <span class="scheduled-time">{{ formatScheduledDate(task.scheduledAt) }}</span>
                            <Button 
                                icon="pi pi-times" 
                                class="p-button-text p-button-danger p-button-xs date-clear-btn" 
                                @click.stop="taskStore.updateTask(task.id, { scheduledAt: undefined })" 
                                title="予定をクリア" 
                            />
                        </div>
                        <div v-else class="scheduled-picker-wrapper">
                            <input 
                                type="datetime-local" 
                                :value="getDatetimeLocalString(task.scheduledAt)" 
                                class="datetime-picker-input"
                                @change="handleDateChange(task.id, $event)"
                                @blur="activeCalendarTaskId = null"
                                v-focus
                            />
                        </div>
                    </div>

                    <!-- サブタスク（Step）展開エリア -->
                    <div class="subtasks-container" v-if="task.expanded">
                        <div class="subtask-list">
                            <!-- 接続線 -->
                            <div class="guide-line"></div>
                            
                            <!-- サブタスク項目 -->
                            <div 
                                v-for="step in task.steps" 
                                :key="step.id"
                                class="subtask-item"
                            >
                                <!-- 完了トグル -->
                                <div class="checkbox-wrapper" @click="taskStore.toggleSubTask(task.id, step.id)">
                                    <i :class="step.completed ? 'pi pi-check-circle checked' : 'pi pi-circle-off unchecked'"></i>
                                </div>

                                <!-- ステータスバッジ（todo, doing, done をクリックで切り替え） -->
                                <button 
                                    class="status-badge"
                                    :class="step.status"
                                    @click="cycleSubTaskStatus(task, step)"
                                    title="ステータスを切り替え"
                                >
                                    {{ step.status.toUpperCase() }}
                                </button>

                                <div class="subtask-title-container flex-grow-1" style="display: flex; align-items: center; overflow: hidden; min-width: 0; margin-right: 8px;">
                                    <span 
                                        v-if="editingTaskId !== task.id || editingSubTaskId !== step.id"
                                        class="subtask-title" 
                                        :class="{ completed: step.completed }"
                                        @dblclick="startEditSubTask(task.id, step)"
                                        @mousedown="handlePressStart('subtask', step, task.id)"
                                        @mouseup="handlePressEnd"
                                        @mouseleave="handlePressEnd"
                                        @touchstart="handlePressStart('subtask', step, task.id)"
                                        @touchend="handlePressEnd"
                                        style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"
                                    >
                                        {{ step.title }}
                                    </span>
                                    <InputText
                                        v-else
                                        v-model="editingTitle"
                                        class="p-inputtext-sm edit-title-input w-full"
                                        @blur="saveTitleEdit"
                                        @keyup.enter="saveTitleEdit"
                                        @keyup.esc="cancelTitleEdit"
                                        v-focus
                                    />
                                </div>

                                <Button 
                                    icon="pi pi-times" 
                                    class="p-button-text p-button-secondary p-button-sm step-delete-btn"
                                    @click="taskStore.deleteSubTask(task.id, step.id)"
                                    title="サブタスクを削除"
                                />
                            </div>

                            <!-- サブタスク追加フォーム -->
                            <div class="add-subtask-form">
                                <InputText 
                                    v-model="newSubTaskTitleMap[task.id]" 
                                    placeholder="新しいステップを追加..."
                                    class="p-inputtext-sm subtask-input"
                                    @keyup.enter="handleAddSubTask(task.id)"
                                />
                                <Button 
                                    icon="pi pi-plus" 
                                    class="p-button-text p-button-sm p-button-secondary"
                                    @click="handleAddSubTask(task.id)"
                                    :disabled="!(newSubTaskTitleMap[task.id] || '').trim()"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="taskStore.filteredTasks.length === 0" class="empty-state">
                    タスクがありません。下部フォームから追加しましょう！
                </div>
            </div>

            <!-- (B) TIMELINEビュー (時系列フラットリスト) -->
            <div class="timeline-view" v-else>
                <div 
                    v-for="task in taskStore.timelineTasks" 
                    :key="task.id"
                    class="timeline-item"
                >
                    <div class="timeline-marker">
                        <i :class="task.completed ? 'pi pi-check-circle checked' : 'pi pi-circle-off unchecked'"></i>
                        <div class="timeline-line"></div>
                    </div>
                    <div class="timeline-content-card">
                        <div class="timeline-meta">
                            <span class="timeline-time">{{ formatTime(task.createdAt) }}</span>
                            <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                        </div>
                        <h4 class="timeline-task-title" :class="{ completed: task.completed }">
                            {{ task.title }}
                        </h4>
                    </div>
                </div>

                <div v-if="taskStore.tasks.length === 0" class="empty-state">
                    タスクがありません。
                </div>
            </div>
            </div>

            <!-- (C) インライン設定パネル -->
            <div v-else class="inline-settings-panel">
                <div class="settings-header">
                    <Button 
                        icon="pi pi-arrow-left" 
                        class="p-button-text p-button-secondary p-button-sm back-btn" 
                        @click="closeSettingsPanel" 
                        label="戻る" 
                    />
                </div>

                <div class="settings-content">
                    <!-- カテゴリ管理 -->
                    <div class="settings-section">
                        <span class="section-title">カテゴリの管理</span>
                        <div class="category-list">
                            <div 
                                v-for="(cat, idx) in taskStore.categories" 
                                :key="cat.id" 
                                class="category-item"
                            >
                                <div class="cat-left">
                                    <div class="order-buttons">
                                        <Button 
                                            icon="pi pi-chevron-up" 
                                            class="p-button-text p-button-sm p-button-secondary move-btn" 
                                            :disabled="idx === 0"
                                            @click="moveUp(idx)"
                                            title="上へ移動"
                                        />
                                        <Button 
                                            icon="pi pi-chevron-down" 
                                            class="p-button-text p-button-sm p-button-secondary move-btn" 
                                            :disabled="idx === taskStore.categories.length - 1"
                                            @click="moveDown(idx)"
                                            title="下へ移動"
                                        />
                                    </div>
                                    <InputText 
                                        v-model="cat.name" 
                                        class="p-inputtext-sm cat-name-input"
                                        @blur="taskStore.updateCategory(cat.id, cat.name)"
                                        placeholder="カテゴリ名"
                                    />
                                </div>
                                <Button 
                                    icon="pi pi-trash" 
                                    class="p-button-text p-button-danger p-button-sm delete-btn" 
                                    @click="handleDeleteCategory(cat.id)"
                                    title="削除"
                                />
                            </div>
                            <div v-if="taskStore.categories.length === 0" class="empty-message">
                                カテゴリが登録されていません。
                            </div>
                        </div>

                        <!-- カテゴリ追加 -->
                        <div class="add-category-form">
                            <InputText 
                                v-model="newCategoryName" 
                                placeholder="カテゴリを追加..."
                                class="p-inputtext-sm flex-grow-1"
                                @keyup.enter="handleAddCategory"
                            />
                            <Button 
                                icon="pi pi-plus" 
                                class="p-button-sm add-btn"
                                @click="handleAddCategory"
                                :disabled="!newCategoryName.trim()"
                            />
                        </div>
                    </div>

                    <div class="divider"></div>

                    <!-- 不透明度設定 -->
                    <div class="settings-section">
                        <span class="section-title">不透明度 (透明度)</span>
                        <div class="opacity-control">
                            <span class="opacity-value">{{ Math.round(configStore.taskOpacity * 100) }}%</span>
                            <Slider 
                                v-model="configStore.taskOpacity" 
                                :min="0.1" 
                                :max="1.0" 
                                :step="0.05"
                                class="opacity-slider"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- 4. ビュー切り替えタブ (TODO / TIMELINE) -->
        <div class="view-toggle-bar" v-if="!showCategorySettings">
            <SelectButton 
                v-model="taskStore.currentView" 
                :options="viewOptions" 
                optionLabel="label" 
                optionValue="value" 
                class="view-selector"
            />
        </div>

        <!-- 5. 最下部固定フォーム -->
        <footer class="widget-footer-form" v-if="!showCategorySettings">
            <InputText 
                v-model="newTaskTitle" 
                placeholder="新しいタスクを追加..." 
                class="p-inputtext-sm flex-grow-1 task-input-field"
                @keyup.enter="handleAddTask"
            />
            <Button 
                icon="pi pi-plus" 
                class="p-button-sm add-task-btn" 
                @click="handleAddTask"
                :disabled="!newTaskTitle.trim()"
            />
        </footer>

        <!-- リサイズ用ハンドル -->
        <div class="resize-handle right" @mousedown="initResize($event, 'right')"></div>
        <div class="resize-handle bottom" @mousedown="initResize($event, 'bottom')"></div>
        <div class="resize-handle corner" @mousedown="initResize($event, 'corner')"></div>
    </div>
</template>

<style scoped>
.task-widget-container {
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

/* 1. ヘッダー */
.widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
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

.progress-section {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 120px;
}

.completion-progress {
    height: 6px !important;
    background: #e2e8f0;
    flex-grow: 1;
}

:deep(.p-progressbar-value) {
    background: #3b82f6;
}

.progress-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    width: 28px;
    text-align: right;
}

/* 2. カスタムタブ列 */
.tab-navigation-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
}

.category-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
}

.category-tabs::-webkit-scrollbar {
    display: none; /* Safari, Chrome */
}

.tab-btn {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
}

.tab-btn:hover {
    color: #1e293b;
    background: #e2e8f0;
}

.tab-btn.active {
    color: #3b82f6;
    background: #eff6ff;
}

.tab-settings-btn {
    width: 28px !important;
    height: 28px !important;
    padding: 0 !important;
}

/* 3. メインスクロールエリア */
.main-scroll-area {
    flex-grow: 1;
    overflow-y: auto;
    padding: 12px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.todo-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* タスクカード */
.task-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    overflow: hidden;
}

.parent-task-row {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
}

.drag-handle {
    cursor: grab;
    color: #94a3b8;
    padding: 4px;
    display: flex;
    align-items: center;
}

.drag-handle:active {
    cursor: grabbing;
}

.checkbox-wrapper {
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    color: #94a3b8;
}

.checkbox-wrapper i.checked {
    color: #10b981;
}

.task-title {
    flex-grow: 1;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.task-title.completed {
    color: #94a3b8;
    text-decoration: line-through;
}

.steps-badge {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
}

.priority-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    color: #94a3b8;
}

.priority-btn.thunder {
    color: #ef4444;
}

.priority-btn.star {
    color: #eab308;
}

.expand-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #64748b;
    font-size: 12px;
    padding: 4px;
}

.task-delete-btn {
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
}

/* サブタスクエリア */
.subtasks-container {
    background: #f8fafc;
    border-top: 1px solid #f1f5f9;
    padding: 8px 12px 12px 12px;
}

.subtask-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 20px;
}

.guide-line {
    position: absolute;
    left: 8px;
    top: 0;
    bottom: 20px;
    width: 1px;
    background: #cbd5e1;
}

.subtask-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}

.status-badge {
    font-size: 9px;
    font-weight: 700;
    border: none;
    border-radius: 4px;
    padding: 2px 5px;
    cursor: pointer;
    white-space: nowrap;
}

.status-badge.todo {
    background: #e2e8f0;
    color: #475569;
}

.status-badge.doing {
    background: #dbeafe;
    color: #1d4ed8;
}

.status-badge.done {
    background: #d1fae5;
    color: #065f46;
}

.subtask-title {
    flex-grow: 1;
    font-size: 12px;
    color: #475569;
}

.subtask-title.completed {
    color: #94a3b8;
    text-decoration: line-through;
}

.step-delete-btn {
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
}

.add-subtask-form {
    display: flex;
    gap: 6px;
    padding-top: 4px;
}

.subtask-input {
    flex-grow: 1;
    height: 26px;
    font-size: 11px;
    border-color: #e2e8f0;
}

.empty-state {
    text-align: center;
    color: #64748b;
    padding: 24px 0;
    font-size: 12px;
}

/* TIMELINEビュー */
.timeline-view {
    display: flex;
    flex-direction: column;
    padding-left: 8px;
}

.timeline-item {
    display: flex;
    gap: 12px;
    position: relative;
}

.timeline-marker {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.timeline-line {
    width: 2px;
    background: #e2e8f0;
    flex-grow: 1;
    min-height: 24px;
}

.timeline-item:last-child .timeline-line {
    display: none;
}

.timeline-content-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 12px;
    flex-grow: 1;
    box-shadow: 0 1px 2px rgba(0,0,0,0.01);
}

.timeline-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.timeline-time {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 500;
}

.timeline-cat-badge {
    font-size: 9px;
    font-weight: 600;
    color: #3b82f6;
    background: #eff6ff;
    padding: 1px 4px;
    border-radius: 3px;
}

.timeline-task-title {
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    margin: 0;
}

.timeline-task-title.completed {
    color: #94a3b8;
    text-decoration: line-through;
}

/* 4. ビュー切り替えタブ */
.view-toggle-bar {
    display: flex;
    justify-content: center;
    padding: 6px 12px;
    border-top: 1px solid #f1f5f9;
    background: #ffffff;
}

.view-selector {
    transform: scale(0.9);
}

:deep(.p-selectbutton .p-button) {
    font-size: 11px;
    padding: 6px 16px;
}

/* 5. 最下部固定フォーム */
.widget-footer-form {
    display: flex;
    padding: 12px;
    gap: 8px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
}

.flex-grow-1 {
    flex-grow: 1;
}

.task-input-field {
    border-color: #cbd5e1;
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

.widget-close-btn {
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
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

/* インプレース編集インプット */
.edit-title-input {
    padding: 2px 6px !important;
    font-size: 13px !important;
    height: 24px !important;
    border-color: #3b82f6 !important;
}

/* インライン設定パネル */
.inline-settings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px;
}

.settings-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 8px;
}

.settings-header .back-btn {
    padding: 4px 8px !important;
    font-size: 12px !important;
    height: 28px !important;
}

.settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    flex-grow: 1;
}

.settings-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.section-title {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
}

.category-list {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
}

.category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 8px;
    gap: 12px;
}

.cat-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-grow: 1;
}

.order-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.move-btn {
    width: 18px !important;
    height: 18px !important;
    padding: 0 !important;
}

.cat-name-input {
    flex-grow: 1;
    border-color: #cbd5e1;
    background: #ffffff;
    padding: 4px 8px !important;
    font-size: 12px !important;
    height: 28px !important;
}

.cat-name-input:focus {
    border-color: #3b82f6;
}

.delete-btn {
    width: 28px !important;
    height: 28px !important;
    padding: 0 !important;
}

.empty-message {
    text-align: center;
    color: #64748b;
    padding: 12px 0;
    font-size: 12px;
}

.add-category-form {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.add-btn {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
    padding: 4px 12px !important;
    height: 28px !important;
}

.add-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
}

.divider {
    height: 1px;
    background: #f1f5f9;
    margin: 4px 0;
}

.opacity-control {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
}

.opacity-value {
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    width: 36px;
    text-align: right;
}

.opacity-slider {
    flex-grow: 1;
}

/* 開始・終了・カレンダー関連 */
.action-icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 13px;
    color: #64748b;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    width: 24px;
    height: 24px;
}

.action-icon-btn:hover {
    background: #f1f5f9;
    color: #334155;
}

.start-task-btn {
    color: #10b981; /* 緑 */
}
.start-task-btn:hover {
    background: #ecfdf5;
    color: #059669;
}

.complete-task-btn {
    color: #ef4444; /* 赤 */
}
.complete-task-btn:hover {
    background: #fef2f2;
    color: #dc2626;
}

.calendar-set-btn {
    color: #3b82f6; /* 青 */
}
.calendar-set-btn:hover {
    background: #eff6ff;
    color: #2563eb;
}

/* 進行中のタスクスタイル */
.task-card.status-doing {
    border-left: 3px solid #f59e0b; /* オレンジ色の左枠線 */
    background: #fffbeb; /* 薄いオレンジの背景 */
}

.doing-badge-pill {
    font-size: 9px;
    font-weight: 600;
    color: #d97706;
    background: #fef3c7;
    padding: 2px 5px;
    border-radius: 9999px;
    white-space: nowrap;
    border: 1px solid #fde68a;
}

/* 予定日時行 */
.task-schedule-row {
    padding: 2px 12px 6px 36px;
    display: flex;
    align-items: center;
    font-size: 11px;
}

.scheduled-display {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #3b82f6;
    background: #eff6ff;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    border: 1px dashed #bfdbfe;
}

.scheduled-display:hover {
    background: #dbeafe;
}

.icon-cal {
    font-size: 10px;
}

.date-clear-btn {
    width: 14px !important;
    height: 14px !important;
    padding: 0 !important;
    font-size: 8px !important;
}

.scheduled-picker-wrapper {
    width: 100%;
}

.datetime-picker-input {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: inherit;
    color: #334155;
    background: #ffffff;
    width: 170px;
    height: 24px;
}

.datetime-picker-input:focus {
    border-color: #3b82f6;
    outline: none;
}
</style>
