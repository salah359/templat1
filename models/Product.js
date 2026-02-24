const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    category: { 
        type: String, 
        required: true, 
        enum: ['Starters', 'Mains', 'Drinks', 'Desserts', 'Hookah', 'Kids', 'Sides'], 
        default: 'Mains' 
    },
    images: [String], // Stores array of image URLs
    inStock: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false }, // Feature item on home page
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
