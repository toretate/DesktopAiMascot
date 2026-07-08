<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useDraggable } from 'vue-draggable-plus';
import { useTaskStore, Task, SubTask } from '../store/task';
import { useConfigStore } from '../store/config';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import Slider from 'primevue/slider';
import DatePicker from 'primevue/datepicker';

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

// vue-draggable-plus用
const localTasks = ref<Task[]>([...taskStore.filteredTasks]);
const draggedNestTaskId = ref<string | null>(null);
const draggedSubTask = ref<{ parentId: string; subTaskId: string } | null>(null);
const dragStartX = ref<number>(0);
const isNesting = ref(false);
const parentRef = ref<HTMLElement | null>(null);

watch(() => taskStore.filteredTasks, (newTasks) => {
    if (!draggedNestTaskId.value && !draggedSubTask.value) {
        localTasks.value = [...newTasks];
    }
}, { deep: true });

const activeDropTargetTaskId = ref<string | null>(null);

const canNest = (targetTask: Task) => {
    if (!draggedNestTaskId.value) return false;
    if (targetTask.id === draggedNestTaskId.value) return false;
    const sourceTask = localTasks.value.find(t => t.id === draggedNestTaskId.value);
    if (!sourceTask) return false;
    if (sourceTask.steps && sourceTask.steps.length > 0) return false;
    return true;
};

const onParentDragOver = (event: DragEvent, taskId: string) => {
    if (draggedNestTaskId.value && isNesting.value) {
        const targetTask = localTasks.value.find(t => t.id === taskId);
        if (targetTask && canNest(targetTask)) {
            activeDropTargetTaskId.value = taskId;
        }
    }
};



useDraggable(parentRef, localTasks, {
    animation: 150,
    handle: '.drag-handle',
    onStart(evt) {
        if (evt.originalEvent) {
            dragStartX.value = evt.originalEvent.clientX;
        }
        draggedNestTaskId.value = localTasks.value[evt.oldIndex!].id;
    },
    onMove(evt, originalEvent) {
        if (originalEvent) {
            const deltaX = originalEvent.clientX - dragStartX.value;
            const threshold = 24; // 2文字分 (24px)
            if (deltaX >= threshold) {
                isNesting.value = true;
                return false; // 並び替えをキャンセル
            }
        }
        isNesting.value = false;
        activeDropTargetTaskId.value = null;
    },
    onEnd(evt) {
        // 並び替え完了時の同期
        taskStore.updateTasksOrder(localTasks.value);

        // ネスト化の処理
        if (isNesting.value && draggedNestTaskId.value && activeDropTargetTaskId.value) {
            taskStore.convertToSubTask(draggedNestTaskId.value, activeDropTargetTaskId.value);
        }

        // 状態クリア
        draggedNestTaskId.value = null;
        dragStartX.value = 0;
        isNesting.value = false;
        activeDropTargetTaskId.value = null;
    }
});

// インプレース編集用ステート
const editingTaskId = ref<string | null>(null);
const editingSubTaskId = ref<string | null>(null);
const activeCalendarTaskId = ref<string | null>(null);

// カレンダー・クロックピッカー用ステート
const calendarYear = ref(new Date().getFullYear());
const calendarMonth = ref(new Date().getMonth());
const selectedDate = ref<number | null>(null);
const timeStep = ref<'date' | 'hour' | 'minute'>('date');
const selectedHour = ref<number>(12);
const selectedMinute = ref<number>(0);

const daysInMonth = computed(() => {
    const year = calendarYear.value;
    const month = calendarMonth.value;
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
        days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
        days.push(d);
    }
    return days;
});

const prevMonth = () => {
    if (calendarMonth.value === 0) {
        calendarMonth.value = 11;
        calendarYear.value -= 1;
    } else {
        calendarMonth.value -= 1;
    }
};

const nextMonth = () => {
    if (calendarMonth.value === 11) {
        calendarMonth.value = 0;
        calendarYear.value += 1;
    } else {
        calendarMonth.value += 1;
    }
};

const openCalendarPanel = (task: Task) => {
    activeCalendarTaskId.value = task.id;
    timeStep.value = 'date';
    const initialDate = task.scheduledAt ? new Date(task.scheduledAt) : new Date();
    calendarYear.value = initialDate.getFullYear();
    calendarMonth.value = initialDate.getMonth();
    selectedDate.value = initialDate.getDate();
    selectedHour.value = initialDate.getHours();
    selectedMinute.value = Math.round(initialDate.getMinutes() / 5) * 5 % 60;
};

const selectDate = (day: number) => {
    selectedDate.value = day;
    timeStep.value = 'hour';
};

const selectHour = (hour: number) => {
    selectedHour.value = hour;
    timeStep.value = 'minute';
};

const selectMinute = (minute: number) => {
    selectedMinute.value = minute;
    saveScheduledDateTime();
};

const saveScheduledDateTime = () => {
    if (activeCalendarTaskId.value && selectedDate.value !== null) {
        const date = new Date(
            calendarYear.value,
            calendarMonth.value,
            selectedDate.value,
            selectedHour.value,
            selectedMinute.value
        );
        taskStore.updateTask(activeCalendarTaskId.value, { scheduledAt: date.toISOString() });
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
    taskStore.showTaskWidget = false;
    if (windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
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
    
    // ウィジェット位置の保存
    localStorage.setItem('task_widget_pos_x', posX.value.toString());
    localStorage.setItem('task_widget_pos_y', posY.value.toString());
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
    
    // ウィジェット位置の復元
    const savedX = localStorage.getItem('task_widget_pos_x');
    const savedY = localStorage.getItem('task_widget_pos_y');
    if (savedX !== null) posX.value = parseInt(savedX, 10);
    if (savedY !== null) posY.value = parseInt(savedY, 10);
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
const onSortDragStart = (event: DragEvent, taskId: string) => {
    dragStartX.value = event.clientX;
    draggedNestTaskId.value = taskId;
};

const onParentDrop = (event: DragEvent, targetTaskId: string) => {
    // 1. サブタスク（子タスク）のドラッグの場合 (昇格)
    if (draggedSubTask.value) {
        const sub = draggedSubTask.value;
        draggedSubTask.value = null; // watchがブロックされるのを防ぐため先にクリア
        taskStore.promoteSubTaskToParent(sub.parentId, sub.subTaskId);
        localTasks.value = [...taskStore.filteredTasks]; // 強制同期
    }
};

const onSubTaskDragStart = (parentId: string, subTaskId: string) => {
    draggedSubTask.value = { parentId, subTaskId };
};

const onSubTaskDragEnd = () => {
    draggedSubTask.value = null;
};

const onContainerDrop = (event: DragEvent) => {
    if (draggedSubTask.value) {
        const sub = draggedSubTask.value;
        draggedSubTask.value = null; // watchがブロックされるのを防ぐため先にクリア
        taskStore.promoteSubTaskToParent(sub.parentId, sub.subTaskId);
        localTasks.value = [...taskStore.filteredTasks]; // 強制同期
    }
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

const getScheduledDisplay = (scheduledAtIso: string) => {
    if (!scheduledAtIso) return '';
    const now = new Date();
    const scheduled = new Date(scheduledAtIso);
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    // 過去の予定の場合のフォールバック
    if (diffMs < 0) {
        const isSameYear = now.getFullYear() === scheduled.getFullYear();
        const isSameMonth = isSameYear && now.getMonth() === scheduled.getMonth();
        if (isSameMonth) {
            return `${scheduled.getDate()}日`;
        } else if (isSameYear) {
            return `${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
        } else {
            const yy = String(scheduled.getFullYear()).slice(-2);
            return `${yy}/${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
        }
    }

    // 1. 60分以内
    if (diffMin <= 60) {
        return `後${diffMin}分[${scheduled.getMinutes()}分]`;
    }

    // 2. 24時間以内
    if (diffHour <= 24) {
        return `後${diffHour}時[${scheduled.getHours()}時]`;
    }

    // 3. 6日以内
    if (diffDay <= 6) {
        if (diffDay === 1 || (scheduled.getDate() - now.getDate() === 1 && diffDay <= 1.5)) {
            return '明日';
        }
        return `後${diffDay}日[${scheduled.getDate()}日]`;
    }

    // 4. 同月の場合
    const isSameYear = now.getFullYear() === scheduled.getFullYear();
    const isSameMonth = isSameYear && now.getMonth() === scheduled.getMonth();
    if (isSameMonth) {
        return `${scheduled.getDate()}日`;
    }

    // 5. 別月の場合
    if (isSameYear) {
        return `${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
    }

    // 6. 別年の場合
    const yy = String(scheduled.getFullYear()).slice(-2);
    return `${yy}/${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
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

const cycleTaskStatus = (task: Task) => {
    console.log('cycleTaskStatus clicked. task:', { id: task.id, title: task.title, completed: task.completed, status: task.status });
    if (task.completed || task.status === 'done') {
        taskStore.resetTask(task.id);
    } else if (task.status === 'todo' || !task.status) {
        taskStore.startTask(task.id);
    } else if (task.status === 'doing' || task.status === 'paused') {
        taskStore.completeTask(task.id);
    }
};

const tempCalendarDate = ref<Date | null>(null);

const openDatePicker = (taskId: string) => {
    activeCalendarTaskId.value = taskId;
    const task = taskStore.tasks.find(t => t.id === taskId);
    if (task && task.scheduledAt) {
        tempCalendarDate.value = new Date(task.scheduledAt);
    } else {
        tempCalendarDate.value = new Date();
    }
};

const getActiveCalendarTaskTitle = () => {
    if (!activeCalendarTaskId.value) return '';
    const task = taskStore.tasks.find(t => t.id === activeCalendarTaskId.value);
    return task ? task.title : '';
};

const saveFullscreenCalendarDate = () => {
    if (activeCalendarTaskId.value) {
        if (tempCalendarDate.value) {
            taskStore.updateTask(activeCalendarTaskId.value, { scheduledAt: tempCalendarDate.value.toISOString() });
        } else {
            taskStore.updateTask(activeCalendarTaskId.value, { scheduledAt: undefined });
        }
    }
    activeCalendarTaskId.value = null;
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
            <div v-show="!showCategorySettings" style="height: 100%; display: flex; flex-direction: column;">
            <!-- (A) TODOビュー (タスクツリー) -->
            <div class="todo-view" v-show="taskStore.currentView === 'todo'" ref="parentRef" @dragover.prevent @drop="onContainerDrop">
                <div 
                    v-for="task in localTasks" 
                    :key="task.id"
                    class="task-card"
                    :class="{ 'status-doing': task.status === 'doing', 'status-done': task.completed, 'drop-target-active': activeDropTargetTaskId === task.id && isNesting }"
                    @dragover.prevent="onParentDragOver($event, task.id)"
                    @drop="onParentDrop($event, task.id)"
                >
                    <!-- ネスト化「子に追加」オーバーレイ -->
                    <div v-if="activeDropTargetTaskId === task.id && isNesting && canNest(task)" class="nest-overlay">
                        <span class="nest-overlay-text">子に追加</span>
                    </div>

                    <!-- 親タスク行 -->
                    <div class="parent-task-row">
                        <!-- ドラッグハンドル -->
                        <div class="drag-handle" title="ドラッグして並べ替え / 右にずらしてネスト" @dragstart="onSortDragStart($event, task.id)">
                            <i class="pi pi-bars"></i>
                        </div>

                        <!-- 状態サイクルボタン -->
                        <button class="status-badge"
                                :class="task.completed || task.status === 'done' ? 'done' : (task.status === 'doing' ? 'doing' : (task.status === 'paused' ? 'doing' : 'todo'))"
                                @click.stop="cycleTaskStatus(task)"
                                :title="'ステータスをサイクル: ' + (task.status || 'todo')"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 18px; line-height: 18px; padding: 0 6px;">
                            <span v-if="task.completed || task.status === 'done'">DONE</span>
                            <span v-else-if="task.status === 'doing'">DOING</span>
                            <span v-else-if="task.status === 'paused'">PAUSED</span>
                            <span v-else>TODO</span>
                        </button>

                        <!-- タイトル -->
                        <div class="task-title-container flex-grow-1" style="display: flex; align-items: center; overflow: hidden; min-width: 0; gap: 6px;">
                            <span 
                                v-if="editingTaskId !== task.id || editingSubTaskId !== null"
                                class="task-title" 
                                :class="{ completed: task.completed }"
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

                        <!-- 一時中断 / 再生 ボタン -->
                        <div class="pause-resume-buttons" style="display: flex; align-items: center; justify-content: center; width: 28px;">
                            <button v-if="task.status === 'doing'"
                                    class="action-icon-btn pause-task-btn"
                                    @click.stop="taskStore.pauseTask(task.id)"
                                    title="一時中断"
                                    style="font-size: 14px; padding: 0;">
                                <span>⏸️</span>
                            </button>
                            <button v-else-if="task.status === 'paused'"
                                    class="action-icon-btn resume-task-btn"
                                    @click.stop="taskStore.resumeTask(task.id)"
                                    title="タスクを再開"
                                    style="font-size: 14px; padding: 0;">
                                <span>▶️</span>
                            </button>
                        </div>

                        <!-- カレンダー設定ボタン / 予定日時表示 -->
                        <div style="display: flex; align-items: center; gap: 2px;">
                            <button 
                                class="action-icon-btn calendar-set-btn" 
                                @click.stop="openDatePicker(task.id)"
                                :title="task.scheduledAt ? '予定日時を変更' : '予定日時を設定'"
                                style="width: auto; padding: 0 4px;"
                            >
                                <span v-if="task.scheduledAt" style="font-size: 11px; font-weight: 600; color: #3b82f6; white-space: nowrap;">
                                    {{ getScheduledDisplay(task.scheduledAt) }}
                                </span>
                                <i v-else class="pi pi-calendar"></i>
                            </button>
                            <Button 
                                v-if="task.scheduledAt"
                                icon="pi pi-times" 
                                class="p-button-text p-button-danger p-button-xs date-clear-btn" 
                                @click.stop="taskStore.updateTask(task.id, { scheduledAt: undefined })" 
                                title="予定をクリア" 
                                style="width: 14px; height: 14px; padding: 0; font-size: 8px;"
                            />
                        </div>

                        <!-- サブタスク完了カウント -->
                        <div 
                            class="steps-badge"
                            v-if="task.steps.length > 0"
                        >
                            {{ task.steps.filter(s => s.completed).length }}/{{ task.steps.length }}
                        </div>

                        <!-- 削除ボタン -->
                        <Button 
                            icon="pi pi-trash" 
                            class="p-button-text p-button-danger p-button-sm task-delete-btn"
                            @click.stop="taskStore.deleteTask(task.id)"
                            title="タスクを削除"
                        />
                    </div>



                    <!-- サブタスク（Step）展開エリア (子供がいれば常に表示) -->
                    <div class="subtasks-container" v-if="task.steps.length > 0">
                        <div class="subtask-list">
                            <!-- 接続線 -->
                            <div class="guide-line"></div>
                            
                            <!-- サブタスク項目 -->
                            <div 
                                v-for="step in task.steps" 
                                :key="step.id"
                                class="subtask-item"
                                draggable="true"
                                @dragstart="onSubTaskDragStart(task.id, step.id)"
                                @dragend="onSubTaskDragEnd"
                            >
                                <!-- 子タスク用ドラッグハンドル (〇から変更、戻すため) -->
                                <div class="drag-handle subtask-drag-handle" title="ドラッグして親タスクに戻す / 移動" style="cursor: grab; color: #94a3b8; padding: 4px; display: flex; align-items: center;">
                                    <i class="pi pi-bars"></i>
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
            <div class="timeline-view" v-show="taskStore.currentView === 'timeline'">
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
            <div v-show="showCategorySettings" class="inline-settings-panel">
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

                    <div class="divider"></div>

                    <!-- お知らせ設定 -->
                    <div class="settings-section">
                        <span class="section-title">予定のお知らせ</span>
                        <div class="notification-control">
                            <label class="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    v-model="taskStore.enableNotification" 
                                    class="p-checkbox-input"
                                />
                                <span class="label-text">音声でお知らせする</span>
                            </label>
                            <div class="minutes-input-row" v-if="taskStore.enableNotification">
                                <InputText 
                                    v-model.number="taskStore.notificationMinutes" 
                                    type="number" 
                                    min="0"
                                    max="60"
                                    class="p-inputtext-sm minutes-input"
                                />
                                <span class="minutes-text">分前にお知らせ</span>
                            </div>
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

        <!-- 全面カレンダー設定パネル -->
        <div v-if="activeCalendarTaskId" class="fullscreen-calendar-panel">
            <div class="calendar-panel-header">
                <span class="panel-title">予定日時の設定</span>
                <Button 
                    icon="pi pi-times" 
                    class="p-button-text p-button-secondary close-btn" 
                    @click="activeCalendarTaskId = null" 
                />
            </div>
            <div class="calendar-panel-content">
                <div class="task-title-summary">
                    <span class="label">タスク: </span>
                    <span class="task-name">{{ getActiveCalendarTaskTitle() }}</span>
                </div>
                <div class="datepicker-container">
                    <DatePicker 
                        v-model="tempCalendarDate"
                        showTime 
                        hourFormat="24"
                        :stepMinute="30"
                        inline
                        style="width: 100%; border: none;"
                    />
                </div>
            </div>
            <div class="calendar-panel-footer">
                <Button 
                    label="キャンセル" 
                    class="p-button-outlined p-button-secondary p-button-sm" 
                    @click="activeCalendarTaskId = null" 
                />
                <Button 
                    label="決定" 
                    class="p-button-primary p-button-sm" 
                    @click="saveFullscreenCalendarDate" 
                />
            </div>
        </div>

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

.scheduled-picker-wrapper :deep(.p-datepicker) {
    font-size: 11px;
    padding: 4px;
}

.scheduled-picker-wrapper :deep(.p-datepicker-header) {
    padding: 4px;
}

.scheduled-picker-wrapper :deep(.p-datepicker-title) {
    font-size: 11px;
    line-height: 1.2;
}

.scheduled-picker-wrapper :deep(.p-datepicker-calendar-container) {
    padding: 0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-calendar) {
    font-size: 10px;
}

.scheduled-picker-wrapper :deep(.p-datepicker-day) {
    width: 22px;
    height: 22px;
    font-size: 10px;
    padding: 0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-time-picker) {
    padding: 4px 0 0 0;
    gap: 2px;
    border-top: 1px solid #e2e8f0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-time-picker button) {
    width: 14px;
    height: 14px;
    font-size: 8px;
    padding: 0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-time-picker span) {
    font-size: 10px;
    font-weight: 600;
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
/* ネスト「子に追加」オーバーレイ */
.task-card {
    position: relative;
}
.nest-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(59, 130, 246, 0.9); /* PrimeVue ブルー */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 8px;
    animation: fadeInNest 0.15s ease-out;
    pointer-events: none;
}
.nest-overlay-text {
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.05em;
}
/* 全面カレンダー設定パネル */
.fullscreen-calendar-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #ffffff;
    z-index: 150;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.calendar-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #f1f5f9;
}

.calendar-panel-header .panel-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
}

.calendar-panel-header .close-btn {
    width: 24px;
    height: 24px;
    padding: 0;
}

.calendar-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.task-title-summary {
    background: #f8fafc;
    border-left: 3px solid #3b82f6;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.4;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.task-title-summary .label {
    color: #64748b;
    font-weight: 600;
    margin-right: 6px;
}

.task-title-summary .task-name {
    color: #1e293b;
    font-weight: 500;
}

.datepicker-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
}

/* 全面時もコンパクトに収まるようにスタイリング */
.datepicker-container :deep(.p-datepicker) {
    border: none;
    width: 100%;
}

.datepicker-container :deep(.p-datepicker-calendar-container) {
    padding: 0;
}

.datepicker-container :deep(.p-datepicker-time-picker) {
    border-top: 1px solid #f1f5f9;
    padding: 8px 0 0 0;
}

.calendar-panel-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
}

.notification-control {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    user-select: none;
}

.p-checkbox-input {
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.minutes-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 24px;
}

.minutes-input {
    width: 60px !important;
    text-align: center;
    padding: 4px 8px !important;
}

.minutes-text {
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
}
</style>
