import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';

export interface Memo {
    id: string;
    content: string;
    color?: string;
    pinned?: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export const useMemoStore = defineStore('memo', () => {
    const memos = ref<Memo[]>([]);
    const showMemoWidget = ref<boolean>(false);
    const isLoaded = ref(false);

    const loadFromLocalStorage = async () => {
        if (typeof window === 'undefined') return;

        // 1. ローカルストレージからの読み込み
        try {
            const savedMemos = localStorage.getItem('desktop-mascot-memos');
            if (savedMemos) {
                memos.value = JSON.parse(savedMemos);
            }
            const savedShowWidget = localStorage.getItem('desktop-mascot-show-memo-widget');
            if (savedShowWidget) {
                showMemoWidget.value = savedShowWidget === 'true';
            }
        } catch (error) {
            console.warn('LocalStorageからのメモ読み込みエラー:', error);
        }

        // 2. サーバーからの読み込み
        let recoveredFromLocal = false;
        try {
            const res = await fetch('/api/memos', { credentials: 'include' });
            if (res.ok) {
                const resJson = await res.json();
                if (resJson.success) {
                    const serverMemos = Array.isArray(resJson.memos) ? resJson.memos : [];
                    if (serverMemos.length > 0 || memos.value.length === 0) {
                        memos.value = serverMemos;
                    } else {
                        recoveredFromLocal = true;
                        console.warn('[MemoStore] サーバーのメモが空のため、ローカルの既存データを保持しました。');
                    }
                    localStorage.setItem('desktop-mascot-memos', JSON.stringify(memos.value));
                }
            } else if (memos.value.length > 0) {
                recoveredFromLocal = true;
            }
        } catch (error) {
            console.warn('サーバーからのメモロード失敗:', error);
        } finally {
            isLoaded.value = true;
            if (recoveredFromLocal) {
                saveToLocalStorage();
            }
        }
    };

    const saveToLocalStorage = () => {
        if (typeof window === 'undefined' || !isLoaded.value) return;

        try {
            localStorage.setItem('desktop-mascot-memos', JSON.stringify(memos.value));
            localStorage.setItem('desktop-mascot-show-memo-widget', String(showMemoWidget.value));

            fetch('/api/memos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memos: memos.value }),
                credentials: 'include'
            }).catch(err => {
                console.warn('サーバーへのメモ保存失敗:', err);
            });
        } catch (error) {
            console.error('LocalStorageへのメモ保存エラー:', error);
        }
    };

    watch(
        [() => memos.value, () => showMemoWidget.value],
        () => {
            saveToLocalStorage();
        },
        { deep: true }
    );

    const sortedMemos = computed(() => {
        // pinnedが上のもの、次いでorderまたはcreatedAtの新しい順
        return [...memos.value].sort((a, b) => {
            if (a.pinned !== b.pinned) {
                return a.pinned ? -1 : 1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    });

    const addMemo = (content: string, color?: string, pinned?: boolean) => {
        const id = 'memo_' + Math.random().toString(36).substring(2, 11);
        memos.value.push({
            id,
            content,
            color: color || 'yellow',
            pinned: pinned || false,
            order: memos.value.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    };

    const addMemoFromServer = (memo: Memo) => {
        const exists = memos.value.some(m => m.id === memo.id);
        if (!exists) {
            memos.value.push(memo);
        } else {
            const idx = memos.value.findIndex(m => m.id === memo.id);
            if (idx !== -1) memos.value[idx] = memo;
        }
    };

    const updateMemo = (id: string, updates: Partial<Memo>) => {
        const memo = memos.value.find(m => m.id === id);
        if (memo) {
            Object.assign(memo, updates);
            memo.updatedAt = new Date().toISOString();
        }
    };

    const deleteMemo = (id: string) => {
        memos.value = memos.value.filter(m => m.id !== id);
    };
    
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
            if (e.key === 'desktop-mascot-memos' || e.key === 'desktop-mascot-show-memo-widget') {
                isLoaded.value = false;
                loadFromLocalStorage();
            }
        });
    }

    return {
        memos,
        showMemoWidget,
        isLoaded,
        sortedMemos,
        loadFromLocalStorage,
        saveToLocalStorage,
        addMemo,
        addMemoFromServer,
        updateMemo,
        deleteMemo
    };
});
