const DATABASE_NAME = 'tonarice-music';
const STORE_NAME = 'directory-handles';
const LAST_DIRECTORY_KEY = 'last-directory';

export interface MusicDirectoryHandle {
    kind: 'directory';
    name: string;
    values: () => AsyncIterable<MusicFileSystemHandle>;
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

interface MusicFileHandle {
    kind: 'file';
    name: string;
    getFile: () => Promise<File>;
}

type MusicFileSystemHandle = MusicDirectoryHandle | MusicFileHandle;

export interface MusicDirectoryFile {
    file: File;
    relativePath: string;
}

declare global {
    interface Window {
        showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<MusicDirectoryHandle>;
    }
}

export const supportsMusicDirectoryPicker = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const runRequest = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const database = await openDatabase();
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, mode);
            const request = operation(transaction.objectStore(STORE_NAME));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
};

export const saveMusicDirectoryHandle = (handle: MusicDirectoryHandle) => runRequest('readwrite', store => store.put(handle, LAST_DIRECTORY_KEY));

export const loadMusicDirectoryHandle = () => runRequest<MusicDirectoryHandle | undefined>('readonly', store => store.get(LAST_DIRECTORY_KEY));

export const clearMusicDirectoryHandle = () => runRequest('readwrite', store => store.delete(LAST_DIRECTORY_KEY));

export const scanMusicDirectory = async (handle: MusicDirectoryHandle): Promise<MusicDirectoryFile[]> => {
    const files: MusicDirectoryFile[] = [];
    const visit = async (directory: MusicDirectoryHandle, parentPath: string) => {
        for await (const entry of directory.values()) {
            const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'directory') {
                await visit(entry, relativePath);
            } else {
                files.push({ file: await entry.getFile(), relativePath });
            }
        }
    };
    await visit(handle, '');
    return files;
};
