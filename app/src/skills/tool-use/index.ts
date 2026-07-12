import { gpsLocationTool } from './gps-location-tool';
import { weatherTool } from './weather-tool';
import { volumeTool } from './volume-tool';
import { appLauncherTool } from './app-launcher-tool';
import { webSearchTool } from './web-search-tool';
import { manageTasksTool } from './manage-tasks-tool';
import { manageMemosTool } from './manage-memos-tool';

// プロンプトのインポート
import gpsLocationPrompt from './prompts/getGPSLocation.prompt';
import weatherPrompt from './prompts/getWeather.prompt';
import volumePrompt from './prompts/adjustVolume.prompt';
import launchAppPrompt from './prompts/launchApp.prompt';
import searchWebPrompt from './prompts/searchWeb.prompt';
import manageTasksPrompt from './prompts/manageTasks.prompt';
import manageMemosPrompt from './prompts/manageMemos.prompt';

import type { Tool } from '@lmstudio/sdk';

export interface MascotTool {
    /** @lmstudio/sdk の tool() 戻り値。llm.act へはこれを渡す */
    tool: Tool;
    /** 設定トグルのキー（store/config.ts のキー名）。undefined なら常時有効 */
    configKey?: string;
    /** connector の英語ガイドライン用の短いラベル（例: 'weather'） */
    label: string;
    /** ChatAiService の system prompt に注入するツール別ガイドライン */
    prompt: string;
}

export const mascotTools: MascotTool[] = [
    {
        tool: gpsLocationTool,
        configKey: 'toolsGpsLocation',
        label: 'location',
        prompt: gpsLocationPrompt,
    },
    {
        tool: weatherTool,
        configKey: 'toolsWeather',
        label: 'weather',
        prompt: weatherPrompt,
    },
    {
        tool: volumeTool,
        configKey: 'toolsVolume',
        label: 'volume',
        prompt: volumePrompt,
    },
    {
        tool: appLauncherTool,
        configKey: 'toolsAppLauncher',
        label: 'app launching',
        prompt: launchAppPrompt,
    },
    {
        tool: webSearchTool,
        configKey: 'toolsWebSearch',
        label: 'web search',
        prompt: searchWebPrompt,
    },
    {
        tool: manageTasksTool,
        // TODO: manageTasks の設定トグル新設（UI変更含む）はプロダクト判断待ち
        configKey: undefined,
        label: 'task management',
        prompt: manageTasksPrompt,
    },
    {
        tool: manageMemosTool,
        // TODO: manageMemos の設定トグル新設（UI変更含む）はプロダクト判断待ち
        configKey: undefined,
        label: 'memo management',
        prompt: manageMemosPrompt,
    }
];

export function filterEnabledTools(tools?: Record<string, boolean | undefined> | null): MascotTool[] {
    return mascotTools.filter(t =>
        !tools || t.configKey === undefined || tools[t.configKey] !== false
    );
}
