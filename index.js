// Configuración de Algolia
const searchClient = algoliasearch('HBSG4O6ZTO', '372e9e9a75aeee3a3d526ee77419c9d8');

// Configuración de InstantSearch
const search = instantsearch({
  indexName: 'restaurants',
  searchClient,
});

// Función para renderizar métodos de pago
function renderPayments(payment_options) {
  if (!payment_options || payment_options.length === 0) {
    return '';
  }
  
  const paymentEmojis = {
    'AMEX': '💳',
    'Discover': '💳',
    'MasterCard': '💳',
    'Visa': '💳',
    'Diners Club': '💳',
    'JCB': '💳',
    'Carte Blanche': '💳',
    'Pay with OpenTable': '💳',
    'Cash Only': '💵'
  };
  
  return payment_options.map(option => `
    <span class="payment-badge">
      ${paymentEmojis[option] || '💳'} ${option}
    </span>
  `).join('');
}

// Widget de búsqueda
search.addWidgets([
  instantsearch.widgets.searchBox({
    container: '#search-input',
    placeholder: '🔍 Search restaurants, cuisines, cities...',
    autofocus: true,
    showReset: false,
    cssClasses: {
      input: 'search-bar__input',
      form: 'search-bar__form',
      submit: 'search-bar__submit',
      reset: 'search-bar__reset',
    },
  }),

  // Widget de resultados
  instantsearch.widgets.hits({
    container: '#results-container',
    templates: {
      item: (hit) => `
        <div class="results__item">
          <div class="result">
            <div class="result__image-container">
              <img src="${hit.image_url}" class="result__image" alt="${hit.name}" onerror="this.style.display='none'">
              <div class="result__image-badge">⭐ ${hit.stars_count}</div>
            </div>
            <div class="result__text-container">
              <h1 class="result__title">${hit.name}</h1>
              <p class="result__rating">
                <span class="stars">⭐ ${hit.stars_count}</span>
                <span class="reviews">💬 ${hit.reviews_count} reviews</span>
              </p>
              <p class="result__summary">
                <span>🍽️ ${hit.cuisine_type}</span>
                <span>📍 ${hit.city}</span>
                <span>💵 ${hit.price_range_string}</span>
              </p>
              <p class="result__dining">🎩 ${hit.dining_style}</p>
              <p class="result__address">🏠 ${hit.address}, ${hit.city}, ${hit.state} ${hit.postal_code}</p>
              
              <a href="tel:${hit.phone}" class="result__phone">📞 ${hit.phone}</a>
              
              <div class="result__payments">
                ${renderPayments(hit.payment_options)}
              </div>
              
              <a href="${hit.reserve_url}" target="_blank" rel="noopener" class="result__reserve-btn">
                📅 Reserve Now
              </a>
            </div>
          </div>
        </div>
      `,
      empty: `
        <div id="no-results-message">
          <p>😕 No restaurants found for "<em>{{query}}</em>"</p>
          <a href="." class="clear-all">✨ Clear search</a>
        </div>
      `,
    },
  }),

  // Widget para mostrar el número de resultados
  instantsearch.widgets.stats({
    container: '#results-count',
    templates: {
      text: '📊 {{nbHits}} restaurants',
    },
  }),

  // Widget para el tiempo de búsqueda
  instantsearch.widgets.stats({
    container: '#results-time',
    templates: {
      text: '⚡ {{processingTimeMS}}ms',
    },
  }),

  // Widget de paginación
  instantsearch.widgets.pagination({
    container: '#show-more',
    scrollTo: false,
    templates: {
      previous: '',
      next: '',
    },
  }),

  // Widget de refinamiento por tipo de cocina
  instantsearch.widgets.refinementList({
    container: '#cuisine-facets',
    attribute: 'cuisine_type',
    searchable: true,
    operator: 'or',
    limit: 10,
    cssClasses: {
      item: 'filter__label',
      active: 'filter__label--active',
      label: 'filter__label-text',
      count: 'filter__label-number',
    },
  }),

  // Widget de refinamiento por precio
  instantsearch.widgets.refinementList({
    container: '#price-facets',
    attribute: 'price_range_string',
    operator: 'or',
    limit: 4,
    cssClasses: {
      item: 'filter__label',
      active: 'filter__label--active',
      label: 'filter__label-text',
      count: 'filter__label-number',
    },
  }),

  // Widget de refinamiento por estilo de comedor
  instantsearch.widgets.refinementList({
    container: '#dining-style-facets',
    attribute: 'dining_style',
    searchable: true,
    operator: 'or',
    limit: 10,
    cssClasses: {
      item: 'filter__label',
      active: 'filter__label--active',
      label: 'filter__label-text',
      count: 'filter__label-number',
    },
  }),
]);

// Iniciar InstantSearch
search.start();

// Manejar el clic en el botón "Show more"
document.getElementById('show-more-btn').addEventListener('click', function() {
  search.helper.nextPage();
});

// Manejar el clic para abrir/cerrar filtros en móvil
document.getElementById('filter-toggle').addEventListener('click', function() {
  const container = document.getElementById('filter-container');
  container.classList.toggle('open');
});

// Manejar el botón de limpiar búsqueda
document.getElementById('search-clear').addEventListener('click', function() {
  search.helper.setQuery('').search();
  // Limpiar el input de búsqueda
  const searchInput = document.querySelector('.search-bar__input');
  if (searchInput) {
    searchInput.value = '';
  }
  document.getElementById('search-clear').style.display = 'none';
});

// Mostrar/ocultar botón de limpiar búsqueda
document.addEventListener('input', function(e) {
  if (e.target.classList.contains('search-bar__input')) {
    const clearBtn = document.getElementById('search-clear');
    clearBtn.style.display = e.target.value ? 'block' : 'none';
  }
});

// Manejar botón de limpiar filtros
document.getElementById('clear-filters').addEventListener('click', function() {
  search.helper.clearRefinements().search();
});

// Manejar selección de ordenamiento
document.getElementById('sort-select').addEventListener('change', function() {
  const value = this.value;
  
  search.helper.clearRefinements('stars_count');
  search.helper.clearRefinements('reviews_count');
  search.helper.clearRefinements('price');
  
  switch(value) {
    case 'rating':
      search.helper.addNumericRefinement('stars_count', '>=', 4.5).search();
      break;
    case 'reviews':
      search.helper.addNumericRefinement('reviews_count', '>=', 500).search();
      break;
    case 'price_asc':
      search.helper.setQueryParameter('hitsPerPage', 20).search();
      break;
    case 'price_desc':
      search.helper.setQueryParameter('hitsPerPage', 20).search();
      break;
  }
});