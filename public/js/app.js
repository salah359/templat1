let CONFIG = { 
    CURRENCY: '₪', 
    WHATSAPP_PHONE: '972598439251', 
    STORE_NAME: 'Velvet',
    DELIVERY_FEE: 0
};

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('VELVET_CART')) || [];

document.addEventListener('DOMContentLoaded', () => {
    initStore();
    updateCartUI();

    // Attach Reservation Listener
    const resForm = document.getElementById('reservationForm');
    if (resForm) {
        resForm.addEventListener('submit', handleReservation);
    }

    // Attach Checkout Listener
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckout);
    }
});

// --- INITIALIZATION ---
async function initStore() {
    try {
        // 1. Fetch Settings
        const settingsRes = await fetch('/api/settings');
        const settings = await settingsRes.json();

        // Apply Settings
        if (settings.storeName) {
            CONFIG.STORE_NAME = settings.storeName;
            document.title = settings.storeName;
            document.querySelectorAll('.logo-text').forEach(el => el.innerText = settings.storeName);
        }
        if (settings.currency) CONFIG.CURRENCY = settings.currency;
        if (settings.whatsappNumber) CONFIG.WHATSAPP_PHONE = settings.whatsappNumber;
        if (settings.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        }

        // 2. Fetch Products
        const productRes = await fetch('/api/products');
        allProducts = await productRes.json();
        
        // Render Initial Menu (All items)
        renderMenu(allProducts);

    } catch (e) {
        console.error("Initialization Failed:", e);
        document.getElementById('menu-grid').innerHTML = '<div class="text-center w-100 text-danger">Failed to load menu.</div>';
    }
}

// --- MENU RENDERING ---
function renderMenu(items) {
    const grid = document.getElementById('menu-grid');
    
    if (items.length === 0) {
        grid.innerHTML = '<div class="text-center w-100 text-muted p-5">No items found in this category.</div>';
        return;
    }

    grid.innerHTML = items.map(item => {
        // Use placeholder if no image
        const img = (item.images && item.images.length > 0) ? item.images[0] : null;
        
        return `
        <div class="menu-item" onclick="addToCart('${item._id}')">
            ${img ? `<img src="${img}" class="menu-img rounded" alt="${item.name}">` : ''}
            <div class="d-flex justify-content-between align-items-start mb-2">
                <h5 class="mb-0 text-white brand-font">${item.name}</h5>
                <span class="text-gold fw-bold">${CONFIG.CURRENCY}${item.price}</span>
            </div>
            <p class="text-muted small mb-0">${item.description || ''}</p>
        </div>
        `;
    }).join('');
}

window.filterMenu = (category) => {
    // Update Active Button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText === category || (category === 'all' && btn.innerText === 'All')) {
            btn.classList.add('active');
        }
    });

    // Filter Logic
    if (category === 'all') {
        renderMenu(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === category);
        renderMenu(filtered);
    }
};

// --- RESERVATION LOGIC ---
async function handleReservation(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Booking...";
    btn.disabled = true;

    const bookingData = {
        name: document.getElementById('resName').value,
        people: document.getElementById('resPeople').value,
        date: document.getElementById('resDate').value,
        time: document.getElementById('resTime').value
    };

    try {
        const res = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        if (res.ok) {
            alert(`Table booked for ${bookingData.name}! We will see you then.`);
            e.target.reset();
        } else {
            alert("Booking failed. Please try again.");
        }
    } catch (err) {
        alert("Network Error: Could not book table.");
    }

    btn.innerText = originalText;
    btn.disabled = false;
}

// --- CART LOGIC ---
window.addToCart = (id) => {
    const product = allProducts.find(p => p._id === id);
    if (!product) return;

    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({
            id: product._id,
            name: product.name,
            price: product.price,
            qty: 1
        });
    }
    
    saveCart();
    // Show Cart Sidebar
    new bootstrap.Offcanvas(document.getElementById('cartSidebar')).show();
};

window.removeFromCart = (idx) => {
    cart.splice(idx, 1);
    saveCart();
};

function saveCart() {
    localStorage.setItem('VELVET_CART', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const countBadge = document.getElementById('cartCount');
    const itemsContainer = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');

    // Update Count
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    countBadge.innerText = totalQty;
    
    // Calculate Total
    let totalPrice = 0;

    // Render Items
    if (cart.length === 0) {
        itemsContainer.innerHTML = '<div class="text-center text-muted mt-5">Your order is empty.</div>';
    } else {
        itemsContainer.innerHTML = cart.map((item, index) => {
            totalPrice += item.price * item.qty;
            return `
            <div class="d-flex justify-content-between align-items-center mb-3 bg-secondary bg-opacity-10 p-2 rounded">
                <div>
                    <div class="fw-bold">${item.name}</div>
                    <small class="text-muted">${item.qty} x ${CONFIG.CURRENCY}${item.price}</small>
                </div>
                <button class="btn btn-sm text-danger" onclick="removeFromCart(${index})">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            `;
        }).join('');
    }
    
    totalEl.innerText = CONFIG.CURRENCY + totalPrice.toFixed(2);
}

// --- CHECKOUT LOGIC ---
window.openCheckoutModal = () => {
    if (cart.length === 0) return alert("Your cart is empty!");
    new bootstrap.Modal(document.getElementById('checkoutModal')).show();
};

async function handleCheckout(e) {
    e.preventDefault();
    
    const orderData = {
        customerName: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        address: document.getElementById('custAddress').value,
        items: cart.map(i => ({ productName: i.name, qty: i.qty, price: i.price })),
        total: cart.reduce((acc, item) => acc + (item.price * item.qty), 0)
    };

    try {
        // 1. Save Order to DB
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        const data = await res.json();
        
        if (data.success) {
            // 2. Format WhatsApp Message
            let msg = `*New Order: ${CONFIG.STORE_NAME}*\n`;
            msg += `Order ID: #${data.orderId.slice(-6)}\n`;
            msg += `Name: ${orderData.customerName}\n`;
            msg += `Phone: ${orderData.phone}\n`;
            msg += `Address: ${orderData.address}\n\n`;
            msg += `*Order Details:*\n`;
            
            orderData.items.forEach(item => {
                msg += `- ${item.productName} (x${item.qty}) - ${CONFIG.CURRENCY}${item.price * item.qty}\n`;
            });
            
            msg += `\n*Total: ${CONFIG.CURRENCY}${orderData.total}*`;
            
            // 3. Open WhatsApp
            const url = `https://wa.me/${CONFIG.WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
            
            // 4. Clear Cart
            cart = [];
            saveCart();
            bootstrap.Modal.getInstance(document.getElementById('checkoutModal')).hide();
            document.querySelector('.btn-close-white').click(); // Close Sidebar
        } else {
            alert("Failed to save order. Please try again.");
        }
    } catch (err) {
        console.error(err);
        alert("Network Error. Please check your connection.");
    }
}