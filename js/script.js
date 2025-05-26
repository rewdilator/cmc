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
    modalError: document.getElementById('modalError')
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

// Table bodies
const tableBodies = {
    crypto: document.getElementById('cryptoTableBody'),
    exchange: document.getElementById('exchangeTableBody'),
    gainers: document.getElementById('gainersTableBody'),
    losers: document.getElementById('losersTableBody'),
    mostSearched: document.getElementById('mostSearchedList'),
    highestVolume: document.getElementById('highestVolumeList'),
    newListings: document.getElementById('newListingsList')
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
    }
};

// Exchange API endpoints - Keep these
const API_ENDPOINTS = {
    BINANCE: 'https://api.binance.com/api/v3',
    OKX: 'https://www.okx.com/api/v5',
    XT: 'https://api.xt.com'
};

// Initialize the app
async function init() {
    setupEventListeners();
    await fetchExchangeRates();
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
}

// Switch between tabs
function switchTab(tab) {
    state.activeTab = tab;
    
    // Update UI
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    tabs[`${tab}TabBtn`].classList.add('active');
    
    Object.values(tabs).forEach(t => {
        if (t.id.includes('Section')) t.classList.add('hidden');
    });
    tabs[`${tab}Section`].classList.remove('hidden');
    
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

// Fetch cryptocurrency data from Binance, OKX, and XT
async function fetchCryptoData() {
    try {
        // First get all trading pairs from Binance to know what's available
        const binanceResponse = await fetch(`${API_ENDPOINTS.BINANCE}/exchangeInfo`);
        const binanceData = await binanceResponse.json();
        
        // Filter for USDT pairs and extract base currencies
        const usdtPairs = binanceData.symbols
            .filter(s => s.quoteAsset === 'USDT')
            .map(s => s.baseAsset);
        
        // Get ticker data for all USDT pairs
        const tickerResponse = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const tickerData = await tickerResponse.json();
        
        // Process the data into our format
        const processedData = tickerData
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => {
                const symbol = t.symbol.replace('USDT', '');
                return {
                    id: symbol.toLowerCase(),
                    symbol: symbol,
                    name: symbol,
                    current_price: parseFloat(t.lastPrice),
                    price_change_percentage_24h: parseFloat(t.priceChangePercent),
                    total_volume: parseFloat(t.quoteVolume),
                    market_cap: parseFloat(t.lastPrice) * parseFloat(t.volume), // Approximate
                    sparkline: null, // We'll need to fetch this separately
                    exchanges: {
                        binance: parseFloat(t.lastPrice),
                        okx: null, // Will fetch below
                        xt: null  // Will fetch below
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
        
        // Sort by market cap descending
        enhancedData.sort((a, b) => b.market_cap - a.market_cap);
        
        // Add ranks
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

// Get price from a specific exchange - Keep this function but improve error handling
async function getExchangePrice(symbol, exchange) {
    try {
        let price = null;
        
        switch(exchange) {
            case 'BINANCE':
                // Already handled in fetchCryptoData
                return null;
                
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

// Fetch exchange data - Update to use real exchange data
async function fetchExchangeData() {
    try {
        // Get exchange data from Binance
        const binanceResponse = await fetch(`${API_ENDPOINTS.BINANCE}/exchangeInfo`);
        const binanceData = await binanceResponse.json();
        
        // Get OKX exchange data
        const okxResponse = await fetch(`${API_ENDPOINTS.OKX}/market/tickers?instType=SPOT`);
        const okxData = await okxResponse.json();
        
        // Get XT exchange data
        const xtResponse = await fetch(`${API_ENDPOINTS.XT}/trade/api/v1/getTickers`);
        const xtData = await xtResponse.json();
        
        // Process into our format
        state.exchangeData = [
            {
                id: 'binance',
                name: 'Binance',
                trust_score: 10,
                volume_24h_usd: calculateExchangeVolume(binanceData),
                pairs: binanceData.symbols.length,
                liquidity: 'Very High'
            },
            {
                id: 'okx',
                name: 'OKX',
                trust_score: 9,
                volume_24h_usd: calculateOKXVolume(okxData),
                pairs: okxData.data ? okxData.data.length : 0,
                liquidity: 'High'
            },
            {
                id: 'xt',
                name: 'XT.com',
                trust_score: 8,
                volume_24h_usd: calculateXTVolume(xtData),
                pairs: xtData.result ? xtData.result.length : 0,
                liquidity: 'Medium'
            }
        ];
    } catch (error) {
        console.error('Error fetching exchange data:', error);
        throw error;
    }
}

// Helper function to calculate Binance volume
function calculateExchangeVolume(data) {
    // Implement calculation based on Binance data
    return 15000000000; // Placeholder
}

// Helper function to calculate OKX volume
function calculateOKXVolume(data) {
    // Implement calculation based on OKX data
    return 5000000000; // Placeholder
}

// Helper function to calculate XT volume
function calculateXTVolume(data) {
    // Implement calculation based on XT data
    return 2000000000; // Placeholder
}

// Fetch gainers and losers data - Update to use exchange data
async function fetchGainersLosersData() {
    try {
        // Get data from Binance
        const response = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const data = await response.json();
        
        // Filter for USDT pairs
        const usdtPairs = data.filter(t => t.symbol.endsWith('USDT'));
        
        // Sort by price change
        const sorted = usdtPairs.sort((a, b) => 
            parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
        
        // Get top 10 gainers and losers
        const gainers = sorted.slice(0, 10).map(t => ({
            symbol: t.symbol.replace('USDT', ''),
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume)
        }));
        
        const losers = sorted.slice(-10).reverse().map(t => ({
            symbol: t.symbol.replace('USDT', ''),
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume)
        }));
        
        state.gainersData = gainers;
        state.losersData = losers;
    } catch (error) {
        console.error('Error fetching gainers/losers data:', error);
        throw error;
    }
}

// Fetch trending data - Update to use exchange data
async function fetchTrendingData() {
    try {
        // For trending data, we'll use trading volume as a proxy
        const response = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const data = await response.json();
        
        // Filter for USDT pairs
        const usdtPairs = data.filter(t => t.symbol.endsWith('USDT'));
        
        // Most searched - we'll use highest volume as a proxy
        const mostSearched = usdtPairs
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 5)
            .map(t => ({
                symbol: t.symbol.replace('USDT', ''),
                volume: parseFloat(t.quoteVolume)
            }));
        
        // Highest volume - same as most searched in this simple implementation
        const highestVolume = [...mostSearched];
        
        // New listings - we can't easily get this, so we'll return empty
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
