<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import { useTaskStore } from '../../store/task';
import { useConfigStore } from '../../store/config';

const props = defineProps<{
    visible: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
}>();

const taskStore = useTaskStore();
const newCategoryName = ref('');
const localVisible = ref(props.visible);

// 表示状態の同期
watch(() => props.visible, (newVal) => {
    localVisible.value = newVal;
});

watch(localVisible, (newVal) => {
    emit('update:visible', newVal);
});

// カテゴリの追加
const handleAddCategory = () => {
    const name = newCategoryName.value.trim();
    if (!name) return;
    taskStore.addCategory(name);
    newCategoryName.value = '';
};

// カテゴリの削除
const handleDeleteCategory = (id: string) => {
    if (confirm('このカテゴリを削除しますか？配下のタスクもすべて削除されます。')) {
        taskStore.deleteCategory(id);
    }
};

// カテゴリの並び替え（上へ）
const moveUp = (index: number) => {
    if (index === 0) return;
    const cats = [...taskStore.categories];
    const temp = cats[index];
    cats[index] = cats[index - 1];
    cats[index - 1] = temp;
    taskStore.updateCategoriesOrder(cats);
};

// カテゴリの並び替え（下へ）
const moveDown = (index: number) => {
    if (index === taskStore.categories.length - 1) return;
    const cats = [...taskStore.categories];
    const temp = cats[index];
    cats[index] = cats[index + 1];
    cats[index + 1] = temp;
    taskStore.updateCategoriesOrder(cats);
};

const configStore = useConfigStore();
const saveConfig = () => {
    configStore.saveConfig();
};
</script>

<template>
    <Dialog 
        v-model:visible="localVisible" 
        header="タスク設定" 
        :modal="true" 
        :closable="true"
        :style="{ width: '450px' }"
        class="category-settings-dialog"
    >
        <div class="dialog-content">
            <!-- カテゴリ一覧 -->
            <div class="category-list">
                <div 
                    v-for="(cat, idx) in taskStore.categories" 
                    :key="cat.id" 
                    class="category-item"
                >
                    <div class="cat-left">
                        <!-- 並び替えボタン -->
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
                        
                        <!-- 名前編集入力欄 -->
                        <InputText 
                            v-model="cat.name" 
                            class="p-inputtext-sm cat-name-input"
                            @blur="taskStore.updateCategory(cat.id, cat.name)"
                            placeholder="カテゴリ名を入力"
                        />
                    </div>
                    
                    <!-- 削除ボタン -->
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

            <div class="divider"></div>

            <!-- カテゴリ新規追加フォーム -->
            <div class="add-section">
                <span class="section-title">新規カテゴリ追加</span>
                <div class="add-form">
                    <InputText 
                        v-model="newCategoryName" 
                        placeholder="例: Work, Private, Shopping..."
                        class="p-inputtext-sm flex-grow-1"
                        @keyup.enter="handleAddCategory"
                    />
                    <Button 
                        label="追加" 
                        icon="pi pi-plus" 
                        class="p-button-sm add-btn"
                        @click="handleAddCategory"
                        :disabled="!newCategoryName.trim()"
                    />
                </div>
            </div>

            <div class="divider"></div>

            <!-- 不透明度設定セクション -->
            <div class="opacity-section">
                <span class="section-title">ウィジェット全体の不透明度</span>
                <div class="opacity-control">
                    <span class="opacity-value">{{ Math.round(configStore.taskOpacity * 100) }}%</span>
                    <Slider 
                        v-model="configStore.taskOpacity" 
                        :min="0.1" 
                        :max="1.0" 
                        :step="0.05"
                        class="opacity-slider"
                        @change="saveConfig"
                    />
                </div>
            </div>
        </div>

        <template #footer>
            <Button 
                label="閉じる" 
                icon="pi pi-times" 
                class="p-button-text p-button-secondary" 
                @click="localVisible = false" 
            />
        </template>
    </Dialog>
</template>

<style scoped>
.dialog-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 8px;
}

.category-list {
    max-height: 250px;
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
    padding: 8px;
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
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
}

.cat-name-input {
    flex-grow: 1;
    border-color: #cbd5e1;
    background: #ffffff;
}

.cat-name-input:focus {
    border-color: #3b82f6;
}

.delete-btn {
    width: 32px !important;
    height: 32px !important;
    padding: 0 !important;
}

.empty-message {
    text-align: center;
    color: #64748b;
    padding: 16px 0;
    font-size: 13px;
}

.divider {
    height: 1px;
    background: #e2e8f0;
    margin: 4px 0;
}

.add-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.section-title {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
}

.add-form {
    display: flex;
    gap: 8px;
}

.flex-grow-1 {
    flex-grow: 1;
}

.add-btn {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

.add-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
}

.opacity-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.opacity-control {
    display: flex;
    align-items: center;
    gap: 12px;
}

.opacity-value {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    width: 40px;
    text-align: right;
}

.opacity-slider {
    flex-grow: 1;
}
</style>
