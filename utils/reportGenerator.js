
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('winston');
const { Sale, Purchase, Product } = require('../models');

class ReportGenerator {
    static async generateReport(type, tenantId, sequelize) {
        try {
            const doc = new PDFDocument();
            const reportPath = path.join(__dirname, '..', 'reports', `${type}_report_${tenantId}_${Date.now()}.pdf`);
            const writeStream = fs.createWriteStream(reportPath);
            doc.pipe(writeStream);

            doc.fontSize(16).text(`${type.toUpperCase()} Report`, { align: 'center' });
            doc.moveDown();

            if (type === 'sales') {
                const sales = await Sale.findAll({ where: { tenantId }, include: ['Product'] });
                doc.fontSize(12).text('Sales Report', { underline: true });
                doc.moveDown();
                sales.forEach(sale => {
                    doc.text(`Sale ID: ${sale.id}, Product: ${sale.Product.name}, Quantity: ${sale.quantity}, Total: $${sale.totalAmount}`);
                });
            } else if (type === 'purchases') {
                const purchases = await Purchase.findAll({ where: { tenantId }, include: ['Product'] });
                doc.fontSize(12).text('Purchases Report', { underline: true });
                doc.moveDown();
                purchases.forEach(purchase => {
                    doc.text(`Purchase ID: ${purchase.id}, Product: ${purchase.Product.name}, Quantity: ${purchase.quantity}, Total: $${purchase.totalAmount}`);
                });
            } else if (type === 'inventory') {
                const products = await Product.findAll({ where: { tenantId } });
                doc.fontSize(12).text('Inventory Report', { underline: true });
                doc.moveDown();
                products.forEach(product => {
                    doc.text(`Product: ${product.name}, Quantity: ${product.quantity}, Price: $${product.price}`);
                });
            } else {
                throw new Error('Invalid report type');
            }

            doc.end();
            await new Promise(resolve => writeStream.on('finish', resolve));
            logger.info(`Generated ${type} report for tenant ${tenantId}`);
            return reportPath;
        } catch (err) {
            logger.error(`Failed to generate ${type} report: ${err.message}`);
            throw err;
        }
    }
}

module.exports = ReportGenerator;
