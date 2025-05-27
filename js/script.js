// State management
const state = {
    cryptoData: [],
    filteredCryptoData: [],
    currentPage: 1,
    itemsPerPage: 50,
    activeTab: 'crypto',
    btcPrice: 0,
    lastUpdated: null,
    currency: 'USD'
};

// DOM elements
const elements = {
    cryptoTableBody: document.getElementById('cryptoTableBody'),
    totalMarketCap: document.getElementById('totalMarketCap'),
    totalVolume: document.getElementById('totalVolume'),
    btcDominance: document.getElementById('btcDominance'),
    overviewMarketCap: document.getElementById('overviewMarketCap'),
    overviewVolume: document.getElementById('overviewVolume'),
    overviewBTCDom: document.getElementById('overviewBTCDom'),
    marketCapChange: document.getElementById('marketCapChange'),
    volumeChange: document.getElementById('volumeChange'),
    btcDomChange: document.getElementById('btcDomChange'),
    cryptoStart: document.getElementById('cryptoStart'),
    cryptoEnd: document.getElementById('cryptoEnd'),
    cryptoTotal: document.getElementById('cryptoTotal'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    searchInput: document.getElementById('searchInput'),
    currencySelect: document.getElementById('currencySelect'),
    cryptoTabBtn: document.getElementById('cryptoTabBtn'),
    exchangeTabBtn: document.getElementById('exchangeTabBtn'),
    gainersTabBtn: document.getElementById('gainersTabBtn'),
    trendingTabBtn: document.getElementById('trendingTabBtn')
};

// Exchange API endpoints with CORS proxy
const API_ENDPOINTS = {
    BINANCE: "https://api.binance.com/api/v3",
    COINGECKO: "https://api.coingecko.com/api/v3",
    COINCAP: "https://api.coincap.io/v2"
};

// Add error handling for fetch requests
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// Fetch cryptocurrency data
async function fetchCryptoData() {
    try {
        showLoading();
        
        // Using CoinGecko as primary data source (more reliable for this use case)
        const response = await fetchWithTimeout(`${API_ENDPOINTS.COINGECKO}/coins/markets?vs_currency=${state.currency}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`);
        const data = await response.json();
        
        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid data format received from API');
        }
        
        // Get BTC price for dominance calculation
        const btcResponse = await fetchWithTimeout(`${API_ENDPOINTS.COINGECKO}/simple/price?ids=bitcoin&vs_currencies=${state.currency}`);
        const btcData = await btcResponse.json();
        state.btcPrice = btcData.bitcoin[state.currency.toLowerCase()];
        
        // Process the data
        state.cryptoData = data.map(coin => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            rank: coin.market_cap_rank,
            current_price: coin.current_price,
            price_change_percentage_24h: coin.price_change_percentage_24h,
            total_volume: coin.total_volume,
            market_cap: coin.market_cap,
            image: coin.image,
            sparkline: coin.sparkline_in_7d?.price || []
        }));
        
        state.filteredCryptoData = [...state.cryptoData];
        calculateGlobalStats();
        renderCryptoTable();
        updateLastUpdated();
        hideLoading();
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        hideLoading();
        showError();
        // Fallback to local data or cached data if available
        tryFallbackData();
    }
}

// Calculate global market statistics
function calculateGlobalStats() {
    if (!state.cryptoData.length) return;
    
    const totalMarketCap = state.cryptoData.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const totalVolume = state.cryptoData.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);
    
    // Find BTC in the data
    const btc = state.cryptoData.find(coin => coin.symbol === 'BTC');
    const btcDominance = btc ? (btc.market_cap / totalMarketCap) * 100 : 0;
    
    // Update DOM elements
    elements.totalMarketCap.textContent = formatCurrency(totalMarketCap);
    elements.totalVolume.textContent = formatCurrency(totalVolume);
    elements.btcDominance.textContent = btcDominance.toFixed(2) + '%';
    
    elements.overviewMarketCap.textContent = formatCurrency(totalMarketCap);
    elements.overviewVolume.textContent = formatCurrency(totalVolume);
    elements.overviewBTCDom.textContent = btcDominance.toFixed(2) + '%';
    
    // For demo purposes, setting arbitrary changes
    elements.marketCapChange.textContent = '0.45%';
    elements.volumeChange.textContent = '2.31%';
    elements.btcDomChange.textContent = '-0.12%';
    
    // Add appropriate classes for positive/negative changes
    elements.marketCapChange.className = 'change-value positive-change';
    elements.volumeChange.className = 'change-value positive-change';
    elements.btcDomChange.className = 'change-value negative-change';
}

// Format currency values
function formatCurrency(value) {
    if (value >= 1000000000) {
        return '$' + (value / 1000000000).toFixed(2) + 'B';
    }
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    }
    if (value >= 1000) {
        return '$' + (value / 1000).toFixed(2) + 'K';
    }
    return '$' + value.toFixed(2);
}

// Render the crypto table
function renderCryptoTable() {
    if (!elements.cryptoTableBody || !state.filteredCryptoData.length) {
        console.error('Table body not found or no data available');
        return;
    }

    const startIdx = (state.currentPage - 1) * state.itemsPerPage;
    const endIdx = startIdx + state.itemsPerPage;
    const paginatedData = state.filteredCryptoData.slice(startIdx, endIdx);

    elements.cryptoTableBody.innerHTML = '';

    paginatedData.forEach(coin => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => showCoinDetails(coin.id));

        const change = coin.price_change_percentage_24h || 0;
        const changeClass = change >= 0 ? 'positive-change' : 'negative-change';

        row.innerHTML = `
            <td>${coin.rank || '--'}</td>
            <td class="font-medium">
                <img src="${coin.image}" alt="${coin.name}" class="w-6 h-6 mr-2 inline-block">
                ${coin.symbol || '--'}
            </td>
            <td>${coin.current_price ? formatCurrency(coin.current_price) : '--'}</td>
            <td class="${changeClass}">${change.toFixed(2)}%</td>
            <td>${coin.total_volume ? formatCurrency(coin.total_volume) : '--'}</td>
            <td>${coin.market_cap ? formatCurrency(coin.market_cap) : '--'}</td>
            <td><div class="sparkline" id="sparkline-${coin.id}" data-values="${coin.sparkline.join(',')}"></div></td>
            <td>Binance, OKX, XT</td>
        `;

        elements.cryptoTableBody.appendChild(row);
    });

    // Update pagination info
    updatePagination();
    
    // Render sparkline charts
    renderSparklines();
}

// Render sparkline charts
function renderSparklines() {
    state.filteredCryptoData.slice(
        (state.currentPage - 1) * state.itemsPerPage,
        state.currentPage * state.itemsPerPage
    ).forEach(coin => {
        const sparklineElement = document.getElementById(`sparkline-${coin.id}`);
        if (!sparklineElement) return;
        
        const values = sparklineElement.getAttribute('data-values').split(',').map(Number);
        if (!values.length) return;
        
        new Chart(sparklineElement, {
            type: 'line',
            data: {
                labels: Array(values.length).fill(''),
                datasets: [{
                    data: values,
                    borderColor: values[0] <= values[values.length - 1] ? '#10B981' : '#EF4444',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    });
}

// Update pagination controls
function updatePagination() {
    const totalItems = state.filteredCryptoData.length;
    const startItem = (state.currentPage - 1) * state.itemsPerPage + 1;
    const endItem = Math.min(state.currentPage * state.itemsPerPage, totalItems);
    
    elements.cryptoStart.textContent = startItem;
    elements.cryptoEnd.textContent = endItem;
    elements.cryptoTotal.textContent = totalItems;
    
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.nextPageBtn.disabled = endItem >= totalItems;
    
    if (elements.prevPageBtn.disabled) {
        elements.prevPageBtn.classList.add('disabled');
    } else {
        elements.prevPageBtn.classList.remove('disabled');
    }
    
    if (elements.nextPageBtn.disabled) {
        elements.nextPageBtn.classList.add('disabled');
    } else {
        elements.nextPageBtn.classList.remove('disabled');
    }
}

// Show coin details modal
function showCoinDetails(coinId) {
    const modal = document.getElementById('detailModal');
    const modalContent = document.getElementById('modalContent');
    const modalLoading = document.getElementById('modalLoading');
    const modalError = document.getElementById('modalError');
    
    modal.classList.remove('hidden');
    modalLoading.classList.remove('hidden');
    modalError.classList.add('hidden');
    
    // Simulate loading details
    setTimeout(() => {
        const coin = state.cryptoData.find(c => c.id === coinId);
        if (coin) {
            modalLoading.classList.add('hidden');
            modalContent.innerHTML = `
                <div class="coin-details">
                    <div class="flex items-center mb-4">
                        <img src="${coin.image}" alt="${coin.name}" class="w-12 h-12 mr-3">
                        <div>
                            <h2 class="text-xl font-bold">${coin.name} (${coin.symbol})</h2>
                            <p class="text-gray-600">Rank: #${coin.rank}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="detail-card">
                            <p class="detail-label">Price</p>
                            <p class="detail-value">${formatCurrency(coin.current_price)}</p>
                        </div>
                        <div class="detail-card">
                            <p class="detail-label">24h Change</p>
                            <p class="detail-value ${coin.price_change_percentage_24h >= 0 ? 'positive-change' : 'negative-change'}">
                                ${coin.price_change_percentage_24h.toFixed(2)}%
                            </p>
                        </div>
                        <div class="detail-card">
                            <p class="detail-label">Market Cap</p>
                            <p class="detail-value">${formatCurrency(coin.market_cap)}</p>
                        </div>
                        <div class="detail-card">
                            <p class="detail-label">24h Volume</p>
                            <p class="detail-value">${formatCurrency(coin.total_volume)}</p>
                        </div>
                    </div>
                    <div class="chart-container mb-4">
                        <canvas id="detailChart"></canvas>
                    </div>
                    <div class="exchanges-list">
                        <h3 class="text-lg font-semibold mb-2">Available On</h3>
                        <ul class="space-y-2">
                            <li class="exchange-item">Binance</li>
                            <li class="exchange-item">OKX</li>
                            <li class="exchange-item">XT.com</li>
                        </ul>
                    </div>
                </div>
            `;
            
            // Render detailed chart
            const ctx = document.getElementById('detailChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: coin.sparkline.map((_, i) => i),
                    datasets: [{
                        label: '7 Day Price',
                        data: coin.sparkline,
                        borderColor: coin.price_change_percentage_24h >= 0 ? '#10B981' : '#EF4444',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { display: false },
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            }
                        }
                    }
                }
            });
        } else {
            modalLoading.classList.add('hidden');
            modalError.classList.remove('hidden');
        }
    }, 1000);
}

// Try to load fallback data if API fails
function tryFallbackData() {
    // In a real app, you might load cached data or a local JSON file
    console.log('Attempting to load fallback data...');
    
    // For demo purposes, we'll just show an empty state
    state.cryptoData = [];
    state.filteredCryptoData = [];
    renderCryptoTable();
}

// UI state functions
function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

function showError() {
    document.getElementById('errorMessage').classList.remove('hidden');
}

function updateLastUpdated() {
    const now = new Date();
    state.lastUpdated = now;
    document.getElementById('timestamp').textContent = now.toLocaleString();
    document.getElementById('lastUpdated').classList.remove('hidden');
}

// Event handlers
function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', fetchCryptoData);
    
    // Pagination buttons
    elements.prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderCryptoTable();
        }
    });
    
    elements.nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(state.filteredCryptoData.length / state.itemsPerPage);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderCryptoTable();
        }
    });
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        state.filteredCryptoData = state.cryptoData.filter(coin => 
            coin.name.toLowerCase().includes(searchTerm) || 
            coin.symbol.toLowerCase().includes(searchTerm)
        );
        state.currentPage = 1;
        renderCryptoTable();
    });
    
    // Currency select
    elements.currencySelect.addEventListener('change', (e) => {
        state.currency = e.target.value;
        fetchCryptoData();
    });
    
    // Tab buttons
    elements.cryptoTabBtn.addEventListener('click', () => {
        state.activeTab = 'crypto';
        updateActiveTab();
    });
    
    elements.exchangeTabBtn.addEventListener('click', () => {
        state.activeTab = 'exchange';
        updateActiveTab();
    });
    
    elements.gainersTabBtn.addEventListener('click', () => {
        state.activeTab = 'gainers';
        updateActiveTab();
    });
    
    elements.trendingTabBtn.addEventListener('click', () => {
        state.activeTab = 'trending';
        updateActiveTab();
    });
    
    // Modal close button
    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('detailModal').classList.add('hidden');
    });
}

// Update active tab styling
function updateActiveTab() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${state.activeTab}TabBtn`).classList.add('active');
}

// Initialize the app
async function init() {
    setupEventListeners();
    await fetchCryptoData();
    setInterval(fetchCryptoData, 60000); // Refresh every minute
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
