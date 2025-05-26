// DOM Elements
const elements = {
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorMessage: document.getElementById('errorMessage'),
    lastUpdated: document.getElementById('lastUpdated'),
    timestamp: document.getElementById('timestamp'),
    searchInput: document.getElementById('searchInput'),
    currencySelect: document.getElementById('currencySelect'),
    refreshBtn: document.getElementById('refreshBtn'),
    globalStats: document.getElementById('globalStats'),
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
    detailModal: document.getElementById('detailModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalContent: document.getElementById('modalContent'),
    modalLoading: document.getElementById('modalLoading'),
    modalError: document.getElementById('modalError'),
    cryptoTableBody: document.getElementById('cryptoTableBody')
};

// Tab elements
const tabs = {
    cryptoTabBtn: document.getElementById('cryptoTabBtn'),
    exchangeTabBtn: document.getElementById('exchangeTabBtn'),
    gainersTabBtn: document.getElementById('gainersTabBtn'),
    trendingTabBtn: document.getElementById('trendingTabBtn'),
    cryptoSection: document.getElementById('cryptoSection'),
    exchangeSection: document.getElementById('exchangeSection'),
    gainersSection: document.getElementById('gainersSection'),
    trendingSection: document.getElementById('trendingSection')
};

// App state
const state = {
    activeTab: 'crypto',
    currency: 'USD',
    cryptoData: [],
    exchangeData: [],
    gainersData: [],
    losersData: [],
    trendingData: {
        mostSearched: [],
        highestVolume: [],
        newListings: []
    },
    filteredCryptoData: [],
    currentPage: 1,
    itemsPerPage: 100,
    sortConfig: {
        key: 'market_cap',
        direction: 'desc'
    },
    btcPrice: 0
};

// Exchange API endpoints
const API_ENDPOINTS = {
    BINANCE: 'https://api.binance.com/api/v3',
    OKX: 'https://www.okx.com/api/v5',
    XT: 'https://api.xt.com'
};

// Initialize the app
async function init() {
    setupEventListeners();
    await fetchAllData();
    setInterval(fetchAllData, 60000); // Refresh every 60 seconds
}

// Set up event listeners
function setupEventListeners() {
    // Tab switching
    tabs.cryptoTabBtn.addEventListener('click', () => switchTab('crypto'));
    tabs.exchangeTabBtn.addEventListener('click', () => switchTab('exchange'));
    tabs.gainersTabBtn.addEventListener('click', () => switchTab('gainers'));
    tabs.trendingTabBtn.addEventListener('click', () => switchTab('trending'));

    // Search input
    elements.searchInput.addEventListener('input', () => {
        if (state.activeTab === 'crypto') {
            filterCryptoData();
        }
    });

    // Currency selection
    elements.currencySelect.addEventListener('change', (e) => {
        state.currency = e.target.value;
        renderAllData();
    });

    // Refresh button
    elements.refreshBtn.addEventListener('click', fetchAllData);

    // Pagination
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

    // Modal close
    elements.closeModalBtn.addEventListener('click', () => {
        elements.detailModal.classList.add('hidden');
    });

    // Table sorting
    document.querySelectorAll('.table-head[onclick]').forEach(header => {
        header.addEventListener('click', (e) => {
            const key = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            sortTable(key);
        });
    });
}

// Switch between tabs
function switchTab(tab) {
    state.activeTab = tab;
    
    // Update UI
    Object.values(tabs).forEach(t => t?.classList?.remove('active'));
    tabs[`${tab}TabBtn`].classList.add('active');
    
    Object.values(tabs).forEach(t => {
        if (t?.id?.includes('Section')) t.classList.add('hidden');
    });
    tabs[`${tab}Section`]?.classList?.remove('hidden');
    
    // Reset search placeholder
    switch(tab) {
        case 'crypto':
            elements.searchInput.placeholder = 'Search cryptocurrencies...';
            break;
        case 'exchange':
            elements.searchInput.placeholder = 'Search exchanges...';
            break;
        case 'gainers':
        case 'trending':
            elements.searchInput.placeholder = 'Search...';
            break;
    }
}

// Fetch all data from APIs
async function fetchAllData() {
    try {
        elements.loadingIndicator.classList.remove('hidden');
        elements.errorMessage.classList.add('hidden');
        
        // Get BTC price first as it's needed for dominance calculation
        const btcResponse = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/price?symbol=BTCUSDT`);
        const btcData = await btcResponse.json();
        state.btcPrice = parseFloat(btcData.price);
        
        // Fetch data from multiple sources in parallel
        await Promise.all([
            fetchCryptoData(),
            fetchExchangeData(),
            fetchGainersLosersData(),
            fetchTrendingData()
        ]);
        
        updateTimestamp();
        renderAllData();
    } catch (error) {
        console.error('Error fetching data:', error);
        elements.errorMessage.classList.remove('hidden');
    } finally {
        elements.loadingIndicator.classList.add('hidden');
    }
}

// Fetch cryptocurrency data from exchanges
async function fetchCryptoData() {
    try {
        // Get all ticker data from Binance
        const tickerResponse = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const tickerData = await tickerResponse.json();
        
        // Process the data into our format (only USDT pairs)
        const processedData = tickerData
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => {
                const symbol = t.symbol.replace('USDT', '');
                const price = parseFloat(t.lastPrice);
                const volume = parseFloat(t.quoteVolume);
                const change = parseFloat(t.priceChangePercent);
                
                // Approximate market cap (price * circulating supply estimate)
                // Note: Without CoinGecko, we don't have exact circulating supply
                // so we use volume as a proxy for market cap ranking
                const marketCap = price * (volume / price) * 100; // Rough approximation
                
                return {
                    id: symbol.toLowerCase(),
                    symbol: symbol,
                    name: symbol,
                    rank: 0, // Will be set after sorting
                    current_price: price,
                    price_change_percentage_24h: change,
                    total_volume: volume,
                    market_cap: marketCap,
                    sparkline: null,
                    exchanges: {
                        binance: price,
                        okx: null,
                        xt: null
                    }
                };
            });
        
        // Enhance with data from other exchanges
        const enhancedData = await Promise.all(processedData.map(async (coin) => {
            const [okxPrice, xtPrice] = await Promise.all([
                getExchangePrice(coin.symbol, 'OKX'),
                getExchangePrice(coin.symbol, 'XT')
            ]);
            
            // Calculate average price
            const prices = [coin.exchanges.binance, okxPrice, xtPrice].filter(p => p !== null);
            const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : coin.current_price;
            
            return {
                ...coin,
                current_price: avgPrice,
                exchanges: {
                    binance: coin.exchanges.binance,
                    okx: okxPrice,
                    xt: xtPrice
                }
            };
        }));
        
        // Sort by market cap descending and assign ranks
        enhancedData.sort((a, b) => b.market_cap - a.market_cap);
        enhancedData.forEach((coin, index) => {
            coin.rank = index + 1;
        });
        
        state.cryptoData = enhancedData;
        state.filteredCryptoData = [...enhancedData];
        
        // Calculate global stats
        calculateGlobalStats();
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        throw error;
    }
}

// Get price from a specific exchange
async function getExchangePrice(symbol, exchange) {
    try {
        switch(exchange) {
            case 'OKX':
                const okxResponse = await fetch(`${API_ENDPOINTS.OKX}/market/ticker?instId=${symbol}-USDT`);
                const okxData = await okxResponse.json();
                if (okxData.data && okxData.data.length > 0 && okxData.data[0].last) {
                    return parseFloat(okxData.data[0].last);
                }
                break;
                
            case 'XT':
                const xtResponse = await fetch(`${API_ENDPOINTS.XT}/trade/api/v1/getTicker?symbol=${symbol.toLowerCase()}_usdt`);
                const xtData = await xtResponse.json();
                if (xtData.result && xtData.ticker && xtData.ticker.last) {
                    return parseFloat(xtData.ticker.last);
                }
                break;
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting price from ${exchange} for ${symbol}:`, error);
        return null;
    }
}

// Fetch exchange data
async function fetchExchangeData() {
    try {
        // Get Binance exchange data
        const binanceTickerResponse = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const binanceTickerData = await binanceTickerResponse.json();
        
        // Calculate Binance 24h volume (sum of all USDT pairs)
        const binanceVolume = binanceTickerData
            .filter(t => t.symbol.endsWith('USDT'))
            .reduce((sum, t) => sum + parseFloat(t.quoteVolume), 0);
        
        // Get OKX exchange data
        const okxResponse = await fetch(`${API_ENDPOINTS.OKX}/market/tickers?instType=SPOT`);
        const okxData = await okxResponse.json();
        
        // Calculate OKX 24h volume
        const okxVolume = okxData.data
            ? okxData.data.filter(t => t.instId.endsWith('-USDT'))
                .reduce((sum, t) => sum + parseFloat(t.vol24h) * parseFloat(t.last), 0)
            : 0;
        
        // Get XT exchange data
        const xtResponse = await fetch(`${API_ENDPOINTS.XT}/trade/api/v1/getTickers`);
        const xtData = await xtResponse.json();
        
        // Calculate XT 24h volume
        const xtVolume = xtData.result
            ? xtData.result.filter(t => t.symbol.endsWith('_usdt'))
                .reduce((sum, t) => sum + parseFloat(t.quoteVolume)), 0)
            : 0;
        
        // Process into our format
        state.exchangeData = [
            {
                id: 'binance',
                name: 'Binance',
                trust_score: 10,
                volume_24h_usd: binanceVolume,
                pairs: binanceTickerData.filter(t => t.symbol.endsWith('USDT')).length,
                liquidity: 'Very High'
            },
            {
                id: 'okx',
                name: 'OKX',
                trust_score: 9,
                volume_24h_usd: okxVolume,
                pairs: okxData.data ? okxData.data.filter(t => t.instId.endsWith('-USDT')).length : 0,
                liquidity: 'High'
            },
            {
                id: 'xt',
                name: 'XT.com',
                trust_score: 8,
                volume_24h_usd: xtVolume,
                pairs: xtData.result ? xtData.result.filter(t => t.symbol.endsWith('_usdt')).length : 0,
                liquidity: 'Medium'
            }
        ];
    } catch (error) {
        console.error('Error fetching exchange data:', error);
        throw error;
    }
}

// Fetch gainers and losers data
async function fetchGainersLosersData() {
    try {
        // Get data from Binance
        const response = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const data = await response.json();
        
        // Filter for USDT pairs and map to our format
        const usdtPairs = data
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => ({
                symbol: t.symbol.replace('USDT', ''),
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChangePercent),
                volume: parseFloat(t.quoteVolume)
            }));
        
        // Sort by price change
        const sorted = [...usdtPairs].sort((a, b) => b.change - a.change);
        
        // Get top 10 gainers and losers
        const gainers = sorted.slice(0, 10);
        const losers = sorted.slice(-10).reverse();
        
        state.gainersData = gainers;
        state.losersData = losers;
    } catch (error) {
        console.error('Error fetching gainers/losers data:', error);
        throw error;
    }
}

// Fetch trending data
async function fetchTrendingData() {
    try {
        // Get data from Binance
        const response = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const data = await response.json();
        
        // Filter for USDT pairs and map to our format
        const usdtPairs = data
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => ({
                symbol: t.symbol.replace('USDT', ''),
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChangePercent),
                volume: parseFloat(t.quoteVolume)
            }));
        
        // Sort by volume descending
        const sortedByVolume = [...usdtPairs].sort((a, b) => b.volume - a.volume);
        
        // Most searched and highest volume (using volume as proxy)
        const mostSearched = sortedByVolume.slice(0, 5);
        const highestVolume = sortedByVolume.slice(0, 5);
        
        // New listings - we can't get this from the API directly
        const newListings = [];
        
        state.trendingData = {
            mostSearched,
            highestVolume,
            newListings
        };
    } catch (error) {
        console.error('Error fetching trending data:', error);
        throw error;
    }
}

// Calculate global market statistics
function calculateGlobalStats() {
    if (state.cryptoData.length === 0) return;
    
    // Calculate total market cap and volume
    const totalMarketCap = state.cryptoData.reduce((sum, coin) => sum + coin.market_cap, 0);
    const totalVolume = state.cryptoData.reduce((sum, coin) => sum + coin.total_volume, 0);
    
    // Calculate BTC dominance
    const btc = state.cryptoData.find(coin => coin.symbol === 'BTC');
    const btcDominance = btc ? (btc.market_cap / totalMarketCap) * 100 : 0;
    
    // Update DOM elements
    elements.totalMarketCap.textContent = formatCurrency(totalMarketCap);
    elements.totalVolume.textContent = formatCurrency(totalVolume);
    elements.btcDominance.textContent = btcDominance.toFixed(2) + '%';
    
    elements.overviewMarketCap.textContent = formatCurrency(totalMarketCap);
    elements.overviewVolume.textContent = formatCurrency(totalVolume);
    elements.overviewBTCDom.textContent = btcDominance.toFixed(2) + '%';
    
    // For 24h changes, we'd need historical data which we don't have
    // So we'll set these to neutral for now
    elements.marketCapChange.textContent = '--%';
    elements.marketCapChange.className = 'change-value neutral-change';
    elements.volumeChange.textContent = '--%';
    elements.volumeChange.className = 'change-value neutral-change';
    elements.btcDomChange.textContent = '--%';
    elements.btcDomChange.className = 'change-value neutral-change';
}

// Format currency value
function formatCurrency(value) {
    if (value >= 1e12) {
        return '$' + (value / 1e12).toFixed(2) + 'T';
    } else if (value >= 1e9) {
        return '$' + (value / 1e9).toFixed(2) + 'B';
    } else if (value >= 1e6) {
        return '$' + (value / 1e6).toFixed(2) + 'M';
    } else if (value >= 1e3) {
        return '$' + (value / 1e3).toFixed(2) + 'K';
    }
    return '$' + value.toFixed(2);
}

// Update timestamp
function updateTimestamp() {
    const now = new Date();
    elements.timestamp.textContent = now.toLocaleString();
    elements.lastUpdated.classList.remove('hidden');
}

// Filter crypto data based on search input
function filterCryptoData() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        state.filteredCryptoData = [...state.cryptoData];
    } else {
        state.filteredCryptoData = state.cryptoData.filter(coin => 
            coin.name.toLowerCase().includes(searchTerm) || 
            coin.symbol.toLowerCase().includes(searchTerm)
        );
    }
    
    state.currentPage = 1;
    renderCryptoTable();
}

// Sort table by column
function sortTable(key) {
    // If already sorted by this key, reverse the direction
    if (state.sortConfig.key === key) {
        state.sortConfig.direction = state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Otherwise, sort by this key in descending order by default
        state.sortConfig.key = key;
        state.sortConfig.direction = 'desc';
    }
    
    state.filteredCryptoData.sort((a, b) => {
        // Handle different data types
        let valueA = a[key];
        let valueB = b[key];
        
        // For strings, compare case-insensitively
        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }
        
        if (valueA < valueB) {
            return state.sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valueA > valueB) {
            return state.sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    renderCryptoTable();
}

// Render all data based on current state
function renderAllData() {
    switch(state.activeTab) {
        case 'crypto':
            renderCryptoTable();
            break;
        case 'exchange':
            renderExchangeTable();
            break;
        case 'gainers':
            renderGainersLosers();
            break;
        case 'trending':
            renderTrending();
            break;
    }
    
    // Always render market overview
    calculateGlobalStats();
}

// Render cryptocurrency table
function renderCryptoTable() {
    if (!elements.cryptoTableBody) return;
    
    const startIdx = (state.currentPage - 1) * state.itemsPerPage;
    const endIdx = startIdx + state.itemsPerPage;
    const paginatedData = state.filteredCryptoData.slice(startIdx, endIdx);
    
    elements.cryptoTableBody.innerHTML = '';
    
    paginatedData.forEach(coin => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => showCoinDetails(coin.id));
        
        // Determine change class
        const changeClass = coin.price_change_percentage_24h >= 0 
            ? 'positive-change' 
            : 'negative-change';
        
        row.innerHTML = `
            <td>${coin.rank}</td>
            <td class="font-medium">${coin.symbol}</td>
            <td>${formatCurrency(coin.current_price)}</td>
            <td class="${changeClass}">${coin.price_change_percentage_24h.toFixed(2)}%</td>
            <td>${formatCurrency(coin.total_volume)}</td>
            <td>${formatCurrency(coin.market_cap)}</td>
            <td><div class="sparkline" id="sparkline-${coin.id}"></div></td>
            <td>
                ${coin.exchanges.binance ? 'Binance' : ''}
                ${coin.exchanges.okx ? ', OKX' : ''}
                ${coin.exchanges.xt ? ', XT' : ''}
            </td>
        `;
        
        elements.cryptoTableBody.appendChild(row);
        
        // In a real app, you would render sparkline charts here
        // renderSparkline(coin.id, coin.sparkline);
    });
    
    // Update pagination info
    elements.cryptoStart.textContent = startIdx + 1;
    elements.cryptoEnd.textContent = Math.min(endIdx, state.filteredCryptoData.length);
    elements.cryptoTotal.textContent = state.filteredCryptoData.length;
    
    // Update pagination buttons
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.prevPageBtn.classList.toggle('disabled', state.currentPage === 1);
    
    const totalPages = Math.ceil(state.filteredCryptoData.length / state.itemsPerPage);
    elements.nextPageBtn.disabled = state.currentPage >= totalPages;
    elements.nextPageBtn.classList.toggle('disabled', state.currentPage >= totalPages);
}

// Show coin details in modal
function showCoinDetails(coinId) {
    elements.detailModal.classList.remove('hidden');
    elements.modalLoading.classList.remove('hidden');
    elements.modalError.classList.add('hidden');
    
    // In a real app, you would fetch detailed data here
    setTimeout(() => {
        const coin = state.cryptoData.find(c => c.id === coinId);
        if (coin) {
            elements.modalContent.innerHTML = `
                <h2 class="text-xl font-bold mb-4">${coin.symbol} Details</h2>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-gray-600">Price:</p>
                        <p class="text-lg font-semibold">${formatCurrency(coin.current_price)}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">24h Change:</p>
                        <p class="text-lg ${coin.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'}">
                            ${coin.price_change_percentage_24h.toFixed(2)}%
                        </p>
                    </div>
                    <div>
                        <p class="text-gray-600">24h Volume:</p>
                        <p class="text-lg">${formatCurrency(coin.total_volume)}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">Market Cap:</p>
                        <p class="text-lg">${formatCurrency(coin.market_cap)}</p>
                    </div>
                </div>
                <div class="mt-4">
                    <h3 class="font-semibold mb-2">Available on:</h3>
                    <ul class="list-disc pl-5">
                        ${coin.exchanges.binance ? '<li>Binance</li>' : ''}
                        ${coin.exchanges.okx ? '<li>OKX</li>' : ''}
                        ${coin.exchanges.xt ? '<li>XT.com</li>' : ''}
                    </ul>
                </div>
            `;
        } else {
            elements.modalError.classList.remove('hidden');
        }
        elements.modalLoading.classList.add('hidden');
    }, 500);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
