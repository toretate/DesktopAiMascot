<script setup lang="ts">
import { useConfigStore } from '../../store/config';

const props = defineProps<{
    mode: 't2i' | 'i2i' | null;
    isSecretMode: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:mode', value: 't2i' | 'i2i' | null): void;
}>();

const configStore = useConfigStore();

const cancelMode = () => {
    emit('update:mode', null);
};
</script>

<template>
    <div 
        v-if="mode" 
        class="image-gen-indicator" 
        :class="{ 'i2i-indicator': mode === 'i2i', 'secret-mode': isSecretMode }"
    >
        <div class="indicator-main">
            <span class="indicator-text">
                <i class="pi" :class="mode === 't2i' ? 'pi-pencil' : 'pi-image'"></i>
                {{ mode === 't2i' ? '画像生成 (t2i) モード' : '画像編集 (i2i) モード' }} 有効中
            </span>
            <button type="button" class="cancel-mode-btn" @click="cancelMode" title="チャットに戻る">
                チャットに戻る <i class="pi pi-times"></i>
            </button>
        </div>
        <!-- i2i時のみ Denoise (ノイズ強度) スライダーを表示 -->
        <div v-if="mode === 'i2i'" class="denoise-slider-box">
            <span class="denoise-label">
                Denoise (変化度): 
                <span class="denoise-val">{{ (configStore.forgeDenoisingStrength !== undefined ? configStore.forgeDenoisingStrength : 0.7).toFixed(2) }}</span>
            </span>
            <input 
                type="range" 
                min="0.0" 
                max="1.0" 
                step="0.05" 
                v-model.number="configStore.forgeDenoisingStrength" 
                class="denoise-slider"
                @change="configStore.saveConfig()"
            />
        </div>
    </div>
</template>

<style scoped>
.image-gen-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--color-primary-alpha-06);
    border: 1px solid var(--color-primary-alpha-15);
    border-radius: 8px;
    padding: 6px 12px;
    margin-bottom: 8px;
    box-sizing: border-box;
    animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.indicator-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-primary-hover);
}

.cancel-mode-btn {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.cancel-mode-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #0f172a;
}

.image-gen-indicator.i2i-indicator {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
}

.indicator-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.denoise-slider-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 6px;
    border-top: 1px dashed var(--color-primary-alpha-15);
}

.denoise-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    white-space: nowrap;
    user-select: none;
}

.denoise-val {
    font-family: monospace;
    font-weight: bold;
    color: var(--color-primary-hover);
}

.denoise-slider {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--color-primary-alpha-15);
    outline: 2px solid transparent;
    -webkit-appearance: none;
    cursor: pointer;
}

.denoise-slider:focus-visible {
    outline-color: var(--control-focus-color);
    outline-offset: 3px;
}

.denoise-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    cursor: pointer;
    background: transparent;
    border-radius: 2px;
}

.denoise-slider::-webkit-slider-thumb {
    height: 12px;
    width: 12px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -4px;
    transition: transform 0.1s ease;
}

.denoise-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
}

/* シークレットモードスタイル */
.image-gen-indicator.secret-mode {
    background: var(--color-primary-alpha-12);
    border-color: var(--color-primary-alpha-30);
}

.image-gen-indicator.secret-mode .indicator-text {
    color: var(--theme-accent-300);
}

.image-gen-indicator.secret-mode .cancel-mode-btn {
    color: #cbd5e1;
}

.image-gen-indicator.secret-mode .cancel-mode-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
}

.image-gen-indicator.secret-mode .denoise-slider-box {
    border-top-color: var(--color-primary-alpha-25);
}

.image-gen-indicator.secret-mode .denoise-label {
    color: #cbd5e1;
}

.image-gen-indicator.secret-mode .denoise-val {
    color: var(--theme-accent-300);
}

.image-gen-indicator.secret-mode .denoise-slider::-webkit-slider-thumb {
    background: var(--theme-accent-400);
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
