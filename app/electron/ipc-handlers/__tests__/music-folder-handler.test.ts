import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => ({
    dialogResults: [] as string[],
    ipcHandlers: new Map<string, (...args: any[]) => any>(),
    protocolHandlers: new Map<string, (request: { url: string; headers: Headers }) => any>(),
    netFetch: vi.fn()
}));

vi.mock('electron', () => ({
    app: { getPath: vi.fn(() => 'C:\\user-data') },
    BrowserWindow: { fromWebContents: vi.fn(() => ({})) },
    dialog: {
        showOpenDialog: vi.fn(async () => ({
            canceled: false,
            filePaths: [electronMocks.dialogResults.shift()]
        }))
    },
    ipcMain: {
        handle: vi.fn((name: string, handler: (...args: any[]) => any) => electronMocks.ipcHandlers.set(name, handler))
    },
    net: { fetch: electronMocks.netFetch },
    protocol: {
        registerSchemesAsPrivileged: vi.fn(),
        handle: vi.fn((scheme: string, handler: (request: { url: string; headers: Headers }) => any) => {
            electronMocks.protocolHandlers.set(scheme, handler);
        })
    }
}));

vi.mock('node:fs', () => ({
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    existsSync: vi.fn(() => true),
    statSync: vi.fn((filePath: string) => ({
        isDirectory: () => !filePath.endsWith('.mp3'),
        size: filePath.includes('MusicA') ? 100 : 200,
        mtimeMs: filePath.includes('MusicA') ? 1000 : 2000
    })),
    readdirSync: vi.fn((folderPath: string) => [{
        name: folderPath.includes('MusicA') ? 'a.mp3' : 'b.mp3',
        isDirectory: () => false,
        isFile: () => true
    }])
}));

describe('music-folder-handler', () => {
    beforeEach(() => {
        electronMocks.dialogResults.length = 0;
        electronMocks.ipcHandlers.clear();
        electronMocks.protocolHandlers.clear();
        electronMocks.netFetch.mockReset().mockResolvedValue(new Response('music'));
        vi.resetModules();
    });

    it('別ウィンドウでフォルダを変更・削除しても既存の音楽URLを維持すること', async () => {
        const { registerMusicFolderHandlers } = await import('../music-folder-handler');
        registerMusicFolderHandlers();
        electronMocks.dialogResults.push('C:\\MusicA', 'C:\\MusicB');

        const selectFolder = electronMocks.ipcHandlers.get('select-music-folder');
        const clearFolder = electronMocks.ipcHandlers.get('clear-last-music-folder');
        const serveMusic = electronMocks.protocolHandlers.get('local-music');
        expect(selectFolder).toBeDefined();
        expect(clearFolder).toBeDefined();
        expect(serveMusic).toBeDefined();

        const firstResult = await selectFolder?.({ sender: {} });
        await selectFolder?.({ sender: {} });
        await clearFolder?.();
        await serveMusic?.({ url: firstResult.files[0].url, headers: new Headers() });

        expect(electronMocks.netFetch).toHaveBeenCalledTimes(1);
        expect(electronMocks.netFetch.mock.calls[0][0]).toContain('MusicA/a.mp3');
    });
});
