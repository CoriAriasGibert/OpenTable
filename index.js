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
let markersById = {};
let isUpdatingMarkers = false;

// ============ SEARCH STATE ============
let isInitialLoad = true;
let lastQuery = '';

// ============ MAP INITIALIZATION ============

function initMap() {
  if (mapInitialized) return;
  
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    console.warn('⚠️ Map container not found');
    return;
  }

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

  // Move map listener
  map.on('moveend', function() {
    console.log('🗺️ Map moved, searching in new area...');
    // Only search if not in text search mode
    if (!lastQuery || lastQuery.trim() === '') {
      searchByMapView();
    }
  });

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

// ============ UPDATE MAP MARKERS ============

function updateMapMarkers(restaurants) {
  console.log('🔄 updateMapMarkers called with', restaurants?.length || 0, 'restaurants');
  
  if (!map || !markerCluster) {
    console.warn('⚠️ Map not ready');
    return;
  }
  
  isUpdatingMarkers = true;
  
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
    
    if (r.objectID) markersById[r.objectID] = marker;
    if (r.name) markersById[r.name] = marker;
    const coordKey = `${r._geoloc.lat.toFixed(6)},${r._geoloc.lng.toFixed(6)}`;
    markersById[coordKey] = marker;
    
    newMarkers.push(marker);
  });

  markerCluster.addLayers(newMarkers);
  markers = newMarkers;

  console.log(`📍 ${valid.length} markers added to map ✅`);
  
  isUpdatingMarkers = false;
}

// ============ FIND MARKER ============

function findMarker(lat, lng, objectID, name) {
  if (objectID && markersById[objectID]) {
    return markersById[objectID];
  }
  
  if (name && markersById[name]) {
    return markersById[name];
  }
  
  if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const coordKey = `${latNum.toFixed(6)},${lngNum.toFixed(6)}`;
    if (markersById[coordKey]) {
      return markersById[coordKey];
    }
  }
  
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  
  for (let i = 0; i < markers.length; i++) {
    const pos = markers[i].getLatLng();
    if (Math.abs(pos.lat - latNum) < 0.001 && Math.abs(pos.lng - lngNum) < 0.001) {
      return markers[i];
    }
  }
  
  return null;
}

// ============ UPDATE LIST UI ============

function updateListUI(hits) {
  const container = document.getElementById('hits');
  if (!container) {
    console.warn('⚠️ #hits container not found');
    return;
  }

  // FORZAR SOLO 6 RESULTADOS
  const displayHits = hits.slice(0, 6);

  if (!displayHits || displayHits.length === 0) {
    container.innerHTML = `
      <div class="ais-Hits-empty">
        <p>😕 No restaurants found</p>
        <p style="font-size:13px;color:rgba(26,26,46,0.4);">Try adjusting your search or moving the map</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayHits.map(hit => `
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
        <a href="${hit.reserve_url || '#'}" target="_blank" class="result-card__reserve">📅 Reserve Now</a>
      </div>
    </div>
  `).join('');
  
  console.log(`📋 Lista actualizada con ${displayHits.length} resultados`);
}

// ============ UPDATE STATS ============

function updateStats(count) {
  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.innerHTML = `📊 ${count} restaurants`;
  }
}

// ============ PERFORM SEARCH ============

function performSearch(query = '', geoParams = null) {
  console.log(`🔍 Performing search: "${query}"`);
  
  const index = searchClient.initIndex('restaurants');
  
  const searchParams = {
    hitsPerPage: 6,
    attributesToRetrieve: ['*'],
    facets: ['cuisine_type', 'price_range_string', 'dining_style']
  };

  // If query exists, use text search
  if (query && query.trim() !== '') {
    searchParams.query = query.trim();
    lastQuery = query;
  } else {
    lastQuery = '';
    
    // If geoParams provided, use them
    if (geoParams && geoParams.lat && geoParams.lng && geoParams.radius) {
      searchParams.aroundLatLng = `${geoParams.lat}, ${geoParams.lng}`;
      searchParams.aroundRadius = geoParams.radius;
      console.log(`📍 Geo search: radius ${geoParams.radius}m`);
    } else if (map) {
      // Use current map view
      const bounds = map.getBounds();
      if (bounds && bounds.isValid()) {
        const center = bounds.getCenter();
        const zoom = map.getZoom();
        const radius = calculateRadiusFromZoom(zoom);
        searchParams.aroundLatLng = `${center.lat}, ${center.lng}`;
        searchParams.aroundRadius = radius;
        console.log(`📍 Using map view: radius ${radius}m`);
      }
    }
  }

  // Apply filters from helper
  if (search && search.helper) {
    const refinements = search.helper.getRefinements();
    let filterString = '';
    
    refinements.forEach(ref => {
      if (ref.attribute === 'cuisine_type' && ref.type === 'disjunctive') {
        const values = ref.values.map(v => `cuisine_type:"${v.name}"`).join(' OR ');
        filterString += `(${values})`;
      }
      if (ref.attribute === 'price_range_string' && ref.type === 'disjunctive') {
        const values = ref.values.map(v => `price_range_string:"${v.name}"`).join(' OR ');
        if (filterString) filterString += ' AND ';
        filterString += `(${values})`;
      }
      if (ref.attribute === 'dining_style' && ref.type === 'disjunctive') {
        const values = ref.values.map(v => `dining_style:"${v.name}"`).join(' OR ');
        if (filterString) filterString += ' AND ';
        filterString += `(${values})`;
      }
    });
    
    if (filterString) {
      searchParams.filters = filterString;
      console.log('🔧 Filters applied:', filterString);
    }
  }

  console.log('📋 Search params:', searchParams);

  index.search(searchParams.query || '', searchParams).then(response => {
    const hits = response.hits || [];
    const total = response.nbHits || hits.length;
    
    console.log(`✅ Search complete: ${hits.length} results (total: ${total})`);
    
    // Update map with ALL hits (up to 6)
    updateMapMarkers(hits);
    
    // Update list with 6 results
    updateListUI(hits);
    
    // Update stats with total count
    updateStats(total);
    
    // Zoom to show markers if there are results and it's a text search
    if (query && query.trim() !== '' && hits.length > 0) {
      zoomToMarkers(hits);
    }
    
  }).catch(err => {
    console.error('❌ Search error:', err);
  });
}

// ============ SEARCH BY MAP VIEW ============

function searchByMapView() {
  if (!map) return;
  
  const bounds = map.getBounds();
  if (!bounds || !bounds.isValid()) return;
  
  const center = bounds.getCenter();
  const zoom = map.getZoom();
  const radius = calculateRadiusFromZoom(zoom);
  
  const geoParams = {
    lat: center.lat,
    lng: center.lng,
    radius: radius
  };
  
  console.log(`🔍 Searching by map view: center [${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}], radius: ${radius}m`);
  
  // Use empty query for map search
  performSearch('', geoParams);
}

// ============ ZOOM TO MARKERS ============

function zoomToMarkers(hits) {
  if (!map || !hits || hits.length === 0) return;
  
  const valid = hits.filter(r => r._geoloc && r._geoloc.lat && r._geoloc.lng);
  if (valid.length === 0) return;
  
  try {
    const group = L.featureGroup();
    valid.forEach(r => group.addLayer(L.marker([r._geoloc.lat, r._geoloc.lng])));
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
      console.log('🔍 Zoom adjusted to show markers');
    }
  } catch (e) {
    console.warn('⚠️ Could not adjust zoom:', e);
  }
}

// ============ CALCULATE RADIUS ============

function calculateRadiusFromZoom(zoom) {
  const radiusMap = {
    3: 500000,
    4: 400000,
    5: 250000,
    6: 150000,
    7: 80000,
    8: 50000,
    9: 30000,
    10: 20000,
    11: 15000,
    12: 10000,
    13: 7000,
    14: 5000,
    15: 3000,
    16: 2000,
    17: 1500,
    18: 1000
  };
  return radiusMap[Math.round(zoom)] || 50000;
}

// ============ RENDER PAYMENTS ============

function renderPayments(payments) {
  if (!payments || payments.length === 0) return '';
  const emojis = { 'AMEX': '💳', 'Discover': '💳', 'MasterCard': '💳', 'Visa': '💳', 'Cash Only': '💵' };
  return payments.map(p => `<span class="result-card__payment">${emojis[p] || '💳'} ${p}</span>`).join('');
}

// ============ INSTANTSEARCH WIDGETS ============

// ELIMINADO: hits widget - usamos updateListUI manual
// ELIMINADO: stats widget - usamos updateStats manual

search.addWidgets([
  // Search Box
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

  // Filters
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

// ============ INTERCEPT SEARCH BOX INPUT ============

// We need to intercept the search box to trigger our custom search
const searchBoxInput = document.querySelector('.ais-SearchBox-input');
if (searchBoxInput) {
  let lastQueryValue = '';
  
  // Override the search box behavior
  searchBoxInput.addEventListener('input', function() {
    const query = this.value || '';
    if (query !== lastQueryValue) {
      lastQueryValue = query;
      clearTimeout(window._searchTimeout);
      window._searchTimeout = setTimeout(() => {
        console.log(`🔍 Search input: "${query}"`);
        performSearch(query);
      }, 300);
    }
  });
  
  searchBoxInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = this.value || '';
      console.log(`🔍 Enter pressed: "${query}"`);
      performSearch(query);
    }
  });
}

// ============ INTERCEPT FILTER CHANGES ============

if (search.helper) {
  search.helper.on('change', function() {
    console.log('🔄 Filter changed, updating results...');
    setTimeout(() => {
      const query = searchBoxInput?.value || '';
      if (query && query.trim() !== '') {
        performSearch(query);
      } else {
        searchByMapView();
      }
    }, 200);
  });
}

// ============ INITIALIZE ============

console.log('🚀 Initializing application...');

setTimeout(initMap, 500);

setTimeout(function() {
  console.log('🔍 Running initial search by map view...');
  searchByMapView();
}, 800);

// ============ UI EVENT LISTENERS ============

document.getElementById('filters-toggle')?.addEventListener('click', function() {
  document.getElementById('filters-panel').classList.toggle('open');
});

document.getElementById('clear-filters')?.addEventListener('click', function() {
  if (search && search.helper) {
    search.helper.clearRefinements().search();
  }
  if (searchBoxInput) {
    searchBoxInput.value = '';
  }
  setTimeout(() => {
    searchByMapView();
  }, 200);
});

document.getElementById('show-more-btn')?.addEventListener('click', function() {
  if (search && search.helper) {
    search.helper.nextPage();
    setTimeout(() => {
      const query = searchBoxInput?.value || '';
      if (query && query.trim() !== '') {
        performSearch(query);
      } else {
        searchByMapView();
      }
    }, 300);
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
  setTimeout(() => {
    const query = searchBoxInput?.value || '';
    if (query && query.trim() !== '') {
      performSearch(query);
    } else {
      searchByMapView();
    }
  }, 300);
});

// ============ CARD CLICK → ZOOM ============

document.addEventListener('click', function(e) {
  const card = e.target.closest('.result-card');
  if (card && map) {
    const lat = parseFloat(card.dataset.lat);
    const lng = parseFloat(card.dataset.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], 14, { duration: 1.2 });
    }
  }
});

console.log('✅ Restaurant Locator initialized!');
console.log('💡 6 resultados por página');
console.log('💡 Map search and text search integrated');