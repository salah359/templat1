const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    storeName: { type: String, default: 'My Restaurant' },
    currency: { type: String, default: '₪' },
    deliveryFee: { type: Number, default: 15 },
    primaryColor: { type: String, default: '#D4AF37' }, // Default Gold
    whatsappNumber: { type: String, default: '' },
    heroTitle: { type: String, default: 'Taste the Extraordinary' },
    heroSubtitle: { type: String, default: 'Fine Dining & Delivery' }
});

module.exports = mongoose.model('setting', SettingSchema);