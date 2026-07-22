import { afterEach, describe, expect, it, vi } from 'vitest';
import runtimePathLogger from '../plugins/runtime-path-logger';
import { getRuntimePathConfig } from '../utils/paths';

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (plugin: unknown) => plugin
}));

afterEach(() => {
    vi.restoreAllMocks();
});

describe('runtimePathLogger', () => {
    it('runtimePathLoggerは起動時に主要パス設定を一度ログ出力する', () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

        runtimePathLogger({} as never);

        expect(infoSpy).toHaveBeenCalledOnce();
        expect(infoSpy).toHaveBeenCalledWith(
            '[ServerPaths] 起動時パス設定:',
            getRuntimePathConfig()
        );
    });
});
