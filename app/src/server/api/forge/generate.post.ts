import { defineEventHandler, readBody } from 'h3';
import { ForgeConnector } from '../../../connector/forge-connector';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { params, host } = body;
        if (!params) {
            return { success: false, error: 'params is required' };
        }
        const base64Image = await ForgeConnector.generateImage(params, host);
        return { success: true, image: base64Image };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});
