<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import { useConfigStore } from '../../store/config';
import { MEETING_CATEGORY_ID, useTaskStore } from '../../store/task';

const emit = defineEmits<{
    close: [];
}>();

const taskStore = useTaskStore();
const configStore = useConfigStore();
const newCategoryName = ref('');

const addCategory = () => {
    const name = newCategoryName.value.trim();
    if (!name) return;
    taskStore.addCategory(name);
    newCategoryName.value = '';
};

const deleteCategory = (id: string) => {
    if (confirm('このカテゴリを削除しますか？配下のタスクもすべて削除されます。')) {
        taskStore.deleteCategory(id);
    }
};

const moveCategory = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= taskStore.categories.length) return;
    const categories = [...taskStore.categories];
    [categories[index], categories[targetIndex]] = [categories[targetIndex], categories[index]];
    taskStore.updateCategoriesOrder(categories);
};

const close = () => {
    configStore.saveConfig();
    emit('close');
};
</script>

<template>
    <div class="inline-settings-panel">
        <div class="settings-header">
            <Button
                icon="pi pi-arrow-left"
                class="p-button-text p-button-secondary p-button-sm back-btn"
                label="戻る"
                @click="close"
            />
        </div>

        <div class="settings-content">
            <div class="settings-section">
                <span class="section-title">カテゴリの管理</span>
                <div class="category-list">
                    <div
                        v-for="(category, index) in taskStore.categories"
                        :key="category.id"
                        class="category-item"
                    >
                        <div class="cat-left">
                            <div class="order-buttons">
                                <Button
                                    icon="pi pi-chevron-up"
                                    class="p-button-text p-button-sm p-button-secondary move-btn"
                                    :disabled="index === 0"
                                    title="上へ移動"
                                    @click="moveCategory(index, -1)"
                                />
                                <Button
                                    icon="pi pi-chevron-down"
                                    class="p-button-text p-button-sm p-button-secondary move-btn"
                                    :disabled="index === taskStore.categories.length - 1"
                                    title="下へ移動"
                                    @click="moveCategory(index, 1)"
                                />
                            </div>
                            <InputText
                                v-model="category.name"
                                class="p-inputtext-sm cat-name-input"
                                :disabled="category.id === MEETING_CATEGORY_ID"
                                placeholder="カテゴリ名"
                                @blur="taskStore.updateCategory(category.id, category.name)"
                            />
                        </div>
                        <Button
                            icon="pi pi-trash"
                            class="p-button-text p-button-danger p-button-sm delete-btn"
                            :disabled="category.id === MEETING_CATEGORY_ID"
                            :title="category.id === MEETING_CATEGORY_ID ? '会議は標準カテゴリのため削除できません' : '削除'"
                            @click="deleteCategory(category.id)"
                        />
                    </div>
                    <div v-if="taskStore.categories.length === 0" class="empty-message">
                        カテゴリが登録されていません。
                    </div>
                </div>

                <div class="add-category-form">
                    <InputText
                        v-model="newCategoryName"
                        placeholder="カテゴリを追加..."
                        class="p-inputtext-sm flex-grow-1"
                        @keyup.enter="addCategory"
                    />
                    <Button
                        icon="pi pi-plus"
                        class="p-button-sm add-btn"
                        :disabled="!newCategoryName.trim()"
                        @click="addCategory"
                    />
                </div>
            </div>

            <div class="divider"></div>

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

            <div class="settings-section">
                <span class="section-title">予定のお知らせ</span>
                <div class="notification-control">
                    <label class="checkbox-label">
                        <input v-model="taskStore.enableNotification" type="checkbox" class="p-checkbox-input" />
                        <span>予定を通知する</span>
                    </label>
                    <div v-if="taskStore.enableNotification" class="minutes-input-row">
                        <InputText
                            :model-value="String(taskStore.notificationMinutes)"
                            type="number"
                            min="0"
                            max="60"
                            class="p-inputtext-sm minutes-input"
                            @update:model-value="value => taskStore.notificationMinutes = Number(value)"
                        />
                        <span class="minutes-text">分前にお知らせ</span>
                    </div>
                    <span class="settings-help-text">通知音声はチャット上部の音声ボタンに連動します。</span>
                </div>
            </div>

            <div class="divider"></div>

            <div class="settings-section">
                <span class="section-title">完了(DONE)の猶予</span>
                <div class="minutes-input-row no-indent">
                    <InputText
                        :model-value="String(taskStore.completionGraceSeconds)"
                        type="number"
                        min="0"
                        max="120"
                        class="p-inputtext-sm minutes-input"
                        @update:model-value="value => taskStore.completionGraceSeconds = Number(value)"
                    />
                    <span class="minutes-text">秒後にCOMPへ移動 (0で即時)</span>
                </div>
            </div>

            <div class="divider"></div>

            <div class="settings-section">
                <span class="section-title">デフォルトの所要時間</span>
                <div class="minutes-input-row no-indent">
                    <InputText
                        :model-value="String(taskStore.defaultDurationHours)"
                        type="number"
                        min="0.25"
                        step="0.25"
                        class="p-inputtext-sm minutes-input"
                        @update:model-value="value => taskStore.defaultDurationHours = Math.max(0.25, Number(value) || 1)"
                    />
                    <span class="minutes-text">時間</span>
                </div>
            </div>

            <div class="divider"></div>

            <div class="settings-section">
                <span class="section-title">会議中のお知らせ</span>
                <div class="notification-control">
                    <label class="checkbox-label">
                        <input
                            v-model="taskStore.muteNotificationsDuringMeetings"
                            type="checkbox"
                            class="p-checkbox-input"
                        />
                        <span>会議中は音声をミュートする</span>
                    </label>
                    <span class="settings-help-text">OS通知と吹き出しは表示します。</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.inline-settings-panel { display: flex; flex-direction: column; height: 100%; padding: 8px; background: var(--color-surface-raised); }
.settings-header { display: flex; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--color-border-soft); padding-bottom: 8px; }
.settings-header .back-btn { padding: 4px 8px !important; font-size: 12px !important; height: 28px !important; }
.settings-content { display: flex; flex-direction: column; gap: 16px; overflow-y: auto; flex-grow: 1; }
.settings-section { display: flex; flex-direction: column; gap: 8px; }
.section-title { font-size: 12px; font-weight: 600; color: #475569; }
.category-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
.category-item { display: flex; align-items: center; justify-content: space-between; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 8px; padding: 6px 8px; gap: 12px; }
.cat-left { display: flex; align-items: center; gap: 8px; flex-grow: 1; }
.order-buttons { display: flex; flex-direction: column; gap: 2px; }
.move-btn { width: 18px !important; height: 18px !important; padding: 0 !important; }
.cat-name-input { flex-grow: 1; border-color: var(--color-border); background: var(--color-surface-raised); padding: 4px 8px !important; font-size: 12px !important; height: 28px !important; }
.cat-name-input:focus { border-color: #3b82f6; }
.delete-btn { width: 28px !important; height: 28px !important; padding: 0 !important; }
.empty-message { text-align: center; color: #64748b; padding: 12px 0; font-size: 12px; }
.add-category-form { display: flex; gap: 8px; margin-top: 4px; }
.add-btn { background: #3b82f6; border-color: #3b82f6; color: #fff; padding: 4px 12px !important; height: 28px !important; }
.divider { height: 1px; background: var(--color-border-soft); margin: 4px 0; }
.opacity-control { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
.opacity-value { font-size: 12px; font-weight: 600; color: #334155; width: 36px; text-align: right; }
.opacity-slider { flex-grow: 1; }
.notification-control { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.settings-help-text { padding-left: 22px; color: #94a3b8; font-size: 10px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #475569; user-select: none; }
.p-checkbox-input { width: 16px; height: 16px; cursor: pointer; }
.minutes-input-row { display: flex; align-items: center; gap: 8px; padding-left: 24px; }
.minutes-input-row.no-indent { padding-left: 0; }
.minutes-input { width: 60px !important; text-align: center; padding: 4px 8px !important; }
.minutes-text { font-size: 12px; color: #64748b; font-weight: 500; }
</style>
