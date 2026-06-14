<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Card from 'primevue/card';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';

// リファクタリング済みマスコット設定コンポーネントのインポート
import SettingsSideBar from './components/SettingsSideBar.vue';
import MascotSettings from './MascotSettings.vue';
import VoiceSettings from './views/VoiceGenSettingsView.vue';
import ImageGenSettingsView from './views/ImageGenSettingsView.vue';
import MovieSettingsView from './views/MovieGenSettingsView.vue';
import ApiKeySettingsPanel from './views/ApiKeySettingsView.vue';
import ChatGenSettingsView from './views/ChatGenSettingsView.vue';
import WindowSettingsView from './views/WindowSettingsView.vue';

const configStore = useConfigStore();

const {
    googleAiStudioApiKey: geminiApiKey,
    mascots,
    activeMascotId
} = storeToRefs(configStore);

const activeMenu = ref('mascot');

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

// 28個の感情スロットの初期化保証
const ensure28Expressions = (expressions: any[]): any[] => {
    const defaultEmotions = [
        '通常', '喜び', '怒り', '悲しみ', '驚き',
        '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
        '好奇心', '欲求', '失望', '不賛成', '嫌悪',
        '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
        '愛情', '緊張', '楽観', '誇り', '気づき',
        '安堵', '後悔', '賞賛'
    ];
    
    const existingMap = new Map<string, any>();
    if (Array.isArray(expressions)) {
        expressions.forEach(e => {
            if (e && e.name) {
                existingMap.set(e.name.trim(), e);
            }
        });
    }
    
    return defaultEmotions.map(emotion => {
        const existing = existingMap.get(emotion);
        return {
            id: existing?.id || 'expr_' + emotion,
            name: emotion,
            path: existing?.path || '',
            offsetX: existing?.offsetX ?? 0,
            offsetY: existing?.offsetY ?? 0,
            scale: existing?.scale ?? 1.0
        };
    });
};

// 設定データのロード
onMounted(async () => {
    await configStore.loadConfig();

    if (mascots.value.length === 0) {
        mascots.value = [{
            id: 'mascot_default',
            name: 'デフォルトロボット',
            avatar: '🤖',
            profile: '親しみやすいベーシックなAIマスコットです。明るく元気にユーザーのお手伝いをします。',
            aiConfig: {
                chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
            },
            assets: {
                outfits: [],
                expressions: ensure28Expressions([]),
                poses: []
            }
        }];
    } else {
        mascots.value.forEach(m => {
            m.assets.expressions = ensure28Expressions(m.assets.expressions);
            if (Array.isArray(m.assets.outfits)) {
                m.assets.outfits.forEach((o: any) => {
                    o.expressions = ensure28Expressions(o.expressions || []);
                });
            }
        });
    }

    if (mascots.value.length > 0 && !activeMascotId.value) {
        activeMascotId.value = mascots.value[0].id;
    }
});

const handleLiveUpdate = () => {
    // ライブアップデートのプレースホルダー
};

// マスコットの追加処理
const addMascot = () => {
    const newId = 'mascot_' + Date.now();
    const newMascot = {
        id: newId,
        name: '新しいマスコット',
        avatar: '🤖',
        profile: '新しいAIマスコットです。',
        aiConfig: {
            chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
            voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
        },
        assets: {
            outfits: [],
            expressions: ensure28Expressions([]),
            poses: []
        }
    };
    mascots.value.push(newMascot);
    activeMascotId.value = newId;
    saveSettings();
};

// マスコットの削除処理
const deleteMascot = (mascotId: string) => {
    if (mascots.value.length <= 1) {
        alert('最後の1つのマスコットは削除できません。');
        return;
    }
    const targetMascot = mascots.value.find(m => m.id === mascotId);
    const mascotName = targetMascot ? targetMascot.name : 'このマスコット';
    if (!confirm(`マスコット「${mascotName}」を削除しますか？`)) {
        return;
    }
    
    mascots.value = mascots.value.filter(m => m.id !== mascotId);
    
    if (activeMascotId.value === mascotId) {
        activeMascotId.value = mascots.value[0].id;
    }
    saveSettings();
};

// 設定の保存処理
const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    await configStore.saveConfig();

    setTimeout(() => {
        saveStatus.value = '保存完了！';
        isSaving.value = false;

        setTimeout(() => {
            saveStatus.value = '設定を保存';
        }, 2000);
    }, 600);
};

const quitApp = () => {
    if (window.electronAPI) {
        window.electronAPI.quitApp();
    }
};



const menuItems = ref([
    { name: 'マスコット', value: 'mascot', icon: 'pi pi-user' },
    { name: 'チャットAI', value: 'chat', icon: 'pi pi-comments' },
    { name: 'ウィンドウ設定', value: 'chatwindow', icon: 'pi pi-window-maximize' },
    { name: '音声AI', value: 'voice', icon: 'pi pi-volume-up' },
    { name: '画像AI', value: 'image', icon: 'pi pi-image' },
    { name: '動画AI', value: 'video', icon: 'pi pi-video' },
    { name: 'APIキー', value: 'apikey', icon: 'pi pi-key' }
]);

const goBack = () => {
    if (window.location.hash.includes('settings')) {
        window.close();
    } else if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.hash = '#integrated';
    }
};
</script>

<template>
    <div class="settings-layout">
        <!-- 閉じるフローティングボタン -->
        <button class="close-floating-btn" @click="goBack" title="設定を閉じる">
            <i class="pi pi-times"></i>
        </button>

        <!-- 1. 左サイドバー -->
        <SettingsSideBar 
            v-model:activeMenu="activeMenu"
            :menuItems="menuItems"
            @back="goBack"
        />

        <!-- 2. 右側メインコンテンツエリア -->
        <main class="main-content">
            <div class="content-container" :class="{ 'full-width': activeMenu === 'mascot' }">
                <!-- パネル1: マスコット (リファクタリング済み子コンポーネント) -->
                <div v-if="activeMenu === 'mascot'" class="panel-section">
                    <Card class="premium-card">
                        <template #content>
                            <MascotSettings 
                                :mascots="mascots"
                                v-model:activeMascotId="activeMascotId"
                                :geminiApiKey="geminiApiKey"
                                @live-update="handleLiveUpdate"
                                @save-settings="saveSettings"
                                @add-mascot="addMascot"
                                @delete-mascot="deleteMascot"
                            />
                        </template>
                    </Card>
                </div>

                <!-- パネル2: チャットAI -->
                <div v-else-if="activeMenu === 'chat'" class="panel-section">
                    <ChatGenSettingsView />
                </div>

                <!-- パネル2.5: ウィンドウ・ディスプレイ設定 -->
                <div v-else-if="activeMenu === 'chatwindow'" class="panel-section">
                    <WindowSettingsView />
                </div>

                <!-- パネル3: 音声AI -->
                <div v-else-if="activeMenu === 'voice'" class="panel-section">
                    <VoiceSettings />
                </div>

                <!-- パネル4: 画像AI -->
                <div v-else-if="activeMenu === 'image'" class="panel-section">
                    <ImageGenSettingsView />
                </div>

                <!-- パネル5: 動画AI -->
                <div v-else-if="activeMenu === 'video'" class="panel-section">
                    <MovieSettingsView />
                </div>

                <!-- パネル6: APIキー -->
                <div v-else-if="activeMenu === 'apikey'" class="panel-section">
                    <ApiKeySettingsPanel />
                </div>
            </div>
        </main>
    </div>
</template>

<style>
/* --- 全体レイアウト & ライトテーマ調プレミアムCSS --- */
.settings-layout {
    display: flex;
    height: 100vh;
    background: #f8fafc; /* ライトスレートグレー */
    color: #334155;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
}

/* 左サイドバー */
.sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    background: #0f172a; /* ダークネイビー (コントラスト用) */
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1rem;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    box-shadow: 4px 0 25px rgba(0, 0, 0, 0.15);
}
.sidebar.collapsed {
    width: 72px;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.08);
}

.brand h2 {
    font-size: 16px;
    font-weight: 800;
    margin: 0;
    color: #ffffff;
}
.brand p {
    font-size: 10px;
    margin: 0;
    color: #64748b;
}

.menu {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 2rem;
    flex-grow: 1;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-weight: 500;
    transition: all 0.2s ease;
    width: 100%;
}
.menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
}
.menu-item.active {
    background: #a855f7;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.25);
}

.sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.relaunch-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #eab308;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
    transition: all 0.2s ease;
}
.relaunch-btn:hover {
    background: rgba(234, 179, 8, 0.1);
}

.quit-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
}
.quit-btn:hover {
    background: rgba(239, 68, 68, 0.1);
}

/* メインコンテンツ */
.main-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 2rem;
    margin-left: 72px; /* 折りたたみ時のサイドバー幅分の固定余白を確保してオーバーレイ化 */
}

.content-container {
    max-width: 800px;
    margin: 0 auto;
}
.content-container.full-width {
    max-width: 100%;
}

.premium-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    border-radius: 16px !important;
    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
    padding: 1.5rem !important;
}

/* 各フォーム項目 */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.form-field label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
}

/* 閉じるフローティングボタン */
.close-floating-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1010;
    transition: all 0.2s ease-in-out;
}

.close-floating-btn:hover {
    color: #0f172a;
    background: #f1f5f9;
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.close-floating-btn i {
    font-size: 16px;
    font-weight: bold;
}
</style>
