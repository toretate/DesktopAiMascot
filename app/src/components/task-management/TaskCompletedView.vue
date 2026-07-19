<script setup lang="ts">
import { useTaskStore, type Task } from '../../store/task';
import TaskActionButtons from './TaskActionButtons.vue';
import { formatTaskTime } from './taskDisplayUtils';

defineProps<{ showDeleteMode: boolean }>();
const emit = defineEmits<{
    cycleStatus: [task: Task];
    editTask: [task: Task];
}>();
const taskStore = useTaskStore();
const getCategoryName = (categoryId: string) => taskStore.categories.find(category => category.id === categoryId)?.name ?? '未分類';
</script>

<template>
    <div class="completed-view">
        <div v-for="group in taskStore.completedTasksByDate" :key="group.key" class="completed-date-block">
            <div class="completed-date-header">
                <span class="completed-date-label">{{ group.label }}</span>
                <span class="completed-date-count">{{ group.tasks.length }} 件</span>
            </div>
            <div class="completed-date-items">
                <div v-for="task in group.tasks" :key="task.id" class="completed-item">
                    <button class="status-badge done" title="クリックで未完了に戻す" @click.stop="emit('cycleStatus', task)">DONE</button>
                    <div class="completed-main">
                        <span class="completed-title">{{ task.title }}</span>
                        <div class="completed-meta">
                            <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                            <span v-if="task.endedAt" class="completed-date">{{ formatTaskTime(task.endedAt) }}</span>
                        </div>
                    </div>
                    <TaskActionButtons
                        :task="task"
                        :show-delete-mode="showDeleteMode"
                        @edit="emit('editTask', $event)"
                        @delete="taskStore.deleteTask($event.id)"
                    />
                </div>
            </div>
        </div>
        <div v-if="taskStore.completedTasks.length === 0" class="empty-state">完了したタスクはまだありません。</div>
    </div>
</template>

<style scoped>
.completed-view { display: flex; flex-direction: column; gap: 5px; }
.completed-date-block { margin-bottom: 12px; }
.completed-date-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #f1f5f9; border-radius: 4px; margin-bottom: 6px; }
.completed-date-label { font-size: 11px; font-weight: 600; color: #475569; }
.completed-date-count { font-size: 10px; color: #64748b; background: #e2e8f0; padding: 1px 6px; border-radius: 10px; font-weight: 500; }
.completed-item { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; }
.completed-main { display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0; }
.completed-title { font-size: 12px; font-weight: 500; color: #94a3b8; text-decoration: line-through; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.completed-meta { display: flex; align-items: center; gap: 6px; }
.completed-date { font-size: 10px; color: #94a3b8; font-weight: 500; }
.timeline-cat-badge { font-size: 9px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 1px 4px; border-radius: 3px; }
.status-badge { border: none; border-radius: 3px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; padding: 0 5px; flex-shrink: 0; font-size: 9px; font-weight: 700; }
.status-badge.done { color: #059669; background: #d1fae5; }
.empty-state { text-align: center; color: #64748b; padding: 24px 0; font-size: 12px; }
</style>
