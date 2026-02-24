const mongoose = require('mongoose');

const MenuSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true }, // e.g., 'Starters', 'Main', 'Drinks'
    price: { type: Number, required: true },
    description: String,
    image: String,
    isSpicy: { type: Boolean, default: false },
    isVeg: { type: Boolean, default: false },
    available: { type: Boolean, default: true }
});

module.exports = mongoose.model('menu', MenuSchema);