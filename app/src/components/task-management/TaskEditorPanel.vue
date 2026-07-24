<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { useTaskStore } from '../../store/task';
import type { TaskEditForm } from './composables/useTaskEditor';
import { EDIT_END_CALENDAR_TARGET, EDIT_START_CALENDAR_TARGET } from './composables/useTaskScheduleEditor';
import { formatTaskTime } from './taskDisplayUtils';

defineProps<{
    editForm: TaskEditForm;
    timeValid: boolean;
}>();

const emit = defineEmits<{
    close: [];
    save: [];
    openDatePicker: [target: string];
    setEndMode: [mode: TaskEditForm['endMode']];
}>();

const taskStore = useTaskStore();
</script>

<template>
    <div class="fullscreen-edit-panel">
        <div class="panel-header">
            <span class="panel-title">タスクの編集</span>
            <Button icon="pi pi-times" class="p-button-text p-button-secondary close-btn" @click="emit('close')" />
        </div>
        <div class="edit-panel-content">
            <label class="edit-field">
                <span class="edit-label">タイトル</span>
                <InputText v-model="editForm.title" class="p-inputtext-sm" placeholder="タイトル" />
            </label>
            <label class="edit-field">
                <span class="edit-label">メモ</span>
                <textarea v-model="editForm.memo" class="edit-textarea" rows="4" placeholder="メモ"></textarea>
            </label>
            <label class="edit-field">
                <span class="edit-label">カテゴリ</span>
                <select v-model="editForm.categoryId" class="edit-select">
                    <option v-for="category in taskStore.categories" :key="category.id" :value="category.id">
                        {{ category.name }}
                    </option>
                </select>
            </label>
            <label class="edit-field">
                <span class="edit-label">開始日時</span>
                <button class="edit-date-picker-btn" type="button" @click="emit('openDatePicker', EDIT_START_CALENDAR_TARGET)">
                    <i class="pi pi-calendar"></i>
                    <span>{{ editForm.scheduledAt ? formatTaskTime(editForm.scheduledAt.toISOString()) : '未設定' }}</span>
                </button>
            </label>
            <div class="end-mode-selector" role="group" aria-label="終了の設定方法">
                <button type="button" class="end-mode-btn" :class="{ active: editForm.endMode === 'duration' }" @click="emit('setEndMode', 'duration')">
                    所要時間
                </button>
                <span class="end-mode-or">または</span>
                <button type="button" class="end-mode-btn" :class="{ active: editForm.endMode === 'datetime' }" @click="emit('setEndMode', 'datetime')">
                    終了日時
                </button>
            </div>
            <label v-if="editForm.endMode === 'duration'" class="edit-field">
                <span class="edit-label">所要時間</span>
                <span class="duration-input-wrapper">
                    <input v-model.number="editForm.durationHours" class="duration-input" type="number" min="0.25" step="0.25" inputmode="decimal" />
                    <span class="duration-unit">時間</span>
                </span>
            </label>
            <label v-else class="edit-field">
                <span class="edit-label">終了日時</span>
                <button class="edit-date-picker-btn" type="button" @click="emit('openDatePicker', EDIT_END_CALENDAR_TARGET)">
                    <i class="pi pi-calendar"></i>
                    <span>{{ editForm.scheduledEndAt ? formatTaskTime(editForm.scheduledEndAt.toISOString()) : '未設定' }}</span>
                </button>
                <span v-if="!timeValid" class="edit-field-error">終了日時は開始日時より後に設定してください。</span>
            </label>
        </div>
        <div class="panel-footer">
            <Button label="キャンセル" class="p-button-outlined p-button-secondary p-button-sm" @click="emit('close')" />
            <Button label="保存" class="p-button-primary p-button-sm" :disabled="!editForm.title.trim() || !timeValid" @click="emit('save')" />
        </div>
    </div>
</template>

<style scoped>
/* Hallmark · コンポーネント: タスク編集フォーム · 現代的で簡潔 · Purple · critique: P5 H5 E5 S5 R5 V4 */
.fullscreen-edit-panel { position: absolute; inset: 0; z-index: 150; display: flex; flex-direction: column; background: var(--color-surface-raised); color: var(--color-ink); font-family: var(--font-body); animation: slide-up 0.2s ease-out; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--color-border-soft); }
.panel-title { color: var(--color-ink-strong); font-family: var(--font-body); font-size: 14px; font-weight: 700; letter-spacing: 0.01em; }
.close-btn { width: 24px; height: 24px; padding: 0; }
.edit-panel-content { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
.edit-field { display: flex; flex-direction: column; gap: 4px; }
.edit-label { color: var(--color-ink-muted); font-size: 12px; font-weight: 600; line-height: 1.35; }
.edit-field :deep(.p-inputtext), .edit-textarea, .edit-select, .duration-input, .edit-date-picker-btn { border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-raised); color: var(--color-ink); font-family: var(--font-body); font-size: 13px; font-weight: 500; line-height: 1.4; }
.edit-field :deep(.p-inputtext) { min-height: 36px; padding: 7px 10px; }
.edit-field :deep(.p-inputtext:hover), .edit-textarea:hover, .edit-select:hover, .duration-input:hover { border-color: var(--color-primary-border); }
.edit-textarea { min-height: 84px; padding: 8px 10px; resize: vertical; }
.edit-select { min-height: 36px; padding: 7px 10px; }
.edit-date-picker-btn { width: 100%; min-height: 36px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; text-align: left; cursor: pointer; }
.edit-date-picker-btn:hover, .end-mode-btn:hover { border-color: var(--color-primary-border); background: var(--color-surface-muted); color: var(--color-ink-strong); }
.edit-date-picker-btn:active, .end-mode-btn:active { background: var(--color-primary-soft); }
.edit-date-picker-btn:disabled, .end-mode-btn:disabled, .edit-field :deep(.p-inputtext:disabled), .edit-textarea:disabled, .edit-select:disabled, .duration-input:disabled { cursor: not-allowed; opacity: 0.55; }
.edit-date-picker-btn .pi { color: var(--color-primary); }
.end-mode-selector { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
.end-mode-btn { min-height: 34px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-raised); color: var(--color-ink-muted); font-family: var(--font-body); font-size: 12px; font-weight: 600; cursor: pointer; }
.end-mode-btn.active { border-color: var(--color-primary); background: var(--color-primary-subtle); color: var(--color-primary-hover); }
.end-mode-or { color: var(--color-ink-subtle); font-size: 10px; font-weight: 500; }
.duration-input-wrapper { width: 100%; display: flex; align-items: center; gap: 6px; }
.duration-input { width: 100%; min-width: 0; min-height: 36px; padding: 6px 10px; }
.duration-unit { flex-shrink: 0; color: var(--color-ink-muted); font-size: 12px; font-weight: 500; }
.edit-field-error { color: var(--color-danger); font-size: 11px; }
.panel-footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--color-border-soft); background: var(--color-surface-muted); font-family: var(--font-body); }
.edit-field :deep(.p-inputtext:focus-visible), .edit-textarea:focus-visible, .edit-select:focus-visible, .duration-input:focus-visible, .edit-date-picker-btn:focus-visible, .end-mode-btn:focus-visible { border-color: var(--color-primary); outline: 2px solid var(--control-focus-color); outline-offset: 1px; }
@keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
    .fullscreen-edit-panel { animation: none; }
}
</style>
