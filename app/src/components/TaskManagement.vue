<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import { useConfigStore } from '../store/config';
import { useTaskStore } from '../store/task';
import TaskEditorPanel from './task-management/TaskEditorPanel.vue';
import TaskCompletedView from './task-management/TaskCompletedView.vue';
import TaskSchedulePanel from './task-management/TaskSchedulePanel.vue';
import TaskSettingsPanel from './task-management/TaskSettingsPanel.vue';
import TaskTimelineView from './task-management/TaskTimelineView.vue';
import TaskTodoView from './task-management/TaskTodoView.vue';
import { useTaskCompletionGrace } from './task-management/composables/useTaskCompletionGrace';
import { useTaskEditor } from './task-management/composables/useTaskEditor';
import { useTaskWidgetWindow } from './task-management/composables/useTaskWidgetWindow';
import WidgetFrame from './common/WidgetFrame.vue';

const taskStore = useTaskStore();
const configStore = useConfigStore();
const { windowMode } = storeToRefs(configStore);

const showCategorySettings = ref(false);
const newTaskTitle = ref('');
const newTaskScheduledAt = ref<string>();
const newTaskScheduledEndAt = ref<string>();
const showDeleteMode = ref(false);

const {
    widgetStyle,
    startWidgetDrag,
    initResize,
    closeWidget
} = useTaskWidgetWindow(taskStore, configStore, windowMode);

const {
    pendingComplete,
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

const schedulePanelRef = ref<InstanceType<typeof TaskSchedulePanel> | null>(null);
const openDatePicker = (taskId: string | 'new_task') => {
    schedulePanelRef.value?.openDatePicker(taskId);
};

onMounted(() => {
    taskStore.loadFromLocalStorage();
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

</script>

<template>
    <WidgetFrame class="task-widget-container shadow-sm" :style="widgetStyle" :show-handles="true" @init-resize="initResize">
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
            <TaskTodoView
                v-show="taskStore.currentView === 'todo'"
                :pending-complete="pendingComplete"
                :show-delete-mode="showDeleteMode"
                @cycle-status="cycleTaskStatus"
                @edit-task="openTaskEditor"
                @open-date-picker="openDatePicker"
            />

            <TaskTimelineView
                v-show="taskStore.currentView === 'timeline'"
                :pending-complete="pendingComplete"
                :show-delete-mode="showDeleteMode"
                @cycle-status="cycleTaskStatus"
                @edit-task="openTaskEditor"
            />

            <TaskCompletedView
                v-show="taskStore.currentView === 'completed'"
                :show-delete-mode="showDeleteMode"
                @cycle-status="cycleTaskStatus"
                @edit-task="openTaskEditor"
            />
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

        <TaskSchedulePanel
            ref="schedulePanelRef"
            v-model:new-task-scheduled-at="newTaskScheduledAt"
            v-model:new-task-scheduled-end-at="newTaskScheduledEndAt"
            :new-task-title="newTaskTitle"
            :edit-form="editForm"
        />

        <TaskEditorPanel
            v-if="editingFullTaskId"
            :edit-form="editForm"
            :time-valid="isTaskEditorTimeValid"
            @close="closeTaskEditor"
            @save="saveTaskEditor"
            @open-date-picker="openDatePicker"
            @set-end-mode="setEditEndMode"
        />
    </WidgetFrame>
</template>

<style scoped src="./task-management/TaskManagement.css"></style>
