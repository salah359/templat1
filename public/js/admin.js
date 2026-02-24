const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboard();
});

// --- NAVIGATION LOGIC ---
function showSection(id) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(el => el.classList.add('d-none'));
    // Show selected section
    document.getElementById(id).classList.remove('d-none');
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Load data for the section
    if(id === 'products') loadProducts();
    if(id === 'orders') loadOrders();
    if(id === 'reservations') loadReservations();
    if(id === 'settings') loadSettings();
}

// --- AUTHENTICATION ---
async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/check-auth`);
        if (!res.ok) throw new Error('Not Authenticated');
    } catch (e) {
        window.location.href = '/login';
    }
}

async function logout() {
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    window.location.href = '/login';
}

// --- DASHBOARD STATS ---
async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const data = await res.json();
        
        document.getElementById('statRevenue').innerText = `₪${data.revenue}`;
        document.getElementById('statOrders').innerText = data.orderCount;
        document.getElementById('statProducts').innerText = data.productCount;
        document.getElementById('statReservations').innerText = data.reservationCount;
        
        // Render Chart
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        if (window.myChart) window.myChart.destroy();
        
        window.myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Revenue', 'Orders', 'Bookings', 'Products'],
                datasets: [{
                    label: 'Store Metrics',
                    data: [data.revenue, data.orderCount, data.reservationCount, data.productCount],
                    backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#0dcaf0'],
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    } catch (e) { console.error("Stats load failed", e); }
}

// --- PRODUCT MANAGEMENT ---
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        const products = await res.json();
        const tbody = document.getElementById('productTableBody');
        
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No products found. Add one!</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>
                    <img src="${(p.images && p.images[0]) ? p.images[0] : 'https://via.placeholder.com/50'}" 
                         width="50" height="50" class="rounded object-fit-cover">
                </td>
                <td class="fw-bold">${p.name}</td>
                <td><span class="badge bg-secondary">${p.category}</span></td>
                <td>₪${p.price}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p._id}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error("Product load failed", e); }
}

window.openProductModal = () => new bootstrap.Modal(document.getElementById('productModal')).show();

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const formData = new FormData(e.target);
        const res = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            alert("Product Added Successfully!");
            bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
            e.target.reset();
            loadProducts();
            loadDashboard(); // Refresh stats
        } else {
            const err = await res.json();
            alert("Failed: " + err.error);
        }
    } catch (error) {
        alert("Network Error: Could not save product.");
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    loadProducts();
    loadDashboard();
}

// --- ORDER MANAGEMENT ---
async function loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/orders`);
        const orders = await res.json();
        const tbody = document.getElementById('orderTableBody');

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No orders yet.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td><span class="badge bg-light text-dark border">#${o._id.slice(-6)}</span></td>
                <td>
                    <strong>${o.customerName}</strong><br>
                    <small class="text-muted">${o.phone}</small>
                </td>
                <td>${o.items.length} items</td>
                <td class="fw-bold">₪${o.total}</td>
                <td><span class="badge bg-success">${o.status}</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error("Orders load failed", e); }
}

// --- RESERVATION MANAGEMENT ---
async function loadReservations() {
    try {
        const res = await fetch(`${API_BASE}/reservations`);
        const reservations = await res.json();
        const tbody = document.getElementById('reservationTableBody');

        if (reservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No bookings found.</td></tr>';
            return;
        }

        tbody.innerHTML = reservations.map(r => `
            <tr>
                <td class="fw-bold">${r.name}</td>
                <td>${r.people} Guests</td>
                <td>${r.date} at ${r.time}</td>
                <td><span class="badge bg-info text-dark">${r.status}</span></td>
            </tr>
        `).join('');
    } catch (e) { console.error("Reservations load failed", e); }
}

// --- SETTINGS MANAGEMENT ---
async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/settings`);
        const data = await res.json();
        if (data) {
            document.getElementById('setStoreName').value = data.storeName || '';
            document.getElementById('setCurrency').value = data.currency || '';
            document.getElementById('setWhatsapp').value = data.whatsappNumber || '';
            document.getElementById('setColor').value = data.primaryColor || '#D4AF37';
        }
    } catch (e) { console.error("Settings load failed", e); }
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        storeName: document.getElementById('setStoreName').value,
        currency: document.getElementById('setCurrency').value,
        whatsappNumber: document.getElementById('setWhatsapp').value,
        primaryColor: document.getElementById('setColor').value
    };

    try {
        const res = await fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) alert("Settings Saved! Refresh your website to see changes.");
        else alert("Failed to save settings.");
    } catch (e) { alert("Network Error"); }
});