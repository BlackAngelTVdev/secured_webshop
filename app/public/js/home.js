function formatPrice(value) {
    const number = Number(value || 0);
    return `${number.toFixed(2)} CHF`;
}

function escapeHtml(text) {
    return String(text || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderProducts(products) {
    const list = document.getElementById('productList');
    if (!list) return;

    if (!products.length) {
        list.innerHTML = '<p>Aucun produit pour le moment.</p>';
        return;
    }

    list.innerHTML = products.map((product) => `
        <article class="product-card">
            <div class="badge">Produit</div>
            <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" />
            <div class="product-content">
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.description)}</p>
                <div class="product-footer">
                    <span class="price">${formatPrice(product.price)}</span>
                    <button type="button">Ajouter au panier</button>
                </div>
            </div>
        </article>
    `).join('');
}

async function loadProducts() {
    const list = document.getElementById('productList');
    if (!list) return;

    list.innerHTML = '<p>Chargement des produits...</p>';

    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error('Erreur API');
        }

        const products = await response.json();
        renderProducts(products);
    } catch (_err) {
        list.innerHTML = '<p>Impossible de charger les produits.</p>';
    }
}

loadProducts();
