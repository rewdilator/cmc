// Add CORS proxy URL prefix
const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

// Exchange API endpoints with CORS proxy
const API_ENDPOINTS = {
    BINANCE: CORS_PROXY + "https://api.binance.com/api/v3",
    OKX: CORS_PROXY + "https://www.okx.com/api/v5",
    XT: CORS_PROXY + "https://api.xt.com"
};

// Add error handling for fetch requests
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });
    clearTimeout(id);
    
    return response;
}

// Updated fetchCryptoData function
async function fetchCryptoData() {
    try {
        // First get BTC price for dominance calculation
        const btcResponse = await fetchWithTimeout(`${API_ENDPOINTS.BINANCE}/ticker/price?symbol=BTCUSDT`);
        const btcData = await btcResponse.json();
        state.btcPrice = parseFloat(btcData.price);

        // Get top coins by volume from Binance
        const tickerResponse = await fetchWithTimeout(`${API_ENDPOINTS.BINANCE}/ticker/24hr`);
        const tickerData = await tickerResponse.json();

        // Process USDT pairs only
        const usdtPairs = tickerData.filter(t => t.symbol.endsWith('USDT'));

        // Get more detailed data for top 100 by volume
        const top100 = usdtPairs
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 100);

        // Process the data
        const processedData = await Promise.all(top100.map(async (t) => {
            const symbol = t.symbol.replace('USDT', '');
            
            // Get prices from other exchanges
            const [okxPrice, xtPrice] = await Promise.all([
                getExchangePrice(symbol, 'OKX'),
                getExchangePrice(symbol, 'XT')
            ]);

            const binancePrice = parseFloat(t.lastPrice);
            const prices = [binancePrice, okxPrice, xtPrice].filter(p => p !== null);
            const avgPrice = prices.length > 0 ? 
                prices.reduce((sum, p) => sum + p, 0) / prices.length : 
                binancePrice;

            return {
                id: symbol.toLowerCase(),
                symbol: symbol,
                name: symbol,
                current_price: avgPrice,
                price_change_percentage_24h: parseFloat(t.priceChangePercent),
                total_volume: parseFloat(t.quoteVolume),
                market_cap: avgPrice * (parseFloat(t.volume) || 0), // Approximation
                exchanges: {
                    binance: binancePrice,
                    okx: okxPrice,
                    xt: xtPrice
                }
            };
        }));

        // Sort by market cap and assign ranks
        processedData.sort((a, b) => b.market_cap - a.market_cap);
        processedData.forEach((coin, index) => {
            coin.rank = index + 1;
        });

        state.cryptoData = processedData;
        state.filteredCryptoData = [...processedData];
        
        calculateGlobalStats();
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        throw error;
    }
}

// Updated getExchangePrice function with better error handling
async function getExchangePrice(symbol, exchange) {
    try {
        let price = null;
        
        switch(exchange) {
            case 'OKX':
                const okxResponse = await fetchWithTimeout(
                    `${API_ENDPOINTS.OKX}/market/ticker?instId=${symbol}-USDT`
                );
                const okxData = await okxResponse.json();
                if (okxData.data?.[0]?.last) {
                    price = parseFloat(okxData.data[0].last);
                }
                break;
                
            case 'XT':
                const xtResponse = await fetchWithTimeout(
                    `${API_ENDPOINTS.XT}/trade/api/v1/getTicker?symbol=${symbol.toLowerCase()}_usdt`
                );
                const xtData = await xtResponse.json();
                if (xtData.result && xtData.ticker?.last) {
                    price = parseFloat(xtData.ticker.last);
                }
                break;
        }
        
        return price;
    } catch (error) {
        console.warn(`Failed to get price from ${exchange} for ${symbol}:`, error);
        return null;
    }
}

// Updated renderCryptoTable function with null checks
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
        if (!coin) return;

        const row = document.createElement('tr');
        row.addEventListener('click', () => showCoinDetails(coin.id));

        const change = coin.price_change_percentage_24h || 0;
        const changeClass = change >= 0 ? 'positive-change' : 'negative-change';

        row.innerHTML = `
            <td>${coin.rank || '--'}</td>
            <td class="font-medium">${coin.symbol || '--'}</td>
            <td>${coin.current_price ? formatCurrency(coin.current_price) : '--'}</td>
            <td class="${changeClass}">${change.toFixed(2)}%</td>
            <td>${coin.total_volume ? formatCurrency(coin.total_volume) : '--'}</td>
            <td>${coin.market_cap ? formatCurrency(coin.market_cap) : '--'}</td>
            <td><div class="sparkline" id="sparkline-${coin.id}"></div></td>
            <td>
                ${coin.exchanges?.binance ? 'Binance' : ''}
                ${coin.exchanges?.okx ? ', OKX' : ''}
                ${coin.exchanges?.xt ? ', XT' : ''}
            </td>
        `;

        elements.cryptoTableBody.appendChild(row);
    });

    // Update pagination info
    updatePagination();
}

// Add this new function to help with debugging
function logInitialState() {
    console.log('Initial state:', {
        cryptoData: state.cryptoData,
        filteredCryptoData: state.filteredCryptoData,
        activeTab: state.activeTab
    });
}

// Call this at the end of init()
async function init() {
    setupEventListeners();
    await fetchAllData();
    setInterval(fetchAllData, 60000);
    logInitialState();  // Add this line
}
