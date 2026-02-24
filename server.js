require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Storage } = require('@google-cloud/storage');

// --- IMPORT DATABASE MODELS ---
// Note: Ensure these filenames match exactly what is in your models folder
const Product = require('./models/product'); 
const Setting = require('./models/setting');
const Order = require('./models/order');
const Reservation = require('./models/reservation');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_secret_key_change_me';
const ADMIN_PASS = process.env.ADMIN_PASS || 'busy123';
const SALT = bcrypt.genSaltSync(12);
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASS, SALT);

// --- CLOUD STORAGE SETUP ---
let storageGCS;
if (process.env.GCS_KEY_CONTENT) {
    try {
        const credentials = JSON.parse(process.env.GCS_KEY_CONTENT);
        storageGCS = new Storage({ credentials, projectId: credentials.project_id });
        console.log("☁️ GCS initialized via Environment Variable");
    } catch (err) { console.error("GCS Key Error", err); }
} else {
    storageGCS = new Storage({ keyFilename: process.env.GCS_KEY_FILE || './gcs-key.json', projectId: process.env.GCP_PROJECT_ID });
    console.log("📂 GCS initialized via local key file");
}
const bucket = storageGCS.bucket(process.env.GCS_BUCKET_NAME || 'bellakids-images');

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- DATABASE CONNECTION ---
const dbURI = process.env.MONGO_URI;
if (!dbURI) console.error("❌ ERROR: MONGO_URI is not defined!");

mongoose.connect(dbURI)
    .then(async () => {
        console.log("✨ MongoDB Connected Successfully");
        // Create default settings if they don't exist
        const settings = await Setting.findOne();
        if (!settings) {
            await new Setting().save();
            console.log("⚙️ Default Settings Created");
        }
    })
    .catch(err => console.error("❌ DB Connection Error:", err));

// --- IMAGE UPLOAD CONFIG ---
const upload = multer({ storage: multer.memoryStorage() });

const uploadToGCS = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({ resumable: false, metadata: { contentType: file.mimetype } });
        
        blobStream.on('error', (err) => {
            console.error("GCS Upload Error:", err);
            resolve(null);
        });
        
        blobStream.on('finish', () => resolve(`https://storage.googleapis.com/${bucket.name}/${blob.name}`));
        blobStream.end(file.buffer);
    });
};

// --- AUTH MIDDLEWARE ---
const requireAuth = (req, res, next) => {
    const token = req.cookies?.adminToken || req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Unauthorized access" });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

// --- ROUTES: AUTH ---
app.post('/api/login', (req, res) => {
    if (bcrypt.compareSync(req.body.password, ADMIN_HASH)) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('adminToken', token, { httpOnly: true, maxAge: 86400000 });
        res.json({ success: true, token });
    } else res.status(401).json({ success: false });
});

app.post('/api/logout', (req, res) => { res.clearCookie('adminToken'); res.json({ success: true }); });
app.get('/api/check-auth', requireAuth, (req, res) => res.json({ loggedIn: true }));

// --- ROUTES: PRODUCTS ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ category: 1, createdAt: -1 });
        res.json(products);
    } catch (err) { res.status(500).json({ error: "Failed to fetch products" }); }
});

app.post('/api/products', requireAuth, upload.array('images'), async (req, res) => {
    try {
        let imageUrls = [];
        if (req.files && req.files.length > 0) imageUrls = await Promise.all(req.files.map(f => uploadToGCS(f)));
        
        const newProduct = new Product({
            name: req.body.name,
            price: Number(req.body.price),
            description: req.body.description,
            category: req.body.category,
            images: imageUrls.filter(url => url !== null),
            isPopular: req.body.isPopular === 'true'
        });
        await newProduct.save();
        res.json(newProduct);
    } catch (err) { res.status(500).json({ error: "Failed to save product" }); }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

// --- ROUTES: ORDERS ---
app.get('/api/orders', requireAuth, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
        res.json(orders);
    } catch (err) { res.status(500).json({ error: "Failed to fetch orders" }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.json({ success: true, orderId: newOrder._id });
    } catch (err) { res.status(500).json({ error: "Failed to place order" }); }
});

// NEW: Update Order Status (Tick off)
app.put('/api/orders/:id', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status: status });
        res.json({ success: true });
    } catch (err) {
        console.error("Order Update Error:", err);
        res.status(500).json({ error: "Failed to update order status" });
    }
});

// --- ROUTES: RESERVATIONS ---
app.get('/api/reservations', requireAuth, async (req, res) => {
    try {
        const reservations = await Reservation.find().sort({ createdAt: -1 }).limit(100);
        res.json(reservations);
    } catch (err) { res.status(500).json({ error: "Failed to fetch reservations" }); }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const newRes = new Reservation(req.body);
        await newRes.save();
        res.json({ success: true, id: newRes._id });
    } catch (err) { res.status(500).json({ error: "Failed to book" }); }
});

// NEW: Update Reservation Status (Tick off)
app.put('/api/reservations/:id', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        await Reservation.findByIdAndUpdate(req.params.id, { status: status });
        res.json({ success: true });
    } catch (err) {
        console.error("Reservation Update Error:", err);
        res.status(500).json({ error: "Failed to update reservation" });
    }
});

// --- ROUTES: SETTINGS & STATS ---
app.get('/api/settings', async (req, res) => res.json(await Setting.findOne() || {}));
app.put('/api/settings', requireAuth, async (req, res) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) settings = new Setting(req.body);
        else Object.assign(settings, req.body);
        await settings.save();
        res.json(settings);
    } catch (err) { res.status(500).json({ error: "Failed settings" }); }
});

app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const reservationCount = await Reservation.countDocuments();
        const revenueResult = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]);
        res.json({ productCount, orderCount, reservationCount, revenue: revenueResult.length ? revenueResult[0].total : 0 });
    } catch (err) { res.json({ productCount:0, orderCount:0, reservationCount:0, revenue:0 }); }
});

// --- SERVE FILES ---
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
