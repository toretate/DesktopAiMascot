<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import { useConfigStore } from '../store/config';
import { useTaskStore, type SubTask, type Task } from '../store/task';
import CircularClockPicker from './task-management/CircularClockPicker.vue';
import DayTimelinePicker from './task-management/DayTimelinePicker.vue';
import TaskEditorPanel from './task-management/TaskEditorPanel.vue';
import TaskSettingsPanel from './task-management/TaskSettingsPanel.vue';
import { useTaskCompletionGrace } from './task-management/composables/useTaskCompletionGrace';
import { useTaskEditor } from './task-management/composables/useTaskEditor';
import { useTaskInlineEdit } from './task-management/composables/useTaskInlineEdit';
import { useTaskScheduleEditor } from './task-management/composables/useTaskScheduleEditor';
import { useTaskTreeDrag } from './task-management/composables/useTaskTreeDrag';
import { useTaskWidgetWindow } from './task-management/composables/useTaskWidgetWindow';
import {
    formatScheduledDate,
    formatTaskTime,
    getScheduledDisplay,
    isTaskOverdue
} from './task-management/taskDisplayUtils';

const taskStore = useTaskStore();
const configStore = useConfigStore();
const { windowMode } = storeToRefs(configStore);

// 自動フォーカス用ディレクティブ
const vFocus = {
    mounted: (element: HTMLElement) => element.focus()
};

const showCategorySettings = ref(false);
const newTaskTitle = ref('');
const newTaskScheduledAt = ref<string>();
const newTaskScheduledEndAt = ref<string>();
const newSubTaskTitleMap = ref<Record<string, string>>({});
const showDeleteMode = ref(false);

const {
    widgetStyle,
    startWidgetDrag,
    initResize,
    closeWidget
} = useTaskWidgetWindow(taskStore, configStore, windowMode);

const {
    localTasks,
    isNesting,
    parentRef,
    activeDropTargetTaskId,
    canNest,
    onParentDragOver,
    onSortDragStart,
    onParentDrop,
    onSubTaskDragStart,
    onSubTaskDragEnd,
    onContainerDrop
} = useTaskTreeDrag(taskStore);

const {
    editingTaskId,
    editingSubTaskId,
    editingTitle,
    handlePressStart,
    handlePressEnd,
    startEditTask,
    startEditSubTask,
    saveTitleEdit,
    cancelTitleEdit
} = useTaskInlineEdit(taskStore);

const {
    pendingComplete,
    isPendingComplete,
    cycleTaskStatus
} = useTaskCompletionGrace(taskStore);

const {
    editingFullTaskId,
    editForm,
    openTaskEditor,
    setEditEndMode,
    isTaskEditorTimeValid,
    closeTaskEditor,
    saveTaskEditor
} = useTaskEditor(taskStore);

const {
    activeCalendarTaskId,
    tempCalendarDate,
    calendarStep,
    selectedHour24,
    selectedMinuteVal,
    timelineStartMinute,
    timelineEndMinute,
    meetingDateChoice,
    showMeetingCustomCalendar,
    isSingleTimePicker,
    isMeetingSchedulePicker,
    openDatePicker,
    onDateSelect,
    selectMeetingDate,
    getActiveCalendarTaskTitle,
    getCalendarPanelTitle,
    saveFullscreenCalendarDate,
    clearFullscreenCalendarDate
} = useTaskScheduleEditor(taskStore, {
    newTaskTitle,
    newTaskScheduledAt,
    newTaskScheduledEndAt,
    editForm
});

const nowTimestamp = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
    taskStore.loadFromLocalStorage();
    nowTimer = setInterval(() => {
        nowTimestamp.value = Date.now();
    }, 30_000);
});

onUnmounted(() => {
    if (nowTimer) clearInterval(nowTimer);
});

const viewOptions = [
    { label: 'TODO', value: 'todo' },
    { label: 'TIMELINE', value: 'timeline' },
    { label: 'COMP', value: 'completed' }
];

const handleAddTask = () => {
    const title = newTaskTitle.value.trim();
    if (!title) return;
    taskStore.addTask(
        taskStore.activeCategoryId,
        title,
        'normal',
        newTaskScheduledAt.value,
        newTaskScheduledEndAt.value
    );
    newTaskTitle.value = '';
    newTaskScheduledAt.value = undefined;
    newTaskScheduledEndAt.value = undefined;
};

const handleAddSubTask = (taskId: string) => {
    const title = (newSubTaskTitleMap.value[taskId] || '').trim();
    if (!title) return;
    taskStore.addSubTask(taskId, title);
    newSubTaskTitleMap.value[taskId] = '';
};

const cyclePriority = (task: Task) => {
    const priorities: Task['priority'][] = ['normal', 'star', 'thunder'];
    const currentIndex = priorities.indexOf(task.priority);
    taskStore.updateTask(task.id, {
        priority: priorities[(currentIndex + 1) % priorities.length]
    });
};

const cycleSubTaskStatus = (task: Task, step: SubTask) => {
    const statuses: SubTask['status'][] = ['todo', 'doing', 'done'];
    const currentIndex = statuses.indexOf(step.status);
    taskStore.updateSubTaskStatus(
        task.id,
        step.id,
        statuses[(currentIndex + 1) % statuses.length]
    );
};

const isOverdue = (task: Task) => isTaskOverdue(task, nowTimestamp.value);
const formatTime = formatTaskTime;

const getCategoryName = (categoryId: string) => {
    return taskStore.categories.find(category => category.id === categoryId)?.name ?? '未分類';
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

        <!-- 2. カスタムタブ列 ＋ ウィジェット操作ボタン -->
        <div class="tab-navigation-bar" v-if="!showCategorySettings">
            <div v-if="taskStore.currentView === 'todo'" class="category-tabs">
                <button
                    class="tab-btn"
                    :class="{ active: taskStore.activeCategoryId === 'all' }"
                    @click="taskStore.activeCategoryId = 'all'"
                >
                    ALL
                </button>
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
            <div class="tab-actions">
                <Button
                    icon="pi pi-trash"
                    class="p-button-text tab-trash-btn"
                    :class="{ 'delete-mode-active': showDeleteMode }"
                    @click="showDeleteMode = !showDeleteMode"
                    :title="showDeleteMode ? '削除モードをオフにする' : '削除モードをオンにする'"
                />
                <Button
                    icon="pi pi-cog"
                    class="p-button-text p-button-secondary tab-settings-btn"
                    @click="showCategorySettings = true"
                    title="TODO Widgetの設定を開く"
                />
            </div>
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
                    :class="{ 'status-doing': task.status === 'doing', 'status-done': task.completed, 'drop-target-active': activeDropTargetTaskId === task.id && isNesting, 'overdue': isOverdue(task) }"
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
                                :class="isPendingComplete(task) ? 'pending-done' : (task.completed || task.status === 'done' ? 'done' : (task.status === 'doing' ? 'doing' : (task.status === 'paused' ? 'doing' : 'todo')))"
                                @click.stop="cycleTaskStatus(task)"
                                :title="isPendingComplete(task) ? 'クリックでTODOに戻す' : ('ステータスをサイクル: ' + (task.status || 'todo'))"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; line-height: 16px; padding: 0 5px;">
                            <span v-if="isPendingComplete(task)">取消 {{ pendingComplete[task.id] }}</span>
                            <span v-else-if="task.completed || task.status === 'done'">DONE</span>
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
                                <span v-if="task.scheduledAt" :style="{ fontSize: '11px', fontWeight: '600', color: isOverdue(task) ? '#dc2626' : '#3b82f6', whiteSpace: 'nowrap' }">
                                    {{ getScheduledDisplay(task.scheduledAt) }}
                                </span>
                                <i v-else class="pi pi-calendar"></i>
                            </button>
                        </div>

                        <!-- サブタスク完了カウント -->
                        <div 
                            class="steps-badge"
                            v-if="task.steps.length > 0"
                        >
                            {{ task.steps.filter(s => s.completed).length }}/{{ task.steps.length }}
                        </div>

                        <!-- 編集ボタン -->
                        <Button
                            icon="pi pi-pencil"
                            class="p-button-text p-button-secondary p-button-sm task-edit-btn"
                            @click.stop="openTaskEditor(task)"
                            title="タスクを編集"
                        />

                        <!-- 削除ボタン (削除モード時のみ) -->
                        <Button
                            v-if="showDeleteMode"
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
                                    v-if="showDeleteMode"
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

            <!-- (B) TIMELINEビュー (予定時刻軸・下詰め: 下ほど現在に近い/期限切れ) -->
            <div class="timeline-view" v-show="taskStore.currentView === 'timeline'">
                <div
                    v-for="task in taskStore.timelineTasks"
                    :key="task.id"
                    class="timeline-item"
                >
                    <div class="timeline-marker">
                        <i :class="task.completed ? 'pi pi-check-circle checked' : (isOverdue(task) ? 'pi pi-exclamation-circle overdue-icon' : 'pi pi-circle-off unchecked')"></i>
                        <div class="timeline-line"></div>
                    </div>

                    <!-- 〇とタスクの間に予定(limit)時間を表示 -->
                    <div class="timeline-limit" :class="{ overdue: isOverdue(task) }">
                        <span v-if="task.scheduledAt">{{ getScheduledDisplay(task.scheduledAt) }}</span>
                        <span v-else class="unscheduled">—</span>
                    </div>

                    <div class="timeline-content-card" :class="{ completed: task.completed, overdue: isOverdue(task) }">
                        <div class="timeline-row-main">
                            <!-- ステータス変更コントロール (TODOビューと同様のサイクルボタン) -->
                            <button
                                class="status-badge"
                                :class="isPendingComplete(task) ? 'pending-done' : (task.completed || task.status === 'done' ? 'done' : (task.status === 'doing' ? 'doing' : (task.status === 'paused' ? 'doing' : 'todo')))"
                                @click.stop="cycleTaskStatus(task)"
                                :title="isPendingComplete(task) ? 'クリックでTODOに戻す' : ('ステータスをサイクル: ' + (task.status || 'todo'))"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; line-height: 16px; padding: 0 5px; flex-shrink: 0;"
                            >
                                <span v-if="isPendingComplete(task)">取消 {{ pendingComplete[task.id] }}</span>
                                <span v-else-if="task.completed || task.status === 'done'">DONE</span>
                                <span v-else-if="task.status === 'doing'">DOING</span>
                                <span v-else-if="task.status === 'paused'">PAUSED</span>
                                <span v-else>TODO</span>
                            </button>
                            <h4 class="timeline-task-title" :class="{ completed: task.completed }">
                                {{ task.title }}
                            </h4>
                            <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                            <Button
                                icon="pi pi-pencil"
                                class="p-button-text p-button-secondary p-button-sm task-edit-btn"
                                @click.stop="openTaskEditor(task)"
                                title="タスクを編集"
                            />
                            <Button
                                v-if="showDeleteMode"
                                icon="pi pi-trash"
                                class="p-button-text p-button-danger p-button-sm task-delete-btn"
                                @click.stop="taskStore.deleteTask(task.id)"
                                title="タスクを削除"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="taskStore.tasks.length === 0" class="empty-state">
                    タスクがありません。
                </div>
            </div>

            <!-- (B') COMPビュー (完了済みタスクを完了日ごとにブロック表示・全カテゴリ横断) -->
            <div class="completed-view" v-show="taskStore.currentView === 'completed'">
                <div
                    v-for="group in taskStore.completedTasksByDate"
                    :key="group.key"
                    class="completed-date-block"
                >
                    <div class="completed-date-header">
                        <span class="completed-date-label">{{ group.label }}</span>
                        <span class="completed-date-count">{{ group.tasks.length }} 件</span>
                    </div>
                    <div class="completed-date-items">
                        <div
                            v-for="task in group.tasks"
                            :key="task.id"
                            class="completed-item"
                        >
                            <!-- ステータス変更コントロール (クリックで未完了に戻す) -->
                            <button
                                class="status-badge done"
                                @click.stop="cycleTaskStatus(task)"
                                title="クリックで未完了に戻す"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; line-height: 16px; padding: 0 5px; flex-shrink: 0;"
                            >
                                DONE
                            </button>
                            <div class="completed-main">
                                <span class="completed-title">{{ task.title }}</span>
                                <div class="completed-meta">
                                    <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                                    <span v-if="task.endedAt" class="completed-date">{{ formatTime(task.endedAt) }}</span>
                                </div>
                            </div>
                            <Button
                                icon="pi pi-pencil"
                                class="p-button-text p-button-secondary p-button-sm task-edit-btn"
                                @click.stop="openTaskEditor(task)"
                                title="タスクを編集"
                            />
                            <Button
                                v-if="showDeleteMode"
                                icon="pi pi-trash"
                                class="p-button-text p-button-danger p-button-sm task-delete-btn"
                                @click.stop="taskStore.deleteTask(task.id)"
                                title="タスクを削除"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="taskStore.completedTasks.length === 0" class="empty-state">
                    完了したタスクはまだありません。
                </div>
            </div>
            </div>

            <TaskSettingsPanel
                v-show="showCategorySettings"
                @close="showCategorySettings = false"
            />
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
            <div class="add-task-input-wrapper" style="position: relative; display: flex; align-items: center; flex-grow: 1; min-width: 0;">
                <InputText 
                    v-model="newTaskTitle" 
                    placeholder="新しいタスクを追加..." 
                    class="p-inputtext-sm w-full task-input-field"
                    @keyup.enter="handleAddTask"
                    style="padding-right: 32px;"
                />
                <button 
                    class="action-icon-btn calendar-set-btn" 
                    @click.stop="openDatePicker('new_task')"
                    :title="newTaskScheduledAt ? '予定日時を変更' : '予定日時を設定'"
                    style="position: absolute; right: 6px; padding: 4px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer;"
                    type="button"
                >
                    <i class="pi pi-calendar" :style="{ color: newTaskScheduledAt ? '#3b82f6' : '#94a3b8' }"></i>
                </button>
            </div>
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
                <span class="panel-title">{{ getCalendarPanelTitle() }}</span>
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
                
                <!-- STEP 1: 日付選択 -->
                <div v-if="calendarStep === 'date'" class="datepicker-container">
                    <div v-if="isMeetingSchedulePicker && !showMeetingCustomCalendar" class="meeting-date-options">
                        <button
                            type="button"
                            class="meeting-date-option"
                            :class="{ active: meetingDateChoice === 'today' }"
                            @click="selectMeetingDate('today')"
                        >
                            <i class="pi pi-calendar-clock"></i>
                            <span>今日</span>
                        </button>
                        <button
                            type="button"
                            class="meeting-date-option"
                            :class="{ active: meetingDateChoice === 'tomorrow' }"
                            @click="selectMeetingDate('tomorrow')"
                        >
                            <i class="pi pi-calendar-plus"></i>
                            <span>明日</span>
                        </button>
                        <button
                            type="button"
                            class="meeting-date-option"
                            :class="{ active: meetingDateChoice === 'custom' }"
                            @click="selectMeetingDate('custom')"
                        >
                            <i class="pi pi-calendar"></i>
                            <span>日付指定</span>
                        </button>
                    </div>
                    <div v-else-if="isMeetingSchedulePicker" class="meeting-custom-date">
                        <button
                            type="button"
                            class="back-to-date-btn"
                            @click="showMeetingCustomCalendar = false"
                        >
                            <i class="pi pi-angle-left"></i> 選択肢へ戻る
                        </button>
                        <DatePicker
                            v-model="tempCalendarDate"
                            inline
                            style="width: 100%; border: none;"
                            @date-select="onDateSelect"
                        />
                    </div>
                    <DatePicker
                        v-else
                        v-model="tempCalendarDate"
                        inline
                        style="width: 100%; border: none;"
                        @date-select="onDateSelect"
                    />
                </div>
                
                <!-- STEP 2: 時刻・時間帯選択 -->
                <div v-else class="clockpicker-container">
                    <CircularClockPicker
                        v-if="isSingleTimePicker"
                        v-model:hour="selectedHour24"
                        v-model:minute="selectedMinuteVal"
                    >
                        <template #header-leading>
                            <button
                                class="back-to-date-btn"
                                title="日付選択に戻る"
                                type="button"
                                @click="calendarStep = 'date'"
                            >
                                <i class="pi pi-angle-left"></i> 日付
                            </button>
                        </template>
                    </CircularClockPicker>
                    <DayTimelinePicker
                        v-else
                        v-model:start-minute="timelineStartMinute"
                        v-model:end-minute="timelineEndMinute"
                        :default-duration-minutes="taskStore.defaultDurationHours * 60"
                    >
                        <template #header-leading>
                            <button
                                class="back-to-date-btn"
                                title="日付選択に戻る"
                                type="button"
                                @click="calendarStep = 'date'"
                            >
                                <i class="pi pi-angle-left"></i> 日付
                            </button>
                        </template>
                    </DayTimelinePicker>
                </div>
            </div>
            <div class="calendar-panel-footer">
                <Button 
                    label="クリア" 
                    class="p-button-outlined p-button-danger p-button-sm mr-auto" 
                    @click="clearFullscreenCalendarDate" 
                />
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

        <TaskEditorPanel
            v-if="editingFullTaskId"
            :edit-form="editForm"
            :time-valid="isTaskEditorTimeValid"
            @close="closeTaskEditor"
            @save="saveTaskEditor"
            @open-date-picker="openDatePicker"
            @set-end-mode="setEditEndMode"
        />

        <!-- リサイズ用ハンドル -->
        <div class="resize-handle right" @mousedown="initResize($event, 'right')"></div>
        <div class="resize-handle bottom" @mousedown="initResize($event, 'bottom')"></div>
        <div class="resize-handle corner" @mousedown="initResize($event, 'corner')"></div>
    </div>
</template>

<style scoped src="./task-management/TaskManagement.css"></style>
