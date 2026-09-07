// Algolia Search Configuration
const searchClient = algoliasearch('HBSG4O6ZTO', '372e9e9a75aeee3a3d526ee77419c9d8');

// InstantSearch config
const search = instantsearch({
  indexName: 'restaurants',
  searchClient,
  searchParameters: {
    hitsPerPage: 6,
    queryType: 'prefixLast',
    typoTolerance: true,
    removeWordsIfNoResults: 'allOptional',
    advancedSyntax: true,
  }
});

// ============ MAP FUNCTIONS ============

let map;
let markers = [];
let markerCluster = null;
let mapInitialized = false;
let initialLoadDone = false;
let markersById = {};
let currentRestaurants = [];
let isUpdatingMarkers = false;
let lastSearchHits = [];

// Exponer variables para depuración
window.__debug = {
  markersById,
  markers,
  currentRestaurants,
  lastSearchHits,
  updateMapMarkers,
  search,
  searchClient
};

function initMap() {
  if (mapInitialized) return;
  
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  console.log('🗺️ Creating map...');
  
  map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  markerCluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      const size = count > 50 ? 44 : 36;
      const color = count > 50 ? '#DC2626' : count > 20 ? '#F59E0B' : '#3B82F6';
      return L.divIcon({
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:${size > 40 ? 16 : 13}px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);">${count}</div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });
    }
  });

  map.addLayer(markerCluster);
  mapInitialized = true;
  console.log('🗺️ Map initialized ✅');
}

function updateMapMarkers(restaurants) {
  console.log('🔄 updateMapMarkers called with', restaurants?.length || 0, 'restaurants');
  
  if (!map || !markerCluster) {
    console.warn('⚠️ Map not ready');
    return;
  }
  
  isUpdatingMarkers = true;
  currentRestaurants = restaurants || [];
  lastSearchHits = restaurants || [];
  
  // Limpiar todos los marcadores
  console.log('🗑️ Clearing all markers from cluster');
  markerCluster.clearLayers();
  markers = [];
  markersById = {};
  
  const valid = restaurants.filter(r => r._geoloc && r._geoloc.lat && r._geoloc.lng);
  console.log(`📍 ${valid.length} restaurants with geolocation`);
  
  if (valid.length === 0) {
    console.log('📭 No valid geolocation data');
    isUpdatingMarkers = false;
    return;
  }

  // Añadir nuevos marcadores
  const newMarkers = [];

  valid.forEach((r) => {
    const marker = L.marker([r._geoloc.lat, r._geoloc.lng], {
      icon: L.divIcon({
        html: `<div style="background:#3B82F6;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      })
    }).bindPopup(`
      <div style="max-width:200px;padding:4px;">
        <strong style="font-size:14px;">${r.name || 'Restaurant'}</strong>
        <p style="margin:4px 0;font-size:12px;color:#666;">${r.cuisine_type || ''}</p>
        <p style="margin:4px 0;font-size:12px;color:#f59e0b;">⭐ ${r.stars_count || 'N/A'} (${r.reviews_count || 0})</p>
        <p style="margin:4px 0;font-size:12px;color:#666;">${r.city || ''}, ${r.state || ''}</p>
        <a href="${r.reserve_url || '#'}" target="_blank" style="display:inline-block;margin-top:6px;padding:4px 12px;background:#6C5CE7;color:white;border-radius:4px;font-size:12px;text-decoration:none;">Reserve</a>
      </div>
    `);
    
    // Indexar por múltiples claves
    if (r.objectID) markersById[r.objectID] = marker;
    if (r.name) markersById[r.name] = marker;
    const coordKey = `${r._geoloc.lat.toFixed(6)},${r._geoloc.lng.toFixed(6)}`;
    markersById[coordKey] = marker;
    
    newMarkers.push(marker);
  });

  markerCluster.addLayers(newMarkers);
  markers = newMarkers;

  console.log(`📍 ${valid.length} markers added to map ✅`);
  console.log('📋 Marcadores disponibles:', Object.keys(markersById).slice(0, 10));

  // Ajustar zoom
  if (valid.length > 0) {
    try {
      const group = L.featureGroup();
      valid.forEach(r => group.addLayer(L.marker([r._geoloc.lat, r._geoloc.lng])));
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        console.log('🔍 Zoom adjusted to show new markers');
      }
    } catch (e) {
      console.warn('⚠️ Could not adjust zoom:', e);
    }
  }
  
  isUpdatingMarkers = false;
}

// ============ FIND MARKER ============

function findMarker(lat, lng, objectID, name) {
  console.log(`🔍 Finding marker for: ${name || objectID} at ${lat}, ${lng}`);
  
  // 1. Buscar por objectID
  if (objectID && markersById[objectID]) {
    console.log(`✅ Found by objectID: ${objectID}`);
    return markersById[objectID];
  }
  
  // 2. Buscar por nombre exacto
  if (name && markersById[name]) {
    console.log(`✅ Found by name: ${name}`);
    return markersById[name];
  }
  
  // 3. Buscar por coordenadas (con tolerancia)
  if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const coordKey = `${latNum.toFixed(6)},${lngNum.toFixed(6)}`;
    if (markersById[coordKey]) {
      console.log(`✅ Found by coordinates: ${coordKey}`);
      return markersById[coordKey];
    }
  }
  
  // 4. Búsqueda lineal con tolerancia
  console.log('🔍 Searching linearly with tolerance...');
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  
  for (let i = 0; i < markers.length; i++) {
    const pos = markers[i].getLatLng();
    const diffLat = Math.abs(pos.lat - latNum);
    const diffLng = Math.abs(pos.lng - lngNum);
    if (diffLat < 0.001 && diffLng < 0.001) {
      console.log(`✅ Found by linear search (diff: ${diffLat.toFixed(6)}, ${diffLng.toFixed(6)})`);
      return markers[i];
    }
  }
  
  console.log('❌ No marker found');
  return null;
}

// ============ FUNCIÓN PRINCIPAL DE BÚSQUEDA ============

function performSearch(query) {
  console.log(`🔍 Realizando búsqueda: "${query}"`);
  
  const index = searchClient.initIndex('restaurants');
  
  index.search(query, {
    hitsPerPage: 6,
    attributesToRetrieve: ['*']
  }).then(response => {
    console.log('✅ Búsqueda completada!');
    console.log(`📊 Encontrados ${response.hits.length} restaurantes`);
    
    if (response.hits && response.hits.length > 0) {
      console.log('📋 Primer resultado:', response.hits[0].name);
      console.log('📋 Geoloc:', response.hits[0]._geoloc);
      updateMapMarkers(response.hits);
    } else {
      console.log('📭 No se encontraron resultados');
      updateMapMarkers([]);
    }
  }).catch(err => {
    console.error('❌ Error en búsqueda:', err);
  });
}

// ============ FETCH INICIAL ============

function fetchInitialRestaurants() {
  console.log('🔄 Fetching initial restaurants...');
  performSearch('');
}

// ============ PAYMENT RENDERER ============

function renderPayments(payments) {
  if (!payments || payments.length === 0) return '';
  const emojis = { 'AMEX': '💳', 'Discover': '💳', 'MasterCard': '💳', 'Visa': '💳', 'Cash Only': '💵' };
  return payments.map(p => `<span class="result-card__payment">${emojis[p] || '💳'} ${p}</span>`).join('');
}

// ============ INSTANTSEARCH WIDGETS ============

search.addWidgets([
  instantsearch.widgets.searchBox({
    container: '#search-input',
    placeholder: '🔍 Search restaurants, cuisines, cities...',
    autofocus: true,
    showReset: false,
    cssClasses: {
      input: 'ais-SearchBox-input',
      form: 'ais-SearchBox-form',
      submit: 'ais-SearchBox-submit',
      reset: 'ais-SearchBox-reset',
    },
  }),

  instantsearch.widgets.hits({
    container: '#hits',
    templates: {
      item: (hit) => `
        <div class="result-card" 
             data-id="${hit.objectID}"
             data-lat="${hit._geoloc?.lat}" 
             data-lng="${hit._geoloc?.lng}"
             data-name="${hit.name}">
          <div class="result-card__image">
            <img src="${hit.image_url}" alt="${hit.name}" onerror="this.style.display='none'" />
            <span class="result-card__badge">⭐ ${hit.stars_count || 'N/A'}</span>
          </div>
          <div class="result-card__body">
            <h3 class="result-card__name">${hit.name || 'Restaurant'}</h3>
            <div class="result-card__rating">
              <span class="result-card__stars">⭐ ${hit.stars_count || 'N/A'}</span>
              <span class="result-card__reviews">(${hit.reviews_count || 0} reviews)</span>
            </div>
            <div class="result-card__meta">
              <span class="result-card__tag result-card__tag--cuisine">${hit.cuisine_type || ''}</span>
              <span class="result-card__tag result-card__tag--price">${hit.price_range_string || ''}</span>
            </div>
            <p class="result-card__dining">${hit.dining_style || ''}</p>
            <p class="result-card__address">${hit.address || ''}, ${hit.city || ''}, ${hit.state || ''}</p>
            <a href="tel:${hit.phone}" class="result-card__phone">📞 ${hit.phone || ''}</a>
            <div class="result-card__payments">${renderPayments(hit.payment_options)}</div>
            <a href="${hit.reserve_url || '#'}" target="_blank" class="result-card__reserve">📅 Reserve Now</a>
          </div>
        </div>
      `,
      empty: `
        <div class="ais-Hits-empty">
          <p>😕 No restaurants found for "<em>{{query}}</em>"</p>
          <a href="." class="btn-clear-filters" style="display:inline-block;width:auto;padding:8px 24px;">Clear search</a>
        </div>
      `,
    },
  }),

  instantsearch.widgets.stats({
    container: '#results-count',
    templates: {
      text: '📊 {{nbHits}} restaurants',
    },
  }),

  instantsearch.widgets.stats({
    container: '#results-time',
    templates: {
      text: '⚡ {{processingTimeMS}}ms',
    },
  }),

  instantsearch.widgets.pagination({
    container: '#show-more',
    scrollTo: false,
    templates: {
      previous: '',
      next: '',
    },
  }),

  instantsearch.widgets.refinementList({
    container: '#cuisine-facets',
    attribute: 'cuisine_type',
    searchable: true,
    operator: 'or',
    limit: 10,
    cssClasses: {
      item: 'ais-RefinementList-item',
      active: 'ais-RefinementList-item--selected',
      label: 'ais-RefinementList-label',
      count: 'ais-RefinementList-count',
    },
  }),

  instantsearch.widgets.refinementList({
    container: '#price-facets',
    attribute: 'price_range_string',
    operator: 'or',
    limit: 4,
    cssClasses: {
      item: 'ais-RefinementList-item',
      active: 'ais-RefinementList-item--selected',
      label: 'ais-RefinementList-label',
      count: 'ais-RefinementList-count',
    },
  }),

  instantsearch.widgets.refinementList({
    container: '#dining-style-facets',
    attribute: 'dining_style',
    searchable: true,
    operator: 'or',
    limit: 10,
    cssClasses: {
      item: 'ais-RefinementList-item',
      active: 'ais-RefinementList-item--selected',
      label: 'ais-RefinementList-label',
      count: 'ais-RefinementList-count',
    },
  }),
]);

// ============ START SEARCH ============
search.start();

// FORZAR hitsPerPage en el helper después de iniciar
setTimeout(() => {
  if (search.helper) {
    search.helper.setQueryParameter('hitsPerPage', 6);
    console.log('🔧 Forzado hitsPerPage = 6 en el helper');
  }
}, 100);

// ============ LISTENER DE RESULTADOS DE INSTANTSEARCH ============

search.on('result', function(event) {
  console.log('📢 [Event] Search result event!');
  let hits = event.results.hits || [];
  console.log(`📊 [Event] Found ${hits.length} restaurants`);
  
  // No hacer nada aquí, dejamos que performSearch maneje la actualización
});

// ============ INTERCEPTAR BÚSQUEDA DEL INPUT ============

const searchInput = document.querySelector('.ais-SearchBox-input');
if (searchInput) {
  let lastQuery = '';
  
  searchInput.addEventListener('input', function() {
    const query = this.value || '';
    
    // Solo buscar si cambió el texto
    if (query !== lastQuery) {
      lastQuery = query;
      clearTimeout(window._searchTimeout);
      window._searchTimeout = setTimeout(() => {
        console.log(`🔍 Input detectado: "${query}"`);
        performSearch(query);
      }, 300);
    }
  });
  
  // También detectar cuando se presiona Enter
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = this.value || '';
      console.log(`🔍 Enter presionado: "${query}"`);
      performSearch(query);
    }
  });
}

// ============ INICIALIZAR ============

console.log('🚀 Initializing application...');

setTimeout(initMap, 300);
setTimeout(fetchInitialRestaurants, 600);

// ============ UI EVENT LISTENERS ============

document.getElementById('filters-toggle')?.addEventListener('click', function() {
  document.getElementById('filters-panel').classList.toggle('open');
});

document.getElementById('clear-filters')?.addEventListener('click', function() {
  if (search && search.helper) {
    search.helper.clearRefinements().search();
  }
  // También limpiar el input
  if (searchInput) {
    searchInput.value = '';
    performSearch('');
  }
});

document.getElementById('show-more-btn')?.addEventListener('click', function() {
  if (search && search.helper) {
    search.helper.nextPage();
  }
});

document.getElementById('sort-select')?.addEventListener('change', function() {
  if (!search || !search.helper) return;
  const value = this.value;
  search.helper.clearRefinements('stars_count');
  search.helper.clearRefinements('reviews_count');
  switch(value) {
    case 'rating': search.helper.addNumericRefinement('stars_count', '>=', 4.5).search(); break;
    case 'reviews': search.helper.addNumericRefinement('reviews_count', '>=', 500).search(); break;
    case 'price_asc': search.helper.setQueryParameter('sort', ['price:asc']).search(); break;
    case 'price_desc': search.helper.setQueryParameter('sort', ['price:desc']).search(); break;
    default: search.helper.setQueryParameter('sort', undefined).search();
  }
  // Forzar actualización
  setTimeout(() => {
    const query = searchInput?.value || '';
    performSearch(query);
  }, 200);
});

// ============ CLICK EN TARJETA → ZOOM AL MARCADOR ============

document.addEventListener('click', function(e) {
  const card = e.target.closest('.result-card');
  if (card && map) {
    const lat = card.dataset.lat;
    const lng = card.dataset.lng;
    const objectID = card.dataset.id;
    const name = card.dataset.name;
    
    console.log(`📍 Click on card: ${name || objectID} at ${lat}, ${lng}`);
    
    if (!lat || !lng) {
      console.warn('⚠️ No coordinates found on card');
      return;
    }
    
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      console.warn('⚠️ Invalid coordinates');
      return;
    }
    
    const findAndFly = function() {
      const targetMarker = findMarker(latNum, lngNum, objectID, name);
      
      if (targetMarker) {
        console.log('✅ Flying to marker and opening popup...');
        map.flyTo([latNum, lngNum], 14, { duration: 1.2 });
        setTimeout(() => {
          targetMarker.openPopup();
        }, 400);
      } else {
        console.warn('⚠️ No marker found, flying to location anyway...');
        map.flyTo([latNum, lngNum], 14, { duration: 1.2 });
      }
    };
    
    if (isUpdatingMarkers) {
      console.log('⏳ Markers are updating, waiting 300ms...');
      setTimeout(findAndFly, 300);
    } else {
      findAndFly();
    }
  }
});

console.log('✅ Restaurant Locator initialized!');
console.log('💡 6 resultados por página');
console.log('💡 Busca "Bistro Milano" para probar');