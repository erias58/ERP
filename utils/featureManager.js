const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('winston');

const MAIN_API_URL = 'http://main-api.example.com'; // Replace with actual main API URL
const FEATURE_DIR = path.join(__dirname, '..', 'features', 'downloaded');

module.exports = {
    async downloadFeature(featureId, tenantId, token, sequelize) {
        try {
            const tenant = await sequelize.models.Tenant.findOne({ where: { tenant_id: tenantId } });
            if (!tenant) throw new Error('Tenant not found');

            const response = await axios.get(`${MAIN_API_URL}/api/v1/features/${featureId}/`, {
                headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId }
            });

            const featureData = response.data;
            const featurePath = path.join(FEATURE_DIR, `${featureId}.js`);
            fs.writeFileSync(featurePath, featureData.code);

            await sequelize.models.Feature.create({
                tenantId: tenant.id,
                featureId,
                name: featureData.name,
                description: featureData.description
            });

            logger.info(`Feature ${featureId} downloaded for tenant ${tenantId}`);
            return true;
        } catch (err) {
            logger.error(`Failed to download feature ${featureId} for tenant ${tenantId}: ${err.message}`);
            return false;
        }
    }
};