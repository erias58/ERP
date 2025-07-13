
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const { User, Tenant, Company, LicenseKey, Product, Sale, Purchase, Pos, Accounting, SyncQueue } = require('./models');
const LicenseValidator = require('./utils/licenseValidator');
const FeatureManager = require('./utils/featureManager');
const BackupManager = require('./utils/backupManager');
const ReportGenerator = require('./utils/reportGenerator');
const SyncManager = require('./utils/syncManager');
const fs = require('fs');
const path = require('path');
const logger = require('winston');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:8000', credentials: true }));
app.use(express.json());

// Logger setup
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
logger.configure({
    transports: [
        new logger.transports.File({ filename: path.join(logDir, 'security.log'), level: 'info' })
    ]
});

// Database setup
const sequelize = new Sequelize('postgres://root:root@localhost:5432/erp_offline', {
    logging: false
});

// JWT settings
const SECRET_KEY = Buffer.from(crypto.randomBytes(32)).toString('hex');
const ACCESS_TOKEN_EXPIRE_MINUTES = 30;

// Directory setup
const BASE_DIR = __dirname;
const BACKUP_DIR = path.join(BASE_DIR, 'backups');
const FEATURE_DIR = path.join(BASE_DIR, 'features', 'downloaded');
const REPORT_DIR = path.join(BASE_DIR, 'reports');
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(FEATURE_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

// Serve reports
app.use('/reports', express.static(REPORT_DIR));

// Middleware to verify JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ detail: 'Authentication required' });

    try {
        const payload = jwt.verify(token, SECRET_KEY);
        req.user = await User.findOne({ where: { username: payload.sub } });
        if (!req.user) throw new Error('User not found');
        next();
    } catch (err) {
        res.status(401).json({ detail: 'Invalid token' });
    }
};

// Register
app.post('/api/v1/users/register/', async (req, res) => {
    try {
        const { username, password, email, tenant_id, tenant_name } = req.body;
        if (await User.findOne({ where: { username } })) {
            return res.status(400).json({ detail: 'Username already exists' });
        }

        let tenant = await Tenant.findOne({ where: { tenant_id } });
        if (!tenant) {
            tenant = await Tenant.create({ tenant_id, name: tenant_name });
        }

        const company = await Company.create({ tenantId: tenant.id, name: tenant_name });
        const hashedPassword = require('bcrypt').hashSync(password, 10);
        const user = await User.create({
            username,
            email,
            hashedPassword,
            tenantId: tenant.id
        });

        const licenseValid = await LicenseValidator.fetchLicensesFromMainApi(tenant_id, null, sequelize);
        await BackupManager.createBackup(tenant_id, sequelize);
        logger.info(`User ${username} registered for tenant ${tenant_id}`);
        res.status(201).json({
            user: { id: user.id, username: user.username, email: user.email },
            license_valid: licenseValid
        });
    } catch (err) {
        logger.error(`Registration failed: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Login
app.post('/api/v1/users/login/', async (req, res) => {
    try {
        const { username, password, tenant_id } = req.body;
        const user = await User.findOne({ where: { username } });
        if (!user || !require('bcrypt').compareSync(password, user.hashedPassword)) {
            logger.error(`Authentication failed for ${username}`);
            return res.status(401).json({ detail: 'Invalid credentials' });
        }

        const tenant = await Tenant.findOne({ where: { tenant_id } });
        if (!tenant) {
            logger.error(`Tenant ${tenant_id} not found`);
            return res.status(400).json({ detail: 'Invalid tenant' });
        }

        const accessToken = jwt.sign({ sub: username }, SECRET_KEY, { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` });
        const licenseValid = !!(await LicenseKey.findOne({ where: { tenantId: tenant.id, isActive: true } }));
        logger.info(`User ${username} logged in for tenant ${tenant_id}`);
        res.json({
            access: accessToken,
            refresh: accessToken, // Simplified, no refresh token
            is_limited_access: !licenseValid
        });
    } catch (err) {
        logger.error(`Login failed: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Request License
app.post('/api/v1/users/request_license/', authenticateToken, async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { tenant_id } = req.body;
    if (tenantId !== tenant_id) {
        return res.status(400).json({ detail: 'Tenant ID mismatch' });
    }

    try {
        const success = await LicenseValidator.fetchLicensesFromMainApi(tenant_id, req.headers['authorization'].split(' ')[1], sequelize);
        if (success) {
            logger.info(`License requested for tenant ${tenant_id}`);
            return res.json({ status: 'License granted' });
        }
        res.status(400).json({ detail: 'Failed to fetch license' });
    } catch (err) {
        logger.error(`License request failed for tenant ${tenant_id}: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Verify License
app.post('/api/v1/licenses/verify/', async (req, res) => {
    const { license_key, signature } = req.body;
    const tenantId = req.headers['x-tenant-id'];
    if (!license_key || !signature || !tenantId) {
        return res.status(400).json({ detail: 'Missing required fields' });
    }

    try {
        const isValid = LicenseValidator.verifyLicense(license_key, signature);
        if (isValid) {
            const data = LicenseValidator.decodeLicenseData(license_key);
            if (data && data.tenant_id === tenantId) {
                logger.info(`License verified for tenant ${tenantId}`);
                return res.json({ valid: true, features: data.features || [] });
            }
        }
        logger.error(`License verification failed for tenant ${tenantId}`);
        res.json({ valid: false, features: [] });
    } catch (err) {
        logger.error(`License verification failed: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Download Feature
app.get('/api/v1/features/:featureId/download/', authenticateToken, async (req, res) => {
    const { featureId } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    try {
        const success = await FeatureManager.downloadFeature(featureId, tenantId, req.headers['authorization'].split(' ')[1], sequelize);
        if (success) {
            logger.info(`Feature ${featureId} downloaded for tenant ${tenantId}`);
            return res.json({ status: 'Feature code downloaded' });
        }
        res.status(400).json({ detail: 'Failed to download feature' });
    } catch (err) {
        logger.error(`Feature download failed for tenant ${tenantId}: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Inventory: Add Product
app.post('/api/v1/inventory/products/', authenticateToken, async (req, res) => {
    const { name, description, quantity, price } = req.body;
    const tenantId = req.headers['x-tenant-id'];
    try {
        const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
        if (!tenant) return res.status(400).json({ detail: 'Invalid tenant' });

        const product = await Product.create({
            tenantId: tenant.id,
            name,
            description,
            quantity,
            price
        });
        logger.info(`Product ${name} added for tenant ${tenantId}`);
        res.status(201).json({ id: product.id, name, quantity, price });
    } catch (err) {
        logger.error(`Failed to add product: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Inventory: Get Products
app.get('/api/v1/inventory/products/', authenticateToken, async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    try {
        const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
        if (!tenant) return res.status(400).json({ detail: 'Invalid tenant' });

        const products = await Product.findAll({ where: { tenantId: tenant.id } });
        res.json(products);
    } catch (err) {
        logger.error(`Failed to fetch products: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Sales: Create Sale
app.post('/api/v1/sales/', authenticateToken, async (req, res) => {
    const { productId, quantity, totalAmount } = req.body;
    const tenantId = req.headers['x-tenant-id'];
    try {
        const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
        if (!tenant) return res.status(400).json({ detail: 'Invalid tenant' });

        const product = await Product.findOne({ where: { id: productId, tenantId: tenant.id } });
        if (!product) return res.status(400).json({ detail: 'Product not found' });
        if (product.quantity < quantity) return res.status(400).json({ detail: 'Insufficient stock' });

        product.quantity -= quantity;
        await product.save();

        const sale = await Sale.create({
            tenantId: tenant.id,
            productId,
            quantity,
            totalAmount
        });

        await Accounting.create({
            tenantId: tenant.id,
            transactionType: 'sale',
            amount: totalAmount,
            description: `Sale of ${quantity} ${product.name}`
        });

        await SyncQueue.create({
            tenantId: tenant.id,
            operation: 'sale',
            data: JSON.stringify({ productId, quantity, totalAmount })
        });

        logger.info(`Sale recorded for product ${productId}, tenant ${tenantId}`);
        res.status(201).json({ id: sale.id, productId, quantity, totalAmount });
    } catch (err) {
        logger.error(`Failed to record sale: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Purchases: Create Purchase
app.post('/api/v1/purchases/', authenticateToken, async (req, res) => {
    const { productId, quantity, totalAmount } = req.body;
    const tenantId = req.headers['x-tenant-id'];
    try {
        const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
        if (!tenant) return res.status(400).json({ detail: 'Invalid tenant' });

        const product = await Product.findOne({ where: { id: productId, tenantId: tenant.id } });
        if (!product) return res.status(400).json({ detail: 'Product not found' });

        product.quantity += quantity;
        await product.save();

        const purchase = await Purchase.create({
            tenantId: tenant.id,
            productId,
            quantity,
            totalAmount
        });

        await Accounting.create({
            tenantId: tenant.id,
            transactionType: 'purchase',
            amount: -totalAmount,
            description: `Purchase of ${quantity} ${product.name}`
        });

        logger.info(`Purchase recorded for product ${productId}, tenant ${tenantId}`);
        res.status(201).json({ id: purchase.id, productId, quantity, totalAmount });
    } catch (err) {
        logger.error(`Failed to record purchase: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// POS: Create Transaction
app.post('/api/v1/pos/', authenticateToken, async (req, res) => {
    const { productId, quantity, totalAmount } = req.body;
    const tenantId = req.headers['x-tenant-id'];
    try {
        const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
        if (!tenant) return res.status(400).json({ detail: 'Invalid tenant' });

        const product = await Product.findOne({ where: { id: productId, tenantId: tenant.id } });
        if (!product) return res.status(400).json({ detail: 'Product not found' });
        if (product.quantity < quantity) return res.status(400).json({ detail: 'Insufficient stock' });

        product.quantity -= quantity;
        await product.save();

        const pos = await Pos.create({
            tenantId: tenant.id,
            productId,
            quantity,
            totalAmount
        });

        await Accounting.create({
            tenantId: tenant.id,
            transactionType: 'pos',
            amount: totalAmount,
            description: `POS sale of ${quantity} ${product.name}`
        });

        await SyncQueue.create({
            tenantId: tenant.id,
            operation: 'pos',
            data: JSON.stringify({ productId, quantity, totalAmount })
        });

        logger.info(`POS transaction recorded for product ${productId}, tenant ${tenantId}`);
        res.status(201).json({ id: pos.id, productId, quantity, totalAmount });
    } catch (err) {
        logger.error(`Failed to record POS transaction: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Generate Report
app.get('/api/v1/reports/:type/', authenticateToken, async (req, res) => {
    const { type } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    try {
        const tenant = await Tenant.findOne({ where: { tenant_id: tenantId } });
        if (!tenant) return res.status(400).json({ detail: 'Invalid tenant' });

        const reportPath = await ReportGenerator.generateReport(type, tenant.id, sequelize);
        logger.info(`Report ${type} generated for tenant ${tenantId}`);
        res.json({ report_url: `/reports/${path.basename(reportPath)}` });
    } catch (err) {
        logger.error(`Failed to generate report ${type}: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Sync Transactions
app.post('/api/v1/sync/', authenticateToken, async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    try {
        const success = await SyncManager.syncTransactions(tenantId, req.headers['authorization'].split(' ')[1], sequelize);
        if (success) {
            logger.info(`Transactions synced for tenant ${tenantId}`);
            return res.json({ status: 'Sync successful' });
        }
        res.status(400).json({ detail: 'Sync failed' });
    } catch (err) {
        logger.error(`Sync failed for tenant ${tenantId}: ${err.message}`);
        res.status(400).json({ detail: err.message });
    }
});

// Initialize database and start server
sequelize.sync().then(() => {
    app.listen(8000, () => {
        console.log('Server running on http://localhost:8000');
    });
}).catch(err => {
    console.error('Database connection failed:', err);
});
