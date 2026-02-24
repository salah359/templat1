const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboard();
});

function showSection(id) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('d-none'));
    document.getElementById(id).classList.remove('d-none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    if(id === 'products') loadProducts();
    if(id === 'orders') loadOrders();
    if(id === 'reservations') loadReservations();
    if(id === 'settings') loadSettings();
}

async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/check-auth`);
        if (!res.ok) throw new Error('Not Authenticated');
    } catch (e) { window.location.href = '/login'; }
}

async function logout() {
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    window.location.href = '/login';
}

// --- DASHBOARD ---
async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const data = await res.json();
        document.getElementById('statRevenue').innerText = `₪${data.revenue}`;
        document.getElementById('statOrders').innerText = data.orderCount;
        document.getElementById('statProducts').innerText = data.productCount;
        document.getElementById('statReservations').innerText = data.reservationCount;
        
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        if (window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Revenue', 'Orders', 'Bookings', 'Products'],
                datasets: [{ label: 'Metrics', data: [data.revenue, data.orderCount, data.reservationCount, data.productCount], backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#0dcaf0'] }]
            }
        });
    } catch (e) {}
}

// --- PRODUCTS ---
async function loadProducts() {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    document.getElementById('productTableBody').innerHTML = products.map(p => `
        <tr>
            <td><img src="${(p.images && p.images[0]) ? p.images[0] : 'https://via.placeholder.com/50'}" width="50" height="50" class="rounded object-fit-cover"></td>
            <td class="fw-bold">${p.name}</td><td><span class="badge bg-secondary">${p.category}</span></td><td>₪${p.price}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p._id}')">Delete</button></td>
        </tr>
    `).join('');
}

window.openProductModal = () => new bootstrap.Modal(document.getElementById('productModal')).show();

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Saving..."; btn.disabled = true;
    try {
        const formData = new FormData(e.target);
        const res = await fetch(`${API_BASE}/products`, { method: 'POST', body: formData });
        if (res.ok) { alert("Success!"); bootstrap.Modal.getInstance(document.getElementById('productModal')).hide(); e.target.reset(); loadProducts(); loadDashboard(); } 
        else alert("Failed!");
    } catch (err) { alert("Error!"); }
    btn.innerText = "Save Product"; btn.disabled = false;
});

async function deleteProduct(id) {
    if (!confirm("Delete this item?")) return;
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    loadProducts(); loadDashboard();
}

// --- ORDERS (UPDATED) ---
async function loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/orders`);
        const orders = await res.json();
        const tbody = document.getElementById('orderTableBody');

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">No orders yet.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td><span class="badge bg-light text-dark border">#${o._id.slice(-4)}</span></td>
                <td>
                    <strong>${o.customerName}</strong><br>
                    <small class="text-muted">${o.phone}</small>
                </td>
                <td style="max-width: 200px; word-wrap: break-word;">${o.address || 'N/A'}</td>
                <td>${o.items.length} items</td>
                <td class="fw-bold">₪${o.total}</td>
                <td><span class="badge ${o.status === 'Completed' ? 'bg-success' : 'bg-warning text-dark'}">${o.status}</span></td>
                <td>
                    ${o.status !== 'Completed' ? 
                    `<button class="btn btn-sm btn-success" onclick="updateOrderStatus('${o._id}', 'Completed')"><i class="bi bi-check-lg"></i> Complete</button>` 
                    : '<span class="text-muted"><i class="bi bi-check-all"></i> Done</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error("Error loading orders", e); }
}

async function updateOrderStatus(id, status) {
    if (!confirm("Mark this order as complete?")) return;
    await fetch(`${API_BASE}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    loadOrders(); // Refresh table
}

// --- RESERVATIONS (UPDATED) ---
async function loadReservations() {
    try {
        const res = await fetch(`${API_BASE}/reservations`);
        const reservations = await res.json();
        const tbody = document.getElementById('reservationTableBody');

        if (reservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No bookings found.</td></tr>';
            return;
        }

        tbody.innerHTML = reservations.map(r => `
            <tr>
                <td class="fw-bold">${r.name}</td>
                <td>${r.people} Guests</td>
                <td>${r.date} at ${r.time}</td>
                <td><span class="badge ${r.status === 'Completed' ? 'bg-success' : 'bg-info text-dark'}">${r.status}</span></td>
                <td>
                    ${r.status !== 'Completed' ? 
                    `<button class="btn btn-sm btn-success" onclick="updateReservationStatus('${r._id}', 'Completed')"><i class="bi bi-check-lg"></i> Arrived</button>` 
                    : '<span class="text-muted"><i class="bi bi-check-all"></i> Seated</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error("Error loading reservations", e); }
}

async function updateReservationStatus(id, status) {
    if (!confirm("Mark reservation as arrived?")) return;
    await fetch(`${API_BASE}/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    loadReservations(); // Refresh table
}

// --- SETTINGS ---
async function loadSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    const data = await res.json();
    if (data) {
        document.getElementById('setStoreName').value = data.storeName || '';
        document.getElementById('setCurrency').value = data.currency || '';
        document.getElementById('setWhatsapp').value = data.whatsappNumber || '';
        document.getElementById('setColor').value = data.primaryColor || '#D4AF37';
    }
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        storeName: document.getElementById('setStoreName').value,
        currency: document.getElementById('setCurrency').value,
        whatsappNumber: document.getElementById('setWhatsapp').value,
        primaryColor: document.getElementById('setColor').value
    };
    await fetch(`${API_BASE}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    alert("Settings Saved!");
});
