(function () {
    var container = document.getElementById('agrotech-token-chart');
    if (!container || !window.LightweightCharts) {
        return;
    }

    var LightweightCharts = window.LightweightCharts;
    var createChart = LightweightCharts.createChart;
    var CandlestickSeries = LightweightCharts.CandlestickSeries;
    var createSeriesMarkers = LightweightCharts.createSeriesMarkers;

    var currencyFormatter = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    });

    var simulatedData = [
        { time: '2025-01-01', open: 500000, high: 507000, low: 496000, close: 503000 },
        { time: '2025-02-01', open: 503000, high: 509500, low: 499000, close: 501500 },
        { time: '2025-03-01', open: 501500, high: 513000, low: 500500, close: 508000 },
        { time: '2025-04-01', open: 508000, high: 522000, low: 505500, close: 517500 },
        { time: '2025-05-01', open: 517500, high: 529000, low: 513500, close: 524500 },
        { time: '2025-06-01', open: 524500, high: 533500, low: 519500, close: 521000 },
        { time: '2025-07-01', open: 521000, high: 544500, low: 518500, close: 538000 },
        { time: '2025-08-01', open: 538000, high: 551500, low: 533500, close: 547500 },
        { time: '2025-09-01', open: 547500, high: 563000, low: 543500, close: 559000 },
        { time: '2025-10-01', open: 559000, high: 571000, low: 553500, close: 566000 },
        { time: '2025-11-01', open: 566000, high: 579500, low: 560000, close: 571500 },
        { time: '2025-12-01', open: 571500, high: 581500, low: 567000, close: 574000 }
    ];

    var chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: '#55645e',
            fontFamily: 'Outfit, "Segoe UI", sans-serif'
        },
        grid: {
            vertLines: { color: 'rgba(47, 143, 78, 0.08)' },
            horzLines: { color: 'rgba(47, 143, 78, 0.08)' }
        },
        rightPriceScale: {
            borderColor: 'rgba(47, 143, 78, 0.14)'
        },
        timeScale: {
            borderColor: 'rgba(47, 143, 78, 0.14)',
            timeVisible: true,
            secondsVisible: false
        },
        crosshair: {
            vertLine: {
                color: 'rgba(47, 143, 78, 0.22)',
                labelBackgroundColor: '#2f8f4e'
            },
            horzLine: {
                color: 'rgba(61, 143, 103, 0.22)',
                labelBackgroundColor: '#2f8f4e'
            }
        },
        localization: {
            locale: 'es-CO',
            priceFormatter: function (price) {
                return currencyFormatter.format(price);
            }
        }
    });

    var series = chart.addSeries(CandlestickSeries, {
        upColor: '#2f8f4e',
        downColor: '#d06b5f',
        borderVisible: false,
        wickUpColor: '#2f8f4e',
        wickDownColor: '#d06b5f',
        priceLineVisible: false,
        lastValueVisible: true
    });

    series.setData(simulatedData);

    if (typeof createSeriesMarkers === 'function') {
        createSeriesMarkers(series, [
            {
                time: '2025-01-01',
                position: 'belowBar',
                color: '#2f8f4e',
                shape: 'circle',
                size: 0.6,
                text: 'Inicio del ciclo'
            },
            {
                time: '2025-07-01',
                position: 'aboveBar',
                color: '#789f45',
                shape: 'arrowUp',
                text: 'Desarrollo del activo'
            },
            {
                time: '2025-12-01',
                position: 'inBar',
                color: '#b27d2e',
                shape: 'circle',
                size: 0.6,
                text: 'Liquidacion'
            }
        ]);
    }

    chart.timeScale().fitContent();

    function resizeChart() {
        chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight
        });
        chart.timeScale().fitContent();
    }

    if (typeof ResizeObserver !== 'undefined') {
        var resizeObserver = new ResizeObserver(resizeChart);
        resizeObserver.observe(container);
    } else {
        window.addEventListener('resize', resizeChart);
    }
})();
