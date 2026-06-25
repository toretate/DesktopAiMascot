import { defineEventHandler, getQuery } from 'h3';
import { ForgeConnector } from '../../../connector/forge-connector';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const host = (query.host as string) || 'http://127.0.0.1:5555';
    const models = await ForgeConnector.models(host);
    return { success: true, models };
});
