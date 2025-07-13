
const axios = require('axios');
const crypto = require('crypto');
const { LicenseKey } = require('../models');
const logger = require('winston');

const MAIN_API_URL = 'http://main-api.example.com'; // Replace with actual main API URL

module.exports = {
    async fetchLicensesFromMainApi(tenantId, token, sequelize) {
        try {
            const tenant = await sequelize.models.Tenant.findOne({ where: { tenant_id: tenantId } });
            if (!tenant) throw new Error('Tenant not found');

            const response = await axios.get(`${MAIN_API_URL}/api/v1/licenses/`, {
                headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId }
            });

            const licenses = response.data.licenses || [];
            for (const license of licenses) {
                await LicenseKey.create({
                    tenantId: tenant.id,
                    companyId: license.companyId || null,
                    licenseKey: license.key,
                    signature: license.signature,
                    isActive: true
                });
            }

            logger.info(`Fetched ${licenses.length} licenses for tenant ${tenantId}`);
            return licenses.length > 0;
        } catch (err) {
            logger.error(`Failed to fetch licenses for tenant ${tenantId}: ${err.message}`);
            return false;
        }
    },

    verifyLicense(licenseKey, signature) {
        try {
            const publicKey = process.env.PUBLIC_KEY || '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----'; // Replace with actual public key
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(licenseKey);
            return verifier.verify(publicKey, signature, 'base64');
        } catch (err) {
            logger.error(`License verification failed: ${err.message}`);
            return false;
        }
    },

    decodeLicenseData(licenseKey) {
        try {
            const decoded = JSON.parse(Buffer.from(licenseKey, 'base64').toString());
            return decoded;
        } catch (err) {
            logger.error(`Failed to decode license data: ${err.message}`);
            return null;
        }
    }
};
