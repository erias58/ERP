
const axios = require('axios');
const logger = require('winston');
const { SyncQueue, Tenant } = require('../models');

class SyncManager {
    static async syncTransactions(tenantId, token, sequelize) {
        try {
            const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
            if (!tenant) throw new Error('Tenant not found');

            const queueItems = await SyncQueue.findAll({ where: { tenantId: tenant.id } });
            for (const item of queueItems) {
                try {
                    await axios.post(
                        'http://localhost:8001/api/v1/sync/',
                        {
                            operation: item.operation,
                            data: item.data
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'X-Tenant-ID': tenantId
                            },
                            timeout: 10000
                        }
                    );
                    await item.destroy();
                    logger.info(`Synced ${item.operation} for tenant ${tenantId}`);
                } catch (err) {
                    logger.error(`Failed to sync ${item.operation} for tenant ${tenantId}: ${err.message}`);
                    continue; // Continue with next item
                }
            }
            return true;
        } catch (err) {
            logger.error(`Sync failed for tenant ${tenantId}: ${err.message}`);
            return false;
        }
    }
}

module.exports = SyncManager;
