import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    APP_ROOT,
    PYTHON_DIR,
    STORAGE_DIR,
    WORKSPACE_ROOT,
    getRuntimePathConfig,
    getStorageDir,
    resolveProjectRoots
} from '../utils/paths';

const temporaryDirectories: string[] = [];

function createWorkspace(): { workspaceRoot: string; appRoot: string } {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tonarice-paths-'));
    temporaryDirectories.push(workspaceRoot);
    const appRoot = path.join(workspaceRoot, 'app');

    fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(appRoot, 'package.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(appRoot, 'nuxt.config.ts'), '', 'utf8');

    return { workspaceRoot, appRoot };
}

afterEach(() => {
    for (const dir of temporaryDirectories.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('resolveProjectRoots', () => {
    it('resolveProjectRootsはappをcwdにした場合に親をワークスペースとして解決する', () => {
        const expected = createWorkspace();

        expect(resolveProjectRoots(expected.appRoot)).toEqual(expected);
    });

    it('resolveProjectRootsはapp配下をcwdにした場合も同じルートを解決する', () => {
        const expected = createWorkspace();
        const nestedDir = path.join(expected.appRoot, 'src', 'server', 'utils');
        fs.mkdirSync(nestedDir, { recursive: true });

        expect(resolveProjectRoots(nestedDir)).toEqual(expected);
    });

    it('resolveProjectRootsはワークスペースをcwdにした場合に直下のappを解決する', () => {
        const expected = createWorkspace();

        expect(resolveProjectRoots(expected.workspaceRoot)).toEqual(expected);
    });

    it('resolveProjectRootsはワークスペース配下の別ディレクトリからも解決する', () => {
        const expected = createWorkspace();
        const pythonDir = path.join(expected.workspaceRoot, 'python-services', 'vision');
        fs.mkdirSync(pythonDir, { recursive: true });

        expect(resolveProjectRoots(pythonDir)).toEqual(expected);
    });
});

describe('getStorageDir', () => {
    it('getStorageDirは未指定時にワークスペース直下のstorageを返す', () => {
        const { workspaceRoot } = createWorkspace();

        expect(getStorageDir(workspaceRoot, undefined)).toBe(path.join(workspaceRoot, 'storage'));
    });

    it('getStorageDirは相対指定をワークスペース基準で解決する', () => {
        const { workspaceRoot } = createWorkspace();

        expect(getStorageDir(workspaceRoot, 'custom/storage')).toBe(
            path.join(workspaceRoot, 'custom', 'storage')
        );
    });
});

describe('getRuntimePathConfig', () => {
    it('getRuntimePathConfigは起動時に確認する主要パスを返す', () => {
        expect(getRuntimePathConfig()).toEqual({
            appRoot: APP_ROOT,
            workspaceRoot: WORKSPACE_ROOT,
            storageDir: STORAGE_DIR,
            usersDir: path.join(STORAGE_DIR, 'users'),
            pythonDir: PYTHON_DIR,
            visionDir: path.join(PYTHON_DIR, 'vision'),
            historyTemplatePath: path.join(WORKSPACE_ROOT, 'chat_history.json')
        });
    });
});
