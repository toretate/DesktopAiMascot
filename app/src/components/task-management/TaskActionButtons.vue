<script setup lang="ts">
import Button from 'primevue/button';
import type { Task } from '../../store/task';

defineProps<{
    task: Task;
    showDeleteMode: boolean;
}>();

const emit = defineEmits<{
    edit: [task: Task];
    delete: [task: Task];
}>();
</script>

<template>
    <!-- 編集ボタン -->
    <Button
        icon="pi pi-pencil"
        class="p-button-text p-button-secondary p-button-sm task-action-btn"
        title="タスクを編集"
        :aria-label="`タスク「${task.title}」を編集`"
        @click.stop="emit('edit', task)"
    />
    <!-- 削除ボタン (削除モード時のみ) -->
    <Button
        v-if="showDeleteMode"
        icon="pi pi-trash"
        class="p-button-text p-button-danger p-button-sm task-action-btn"
        title="タスクを削除"
        :aria-label="`タスク「${task.title}」を削除`"
        @click.stop="emit('delete', task)"
    />
</template>

<style scoped>
.task-action-btn {
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
}
</style>
