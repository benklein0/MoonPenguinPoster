// The Moon Penguin Shop -- shared shopping cart
// Included on every page that shows the cart icon (index.html, shop.html, customize.html).
// Persists to localStorage so the cart follows the visitor across pages.
(function () {
  const CART_KEY = 'mps_cart_v1';
  const CHECKOUT_API = 'https://moonpenguin-checkout.vercel.app/api/checkout';
  const STRIPE_KEY = 'pk_live_51QYBNI07mBpGH0WMuI5clu9FlwIhISlJtuimmmLUUCpExEIvzUGtd7dXOYt9VWwnlGlk9PDeaGZhcZ55wlUZJ11O00NJJi5e3K';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    renderBadge();
  }

  function addItem(item) {
    const cart = getCart();
    const existing = cart.find(i => String(i.productId) === String(item.productId));
    if (existing) existing.quantity += item.quantity || 1;
    else cart.push(Object.assign({}, item, { quantity: item.quantity || 1 }));
    saveCart(cart);
    renderDrawer();
    openDrawer();
  }

  function removeItem(productId) {
    saveCart(getCart().filter(i => String(i.productId) !== String(productId)));
    renderDrawer();
  }

  function setQuantity(productId, qty) {
    const cart = getCart();
    const item = cart.find(i => String(i.productId) === String(productId));
    if (!item) return;
    if (qty <= 0) { removeItem(productId); return; }
    item.quantity = qty;
    saveCart(cart);
    renderDrawer();
  }

  function cartCount() {
    return getCart().reduce((sum, i) => sum + i.quantity, 0);
  }

  function cartTotal() {
    return getCart().reduce((sum, i) => sum + i.quantity * i.price, 0);
  }

  function mountUI() {
    const nav = document.querySelector('nav');
    if (!nav || document.querySelector('.mps-cart-toggle')) return;

    const toggle = document.createElement('button');
    toggle.className = 'mps-cart-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'View cart');
    toggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"/>' +
      '<circle cx="9.5" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/>' +
      '</svg><span class="mps-cart-count" hidden>0</span>';
    nav.appendChild(toggle);

    const overlay = document.createElement('div');
    overlay.className = 'mps-cart-drawer-overlay';
    overlay.innerHTML =
      '<div class="mps-cart-drawer">' +
      '<div class="mps-cart-header"><span>Your Cart</span><button type="button" class="mps-cart-close" aria-label="Close cart">&times;</button></div>' +
      '<div class="mps-cart-items"></div>' +
      '<div class="mps-cart-footer">' +
      '<div class="mps-cart-subtotal"></div>' +
      '<button type="button" class="mps-cart-checkout">Checkout</button>' +
      '<div class="mps-cart-status"></div>' +
      '</div></div>';
    document.body.appendChild(overlay);

    injectStyles();

    toggle.addEventListener('click', () => { renderDrawer(); openDrawer(); });
    overlay.querySelector('.mps-cart-close').addEventListener('click', closeDrawer);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDrawer(); });
    overlay.querySelector('.mps-cart-checkout').addEventListener('click', checkout);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    renderBadge();
  }

  function openDrawer() {
    const overlay = document.querySelector('.mps-cart-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    const overlay = document.querySelector('.mps-cart-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderBadge() {
    const badge = document.querySelector('.mps-cart-count');
    if (!badge) return;
    const count = cartCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  function renderDrawer() {
    const itemsEl = document.querySelector('.mps-cart-items');
    const subtotalEl = document.querySelector('.mps-cart-subtotal');
    if (!itemsEl) return;
    const cart = getCart();

    if (cart.length === 0) {
      itemsEl.innerHTML = '<p class="mps-cart-empty">Your cart is empty.</p>';
    } else {
      itemsEl.innerHTML = cart.map(item => (
        '<div class="mps-cart-item" data-id="' + item.productId + '">' +
        '<img src="' + (item.image || '') + '" alt="">' +
        '<div class="mps-cart-item-info">' +
        '<div class="mps-cart-item-title">' + item.title + '</div>' +
        '<div class="mps-cart-item-price">$' + item.price.toFixed(2) + '</div>' +
        '<div class="mps-cart-item-qty">' +
        '<button type="button" class="mps-qty-btn" data-action="dec">-</button>' +
        '<span>' + item.quantity + '</span>' +
        '<button type="button" class="mps-qty-btn" data-action="inc">+</button>' +
        '<button type="button" class="mps-cart-remove" data-action="remove">Remove</button>' +
        '</div></div></div>'
      )).join('');
    }
    subtotalEl.textContent = 'Subtotal: $' + cartTotal().toFixed(2);

    itemsEl.querySelectorAll('.mps-cart-item').forEach(row => {
      const id = row.dataset.id;
      const item = getCart().find(i => String(i.productId) === String(id));
      if (!item) return;
      row.querySelector('[data-action="dec"]').addEventListener('click', () => setQuantity(item.productId, item.quantity - 1));
      row.querySelector('[data-action="inc"]').addEventListener('click', () => setQuantity(item.productId, item.quantity + 1));
      row.querySelector('[data-action="remove"]').addEventListener('click', () => removeItem(item.productId));
    });
  }

  async function checkout() {
    const cart = getCart();
    if (cart.length === 0) return;
    const btn = document.querySelector('.mps-cart-checkout');
    const status = document.querySelector('.mps-cart-status');
    btn.disabled = true;
    status.textContent = 'Redirecting to secure checkout...';
    try {
      if (!window.Stripe) throw new Error('Stripe.js did not load on this page');
      const stripe = window.Stripe(STRIPE_KEY);
      const response = await fetch(CHECKOUT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ title: i.title, price: i.price, image: i.image, productId: i.productId, quantity: i.quantity }))
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (err) {
      console.error('Cart checkout error:', err);
      status.textContent = 'Something went wrong. Please try again, or purchase on Etsy.';
      btn.disabled = false;
    }
  }

  function injectStyles() {
    if (document.getElementById('mps-cart-styles')) return;
    const style = document.createElement('style');
    style.id = 'mps-cart-styles';
    style.textContent =
      '.mps-cart-toggle{position:relative;background:none;border:none;cursor:pointer;color:var(--dark,#1a1612);padding:4px;margin-left:20px;display:inline-flex;align-items:center;}' +
      '.mps-cart-count{position:absolute;top:-6px;right:-8px;background:var(--gold,#c9a96e);color:var(--dark,#1a1612);font-size:0.62rem;font-weight:600;min-width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0 3px;font-family:"Jost",sans-serif;}' +
      '.mps-cart-drawer-overlay{display:none;position:fixed;inset:0;z-index:300;background:rgba(26,22,18,0.5);backdrop-filter:blur(2px);}' +
      '.mps-cart-drawer-overlay.open{display:block;}' +
      '.mps-cart-drawer{position:absolute;top:0;right:0;height:100%;width:100%;max-width:400px;background:var(--warm-white,#faf7f2);display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(0,0,0,0.15);font-family:"Jost",sans-serif;}' +
      '.mps-cart-header{display:flex;justify-content:space-between;align-items:center;padding:24px;border-bottom:1px solid rgba(201,169,110,0.25);font-family:"Cormorant Garamond",serif;font-size:1.3rem;color:var(--dark,#1a1612);}' +
      '.mps-cart-close{background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--mid,#5c4f3d);line-height:1;}' +
      '.mps-cart-items{flex:1;overflow-y:auto;padding:16px 24px;}' +
      '.mps-cart-empty{color:var(--muted,#9e8e7a);font-style:italic;text-align:center;margin-top:40px;}' +
      '.mps-cart-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid rgba(201,169,110,0.15);}' +
      '.mps-cart-item img{width:64px;height:64px;object-fit:cover;flex-shrink:0;background:var(--cream,#f5f0e8);}' +
      '.mps-cart-item-title{font-size:0.85rem;margin-bottom:4px;line-height:1.3;color:var(--dark,#1a1612);}' +
      '.mps-cart-item-price{font-size:0.8rem;color:var(--gold,#c9a96e);margin-bottom:6px;}' +
      '.mps-cart-item-qty{display:flex;align-items:center;gap:8px;font-size:0.8rem;color:var(--mid,#5c4f3d);}' +
      '.mps-qty-btn{width:22px;height:22px;border:1px solid rgba(201,169,110,0.4);background:none;cursor:pointer;font-size:0.85rem;}' +
      '.mps-cart-remove{margin-left:auto;background:none;border:none;color:var(--muted,#9e8e7a);font-size:0.72rem;text-decoration:underline;cursor:pointer;}' +
      '.mps-cart-footer{padding:20px 24px 28px;border-top:1px solid rgba(201,169,110,0.25);}' +
      '.mps-cart-subtotal{font-size:0.95rem;margin-bottom:14px;color:var(--dark,#1a1612);}' +
      '.mps-cart-checkout{width:100%;background:var(--dark,#1a1612);color:var(--cream,#f5f0e8);border:none;padding:14px;font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;cursor:pointer;}' +
      '.mps-cart-checkout:hover{background:var(--gold,#c9a96e);color:var(--dark,#1a1612);}' +
      '.mps-cart-checkout:disabled{opacity:0.6;cursor:not-allowed;}' +
      '.mps-cart-status{font-size:0.75rem;color:var(--muted,#9e8e7a);margin-top:10px;text-align:center;}' +
      '@media (max-width:480px){.mps-cart-drawer{max-width:100%;}}';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountUI);
  } else {
    mountUI();
  }

  window.MoonPenguinCart = { addItem, removeItem, setQuantity, getCart, cartCount, cartTotal };
})();
