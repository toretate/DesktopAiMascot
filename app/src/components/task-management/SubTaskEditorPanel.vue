<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import type { SubTask } from '../../store/task';

const props = defineProps<{
    subTask: SubTask;
    autoFocusSchedule?: boolean;
}>();

const emit = defineEmits<{
    close: [];
    save: [updates: Partial<SubTask>];
}>();

const toLocalDateTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localTime.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string) => value ? new Date(value).toISOString() : undefined;

const form = reactive({
    title: '',
    memo: '',
    scheduledAt: '',
    scheduledEndAt: ''
});
const scheduledAtInput = ref<HTMLInputElement | null>(null);

watch(
    () => props.subTask,
    subTask => {
        form.title = subTask.title;
        form.memo = subTask.memo ?? '';
        form.scheduledAt = toLocalDateTime(subTask.scheduledAt);
        form.scheduledEndAt = toLocalDateTime(subTask.scheduledEndAt);
    },
    { immediate: true }
);

watch(
    () => props.autoFocusSchedule,
    async autoFocusSchedule => {
        if (!autoFocusSchedule) return;
        await nextTick();
        scheduledAtInput.value?.focus();
    },
    { immediate: true, flush: 'post' }
);

const isTimeValid = () => {
    if (!form.scheduledAt || !form.scheduledEndAt) return true;
    return new Date(form.scheduledEndAt).getTime() > new Date(form.scheduledAt).getTime();
};

const save = () => {
    const title = form.title.trim();
    if (!title || !isTimeValid()) return;
    emit('save', {
        title,
        memo: form.memo.trim() || undefined,
        scheduledAt: toIsoDateTime(form.scheduledAt),
        scheduledEndAt: toIsoDateTime(form.scheduledEndAt)
    });
};
</script>

<template>
    <div class="subtask-editor-panel" role="dialog" aria-modal="true" aria-labelledby="subtask-editor-title">
        <div class="panel-header">
            <span id="subtask-editor-title" class="panel-title">サブタスクの編集</span>
            <Button icon="pi pi-times" class="p-button-text p-button-secondary close-btn" aria-label="閉じる" @click="emit('close')" />
        </div>
        <div class="panel-content">
            <label class="edit-field">
                <span class="edit-label">タイトル</span>
                <InputText v-model="form.title" class="p-inputtext-sm" />
            </label>
            <label class="edit-field">
                <span class="edit-label">内容</span>
                <textarea v-model="form.memo" class="edit-textarea" rows="5" placeholder="詳細やメモを入力"></textarea>
            </label>
            <label class="edit-field">
                <span class="edit-label">開始日時</span>
                <input ref="scheduledAtInput" v-model="form.scheduledAt" class="edit-input" type="datetime-local" />
            </label>
            <label class="edit-field">
                <span class="edit-label">終了日時</span>
                <input v-model="form.scheduledEndAt" class="edit-input" type="datetime-local" />
                <span v-if="!isTimeValid()" class="edit-error">終了日時は開始日時より後に設定してください。</span>
            </label>
        </div>
        <div class="panel-footer">
            <Button label="キャンセル" class="p-button-outlined p-button-secondary p-button-sm" @click="emit('close')" />
            <Button label="保存" class="p-button-primary p-button-sm" :disabled="!form.title.trim() || !isTimeValid()" @click="save" />
        </div>
    </div>
</template>

<style scoped>
.subtask-editor-panel { position: absolute; inset: 0; z-index: 160; display: flex; flex-direction: column; background: #fff; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #f1f5f9; }
.panel-title { color: #1e293b; font-size: 14px; font-weight: 700; }
.close-btn { width: 24px; height: 24px; padding: 0; }
.panel-content { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding: 12px 16px; }
.edit-field { display: flex; flex-direction: column; gap: 4px; }
.edit-label { color: #64748b; font-size: 11px; font-weight: 600; }
.edit-input, .edit-textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; font: inherit; font-size: 12px; }
.edit-input { min-height: 32px; padding: 4px 8px; }
.edit-textarea { min-height: 80px; padding: 6px 8px; resize: vertical; }
.edit-error { color: #dc2626; font-size: 10px; }
.panel-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid #f1f5f9; background: #f8fafc; }
</style>
