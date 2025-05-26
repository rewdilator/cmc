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
    },
    exchangeRates: {
        USD: 1,
        EUR: 0.93,
        GBP: 0.80,
        JPY: 151.50
    },
    currencySymbols: {
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥'
    }
};

// Exchange API endpoints
const API_ENDPOINTS = {
    BINANCE: 'https://api.binance.com/api/v3',
    OKX: 'https://www.okx.com/api/v5',
    XT: 'https://api.xt.com',
    COINGECKO: 'https://api.coingecko.com/api/v3'
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
        // Get top 100 coins by market cap from CoinGecko as a base
        const geckoResponse = await fetch(`${API_ENDPOINTS.COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`);
        const geckoData = await geckoResponse.json();
        
        // Enhance with data from exchanges
        const enhancedData = await Promise.all(geckoData.map(async (coin) => {
            // Get prices from exchanges
            const [binancePrice, okxPrice, xtPrice] = await Promise.all([
                getExchangePrice(coin.symbol.toUpperCase(), 'BINANCE'),
                getExchangePrice(coin.symbol.toUpperCase(), 'OKX'),
                getExchangePrice(coin.symbol.toUpperCase(), 'XT')
            ]);
            
            // Calculate average price
            const prices = [binancePrice, okxPrice, xtPrice].filter(p => p !== null);
            const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : coin.current_price;
            
            return {
                ...coin,
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                current_price: avgPrice,
                exchanges: {
                    binance: binancePrice,
                    okx: okxPrice,
                    xt: xtPrice
                },
                price_change_percentage_24h: coin.price_change_percentage_24h || 0
            };
        }));
        
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
        let price = null;
        
        switch(exchange) {
            case 'BINANCE':
                // Binance uses BTC, ETH, BNB, USDT, etc. as quote currencies
                const binanceResponse = await fetch(`${API_ENDPOINTS.BINANCE}/ticker/price?symbol=${symbol}USDT`);
                const binanceData = await binanceResponse.json();
                price = parseFloat(binanceData.price);
                break;
                
            case 'OKX':
                // OKX uses similar format but with dash: BTC-USDT
                const okxResponse = await fetch(`${API_ENDPOINTS.OKX}/market/ticker?instId=${symbol}-USDT`);
                const okxData = await okxResponse.json();
                if (okxData.data && okxData.data.length > 0) {
                    price = parseFloat(okxData.data[0].last);
                }
                break;
                
            case 'XT':
                // XT.com uses slash: BTC/USDT
                const xtResponse = await fetch(`${API_ENDPOINTS.XT}/trade/api/v1/getTicker?symbol=${symbol.toLowerCase()}_usdt`);
                const xtData = await xtResponse.json();
                if (xtData.result && xtData.ticker) {
                    price = parseFloat(xtData.ticker.last);
                }
                break;
        }
        
        return price;
    } catch (error) {
        console.error(`Error getting price from ${exchange} for ${symbol}:`, error);
        return null;
    }
}

// Fetch exchange data
async function fetchExchangeData() {
    // Simulated exchange data (in a real app, you'd fetch from exchange APIs)
    state.exchangeData = [
        {
            id: 'binance',
            name: 'Binance',
            trust_score: 10,
            volume_24h_usd: 15000000000,
            pairs: 1500,
            liquidity: 'Very High
