import { defineEventHandler, getQuery } from 'h3';
import { ForgeConnector } from '../../../connector/forge-connector';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const host = (query.host as string) || 'http://127.0.0.1:5555';
    const loras = await ForgeConnector.loras(host);
    return { success: true, loras };
});
