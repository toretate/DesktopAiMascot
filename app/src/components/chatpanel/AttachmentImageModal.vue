<script setup lang="ts">
import { ref, watch } from 'vue';
import { extractImageParameters } from '../../utils/png-metadata';
import AppModalShell from '../common/AppModalShell.vue';

const props = defineProps<{
    url: string | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'use-i2i', url: string): void;
}>();

const imageParametersText = ref('');
const showInfoPanel = ref(false);
const copied = ref(false);

const openDownloadsFolder = () => {
    if (window.electronAPI && window.electronAPI.openDownloadsFolder) {
        window.electronAPI.openDownloadsFolder();
    }
};

const copyParameters = async () => {
    if (!imageParametersText.value) return;
    try {
        await navigator.clipboard.writeText(imageParametersText.value);
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text:', err);
    }
};

const handleClose = () => {
    emit('close');
};

const useAsImageSource = () => {
    if (!props.url) return;
    emit('use-i2i', props.url);
    handleClose();
};

watch(() => props.url, (newUrl) => {
    if (!newUrl) {
        imageParametersText.value = '';
        showInfoPanel.value = false;
        copied.value = false;
        return;
    }

    showInfoPanel.value = false;
    copied.value = false;

    if (window.electronAPI && window.electronAPI.logDebug) {
        window.electronAPI.logDebug(`openImageModal URL length: ${newUrl.length}, startsWithData: ${newUrl.startsWith('data:')}`);
        try {
            const parts = newUrl.split(',');
            const base64 = (parts[1] || '').replace(/\s/g, '');
            const bin = atob(base64.substring(0, 100));
            const header = [];
            for (let i = 0; i < Math.min(bin.length, 8); i++) {
                header.push(bin.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase());
            }
            window.electronAPI.logDebug(`Image Header: ${header.join(' ')}`);
        } catch (e: any) {
            window.electronAPI.logDebug(`Failed to read header: ${e.message}`);
        }
    }

    try {
        const params = extractImageParameters(newUrl);
        imageParametersText.value = params;

        if (window.electronAPI && window.electronAPI.logDebug) {
            window.electronAPI.logDebug(`Parsed parameters length: ${params?.length}`);
            if (params) {
                window.electronAPI.logDebug(`Parsed parameters text:\n${params}`);
            }
        }
    } catch (e: any) {
        if (window.electronAPI && window.electronAPI.logDebug) {
            window.electronAPI.logDebug(`Failed to extract parameters: ${e.message}`);
        }
    }
}, { immediate: true });
</script>

<template>
    <AppModalShell
        :visible="Boolean(url)"
        title-id="attachment-image-title"
        width="min(1120px, 94vw)"
        height="min(760px, 92dvh)"
        max-width="94vw"
        max-height="92dvh"
        padding="0"
        backdrop="dark"
        mobile-fullscreen
        @close="handleClose"
    >
        <div v-if="url" class="image-modal-content">
            <h2 id="attachment-image-title" class="visually-hidden">添付画像の拡大表示</h2>
            <button type="button" class="modal-close-btn" aria-label="画像を閉じる" @click="handleClose">
                <i class="pi pi-times" aria-hidden="true"></i>
            </button>
            <img :src="url" class="full-image" alt="添付画像の拡大表示" />

            <div class="modal-action-bar">
                <button type="button" class="modal-action-btn i2i-btn" @click="useAsImageSource" title="この画像を画像編集 (i2i) の元画像に設定">
                    <i class="pi pi-pencil"></i> この画像を i2i 元画像に設定
                </button>

                <button v-if="imageParametersText" type="button" class="modal-action-btn info-btn" :class="{ 'active-info': showInfoPanel }" @click="showInfoPanel = !showInfoPanel" title="生成パラメータを表示">
                    <i class="pi pi-info-circle"></i> 生成パラメータ
                </button>

                <button type="button" class="modal-action-btn folder-btn" @click="openDownloadsFolder" title="画像の保存先（ダウンロード）フォルダを開く">
                    <i class="pi pi-folder-open"></i> 保存先を開く
                </button>
            </div>

            <!-- パラメータ詳細表示パネル -->
            <div v-if="showInfoPanel && imageParametersText" class="info-panel-overlay">
                <div class="info-panel-header">
                    <span class="info-panel-title"><i class="pi pi-info-circle"></i> 生成パラメータ詳細</span>
                    <div class="info-panel-actions">
                        <button type="button" class="panel-icon-btn" @click="copyParameters" title="パラメータをコピー">
                            <i class="pi" :class="copied ? 'pi-check text-green-500' : 'pi-copy'"></i>
                        </button>
                        <button type="button" class="panel-icon-btn" @click="showInfoPanel = false" title="閉じる">
                            <i class="pi pi-times"></i>
                        </button>
                    </div>
                </div>
                <div class="info-panel-body">
                    <pre class="parameters-pre">{{ imageParametersText }}</pre>
                </div>
            </div>
        </div>
    </AppModalShell>
</template>

<style scoped>
.image-modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-overlay-dark);
}

.full-image {
    max-width: calc(100% - 32px);
    max-height: calc(100% - 104px);
    object-fit: contain;
    border-radius: 8px;
    box-shadow: var(--shadow-raised);
}

.modal-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10002;
    width: 44px;
    height: 44px;
    border: 1px solid var(--color-primary-alpha-20);
    border-radius: 50%;
    background: var(--color-surface-overlay-dark);
    color: var(--color-on-primary);
    cursor: pointer;
}

.modal-action-bar {
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 12px;
    z-index: 10000;
}

.modal-action-btn {
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: var(--shadow-dark-control);
    transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    color: var(--color-on-primary);
}

.modal-action-btn.i2i-btn {
    background: var(--color-primary);
}

.modal-action-btn.i2i-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--color-primary-alpha-50);
}

.modal-action-btn.info-btn {
    background: var(--color-dark-control);
    border: 1px solid var(--color-on-dark-border);
    backdrop-filter: blur(4px);
}

.modal-action-btn.info-btn:hover {
    background: var(--color-dark-control-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-dark-overlay);
}

.modal-action-btn.info-btn.active-info {
    background: var(--color-primary);
    border-color: var(--color-primary-border);
    box-shadow: 0 0 12px var(--color-primary-alpha-50);
}

.modal-action-btn.folder-btn {
    background: var(--color-dark-control-muted);
    border: 1px solid var(--color-on-dark-border);
    backdrop-filter: blur(4px);
}

.modal-action-btn.folder-btn:hover {
    background: var(--color-dark-control-muted-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-dark-overlay);
}

/* ---- パラメータ詳細表示パネル ---- */
.info-panel-overlay {
    position: absolute;
    top: 5%;
    left: 5%;
    width: 90%;
    height: 90%;
    background: var(--color-surface-overlay-dark);
    border: 1px solid var(--color-on-dark-border-strong);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    z-index: 10001;
    box-shadow: var(--shadow-dark-overlay);
    animation: fadeIn 0.15s ease;
}

.info-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-on-dark-border);
}

.info-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-on-primary);
    display: flex;
    align-items: center;
    gap: 6px;
}

.info-panel-actions {
    display: flex;
    gap: 8px;
}

.panel-icon-btn {
    background: transparent;
    border: none;
    color: var(--color-ink-subtle);
    cursor: pointer;
    font-size: 14px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease, background-color 0.2s ease;
}

.panel-icon-btn:hover {
    color: var(--color-on-primary);
    background: var(--color-on-dark-hover);
}

.info-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.parameters-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    color: var(--color-surface-muted);
}

.text-green-500 {
    color: var(--color-success) !important;
}

.modal-close-btn:focus-visible,
.modal-action-btn:focus-visible,
.panel-icon-btn:focus-visible {
    outline: 2px solid var(--control-focus-color);
    outline-offset: 2px;
}
</style>
