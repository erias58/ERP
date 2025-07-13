
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('postgres://root:root@localhost:5432/erp_offline', {
    logging: false
});

const Tenant = require('./tenant')(sequelize, DataTypes);
const Company = require('./company')(sequelize, DataTypes);
const User = require('./user')(sequelize, DataTypes);
const LicenseKey = require('./licenseKey')(sequelize, DataTypes);
const Feature = require('./feature')(sequelize, DataTypes);
const TenantConfig = require('./tenantConfig')(sequelize, DataTypes);
const APIKey = require('./apiKey')(sequelize, DataTypes);
const Backup = require('./backup')(sequelize, DataTypes);
const Product = require('./product')(sequelize, DataTypes);
const Sale = require('./sale')(sequelize, DataTypes);
const Purchase = require('./purchase')(sequelize, DataTypes);
const Pos = require('./pos')(sequelize, DataTypes);
const Accounting = require('./accounting')(sequelize, DataTypes);
const SyncQueue = require('./syncQueue')(sequelize, DataTypes);

Tenant.hasMany(Company, { foreignKey: 'tenantId' });
Company.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(User, { foreignKey: 'tenantId' });
User.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(LicenseKey, { foreignKey: 'tenantId' });
LicenseKey.belongsTo(Tenant, { foreignKey: 'tenantId' });
LicenseKey.belongsTo(Company, { foreignKey: 'companyId' });
Tenant.hasMany(Feature, { foreignKey: 'tenantId' });
Feature.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(TenantConfig, { foreignKey: 'tenantId' });
TenantConfig.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(APIKey, { foreignKey: 'tenantId' });
APIKey.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Backup, { foreignKey: 'tenantId' });
Backup.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Product, { foreignKey: 'tenantId' });
Product.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Sale, { foreignKey: 'tenantId' });
Sale.belongsTo(Tenant, { foreignKey: 'tenantId' });
Sale.belongsTo(Product, { foreignKey: 'productId' });
Tenant.hasMany(Purchase, { foreignKey: 'tenantId' });
Purchase.belongsTo(Tenant, { foreignKey: 'tenantId' });
Purchase.belongsTo(Product, { foreignKey: 'productId' });
Tenant.hasMany(Pos, { foreignKey: 'tenantId' });
Pos.belongsTo(Tenant, { foreignKey: 'tenantId' });
Pos.belongsTo(Product, { foreignKey: 'productId' });
Tenant.hasMany(Accounting, { foreignKey: 'tenantId' });
Accounting.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(SyncQueue, { foreignKey: 'tenantId' });
SyncQueue.belongsTo(Tenant, { foreignKey: 'tenantId' });

module.exports = { sequelize, Tenant, Company, User, LicenseKey, Feature, TenantConfig, APIKey, Backup, Product, Sale, Purchase, Pos, Accounting, SyncQueue };
