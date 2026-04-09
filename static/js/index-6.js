// Template-specific interactions for index-6.html

// Simula una variacion lenta tipo ticker financiero sobre el capital levantado.
(function () {
    var valueEl = document.getElementById('raised-amount');
    var deltaEl = document.getElementById('raised-delta');
    if (!valueEl || !deltaEl) return;

    var target = 50;
    var current = 28;
    var min = 24;
    var max = 32;

    function formatCurrency(value) {
        return Math.round(value).toLocaleString('es-CO');
    }

    function tick() {
        var step = (Math.random() * 2.6) + 0.4;
        var direction = Math.random() > 0.48 ? 1 : -1;
        var next = current + (step * direction);

        if (next < min) {
            next = min + (Math.random() * 2.5);
            direction = 1;
        }

        if (next > max) {
            next = max - (Math.random() * 2.5);
            direction = -1;
        }

        var diff = next - current;
        var pct = ((diff / current) * 100).toFixed(1);
        current = next;

        valueEl.textContent = formatCurrency(current) + ' / ' + formatCurrency(target) + ' millones COP';
        valueEl.classList.remove('is-up', 'is-down');
        deltaEl.classList.remove('up', 'down');

        if (diff >= 0) {
            valueEl.classList.add('is-up');
            deltaEl.classList.add('up');
            deltaEl.textContent = '+' + pct + '%';
        } else {
            valueEl.classList.add('is-down');
            deltaEl.classList.add('down');
            deltaEl.textContent = pct + '%';
        }

        window.setTimeout(function () {
            valueEl.classList.remove('is-up', 'is-down');
        }, 700);
    }

    window.setInterval(tick, 1800);
})();

(function () {
    var timer = document.querySelector('.team-five__round-timer');
    if (!timer) return;

    var valueEl = timer.querySelector('.team-five__round-value');
    var deadline = timer.getAttribute('data-round-deadline');
    if (!valueEl || !deadline) return;

    var target = new Date(deadline).getTime();
    if (isNaN(target)) return;

    function renderCountdown() {
        var now = Date.now();
        var diff = Math.max(0, target - now);

        var totalSeconds = Math.floor(diff / 1000);
        var days = Math.floor(totalSeconds / 86400);
        var hours = Math.floor((totalSeconds % 86400) / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;

        function pad(value) {
            return String(value).padStart(2, '0');
        }

        valueEl.textContent = pad(days) + 'd : ' + pad(hours) + 'h : ' + pad(minutes) + 'm : ' + pad(seconds) + 's';
    }

    renderCountdown();
    window.setInterval(renderCountdown, 1000);
})();

(function () {
    var card = document.querySelector('.ui-btc-card');
    var tokenRateEl = document.querySelector('.agro-token-spot__rate-value');
    if (!card) return;

    var numberEl = card.querySelector('.ui-btc-card__num');
    var changeEl = card.querySelector('.ui-btc-card__chg');
    var pillEls = card.querySelectorAll('.ui-btc-card__pill');
    var absoluteChangeEl = pillEls.length > 1 ? pillEls[1] : null;
    if (!numberEl || !changeEl || !absoluteChangeEl) return;

    var fallbackValue = numberEl.textContent;
    var fallbackChange = changeEl.textContent;
    var fallbackAbsolute = absoluteChangeEl.textContent;
    var formatter = new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    var btcFormatter = new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5
    });
    var tokenBaseCop = 500000;
    var fallbackTokenRate = tokenRateEl ? tokenRateEl.textContent : '';

    function formatSignedPercent(value) {
        var prefix = value >= 0 ? '+' : '';
        return prefix + formatter.format(value) + '%';
    }

    function formatSignedUsd(value) {
        var prefix = value >= 0 ? '+' : '-';
        return '24h ' + prefix + '$' + formatter.format(Math.abs(value));
    }

    function paintChange(value) {
        changeEl.classList.remove('is-up', 'is-down');

        if (value > 0) {
            changeEl.classList.add('is-up');
        } else if (value < 0) {
            changeEl.classList.add('is-down');
        }
    }

    async function updateBtcPrice() {
        try {
            var response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,cop&include_24hr_change=true', {
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('btc-price-request-failed');
            }

            var payload = await response.json();
            var quote = payload && payload.bitcoin ? payload.bitcoin : null;
            var amount = quote ? Number(quote.usd) : NaN;
            var amountCop = quote ? Number(quote.cop) : NaN;
            var changePct = quote ? Number(quote.usd_24h_change) : NaN;

            if (!Number.isFinite(amount) || !Number.isFinite(amountCop) || !Number.isFinite(changePct)) {
                throw new Error('btc-price-invalid');
            }

            var absoluteChange = amount - (amount / (1 + (changePct / 100)));
            var tokenBtc = tokenBaseCop / amountCop;

            numberEl.textContent = formatter.format(amount);
            changeEl.textContent = formatSignedPercent(changePct);
            absoluteChangeEl.textContent = formatSignedUsd(absoluteChange);
            paintChange(changePct);

            if (tokenRateEl) {
                tokenRateEl.textContent = btcFormatter.format(tokenBtc) + ' BTC';
            }
        } catch (error) {
            numberEl.textContent = fallbackValue;
            changeEl.textContent = fallbackChange;
            absoluteChangeEl.textContent = fallbackAbsolute;
            changeEl.classList.remove('is-up', 'is-down');

            if (tokenRateEl) {
                tokenRateEl.textContent = fallbackTokenRate;
            }
        }
    }

    updateBtcPrice();
    window.setInterval(updateBtcPrice, 60000);
})();

