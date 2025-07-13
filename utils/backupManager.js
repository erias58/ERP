
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('winston');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

module.exports = {
    async createBackup(tenantId, sequelize) {
        try {
            const tenant = await sequelize.models.Tenant.findOne({ where: { tenant_id: tenantId } });
            if (!tenant) throw new Error('Tenant not found');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(BACKUP_DIR, `backup_${tenantId}_${timestamp}.sql`);
            const dbConfig = sequelize.config;

            const backupCommand = `pg_dump -U ${dbConfig.username} -h ${dbConfig.host} -p ${dbConfig.port} -d ${dbConfig.database} --no-owner --no-privileges > "${backupPath}"`;
            await new Promise((resolve, reject) => {
                exec(backupCommand, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            await sequelize.models.Backup.create({
                tenantId: tenant.id,
                backupPath
            });

            logger.info(`Backup created for tenant ${tenantId} at ${backupPath}`);
            return true;
        } catch (err) {
            logger.error(`Failed to create backup for tenant ${tenantId}: ${err.message}`);
            return false;
        }
    }
};
