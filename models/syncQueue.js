module.exports = (sequelize, DataTypes) => {
    const SyncQueue = sequelize.define('SyncQueue', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        tenantId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        operation: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        data: {
            type: DataTypes.JSON,
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'sync_queue',
        timestamps: false
    });
    return SyncQueue;
};