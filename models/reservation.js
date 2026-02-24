const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    people: { type: Number, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    phone: { type: String }, 
    status: { type: String, default: 'Pending' }, // Pending, Confirmed, Cancelled
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('reservation', ReservationSchema);