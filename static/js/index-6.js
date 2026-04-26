// Template-specific interactions for index-6.html

function updateRoundFundingProgress(current, target, units) {
    var timer = document.querySelector('.team-five__round-timer');
    if (!timer) return;

    var progressEl = timer.querySelector('.team-five__round-progress');
    var fillEl = timer.querySelector('.team-five__round-progress-fill');
    var contextEl = timer.querySelector('.team-five__round-context');
    var heroTokenizedEl = document.getElementById('hero-tokenized-units');
    var heroAvailableEl = document.getElementById('hero-available-units');
    if (!progressEl || !fillEl || !contextEl) return;

    var safeTarget = Number(target) || 0;
    var safeCurrent = Math.max(0, Number(current) || 0);
    var baseRaised = Number(timer.getAttribute('data-raised')) || safeCurrent || 1;
    var baseUnits = Number(timer.getAttribute('data-tokenized-units')) || Number(units) || 0;
    var totalUnits = Number(timer.getAttribute('data-total-units')) || baseUnits;
    var scaledUnits = Number(units);
    var safeUnits = Number.isFinite(scaledUnits) && scaledUnits > 0
        ? Math.round(scaledUnits)
        : Math.round((safeCurrent / baseRaised) * baseUnits);
    var availableUnits = Math.max(0, totalUnits - safeUnits);
    var percentage = safeTarget > 0 ? Math.min(100, Math.round((safeCurrent / safeTarget) * 100)) : 0;

    fillEl.style.width = percentage + '%';
    progressEl.setAttribute('aria-valuenow', String(percentage));
    progressEl.setAttribute('aria-label', 'Ronda financiada al ' + percentage + ' por ciento');
    contextEl.innerHTML = 'Ronda activa &middot; ' + safeUnits + ' unidades tokenizadas &middot; ' + availableUnits + ' unidades disponibles &middot; ' + Math.round(safeCurrent) + ' de ' + Math.round(safeTarget) + ' millones COP';

    if (heroTokenizedEl) {
        heroTokenizedEl.textContent = safeUnits;
    }

    if (heroAvailableEl) {
        heroAvailableEl.textContent = availableUnits;
    }
}

// Simula una variacion lenta tipo ticker financiero sobre el capital levantado.
(function () {
    var valueEl = document.getElementById('raised-amount');
    var deltaEl = document.getElementById('raised-delta');
    if (!valueEl || !deltaEl) return;

    var target = 50;
    var current = 28;
    var min = 24;
    var max = 32;
    var baseUnits = 128;
    var initialCurrent = current;

    function formatCurrency(value) {
        return Math.round(value).toLocaleString('es-CO');
    }

    updateRoundFundingProgress(current, target, baseUnits);

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
        var scaledUnits = Math.max(0, Math.round((current / initialCurrent) * baseUnits));

        valueEl.textContent = formatCurrency(current) + ' / ' + formatCurrency(target) + ' millones COP';
        updateRoundFundingProgress(current, target, scaledUnits);
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
    if (!valueEl) return;

    var roundDays = Number(timer.getAttribute('data-round-days')) || 7;
    var target = Date.now() + (roundDays * 24 * 60 * 60 * 1000);

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
    var tokenPriceCopEl = document.getElementById('agrotech-token-price-cop');
    var tokenRateBtcEl = document.getElementById('agrotech-token-rate-btc');
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
    var integerFormatter = new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0
    });
    var tokenBaseCop = 500000;
    var fallbackTokenRate = tokenRateBtcEl ? tokenRateBtcEl.textContent : '';

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

            if (tokenPriceCopEl) {
                tokenPriceCopEl.textContent = integerFormatter.format(tokenBaseCop) + ' COP';
            }

            if (tokenRateBtcEl) {
                tokenRateBtcEl.textContent = btcFormatter.format(tokenBtc) + ' BTC por token';
            }

        } catch (error) {
            numberEl.textContent = fallbackValue;
            changeEl.textContent = fallbackChange;
            absoluteChangeEl.textContent = fallbackAbsolute;
            changeEl.classList.remove('is-up', 'is-down');

            if (tokenPriceCopEl) {
                tokenPriceCopEl.textContent = integerFormatter.format(tokenBaseCop) + ' COP';
            }

            if (tokenRateBtcEl) {
                tokenRateBtcEl.textContent = fallbackTokenRate;
            }

        }
    }

    updateBtcPrice();
    window.setInterval(updateBtcPrice, 60000);
})();

(function () {
    var tabsRoot = document.getElementById('agro-auth-tabs');
    var tabs = tabsRoot ? tabsRoot.querySelectorAll('[data-auth-target]') : [];
    var panels = document.querySelectorAll('[data-auth-panel]');
    var switchButtons = document.querySelectorAll('.agro-access__switch[data-auth-target]');
    var authForms = document.querySelectorAll('[data-auth-form]');
    var feedbackRoot = document.getElementById('agro-auth-feedback');
    var readyState = document.querySelector('[data-auth-ready]');
    var readyEmail = readyState ? readyState.querySelector('[data-auth-ready-email]') : null;
    var accessTitle = document.getElementById('agro-access-title');
    var accessDescription = document.getElementById('agro-access-description');
    var accessAssist = document.querySelector('.agro-access__assist');
    var accessTopLink = document.querySelector('.agro-access__card-top .agro-access__link');

    if (!panels.length) return;

    function activate(mode) {
        tabs.forEach(function (tab) {
            var isActive = tab.getAttribute('data-auth-target') === mode;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        panels.forEach(function (panel) {
            var isActive = panel.getAttribute('data-auth-panel') === mode;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });
    }

    var initialMode = tabsRoot ? tabsRoot.getAttribute('data-active-mode') || 'login' : 'login';
    activate(initialMode);

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            activate(tab.getAttribute('data-auth-target'));
        });

        tab.addEventListener('keydown', function (event) {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

            event.preventDefault();

            var nextIndex = Array.prototype.indexOf.call(tabs, tab) + (event.key === 'ArrowRight' ? 1 : -1);
            if (nextIndex < 0) nextIndex = tabs.length - 1;
            if (nextIndex >= tabs.length) nextIndex = 0;

            tabs[nextIndex].focus();
            activate(tabs[nextIndex].getAttribute('data-auth-target'));
        });
    });

    switchButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            activate(button.getAttribute('data-auth-target'));
        });
    });

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    }

    function renderGlobalFeedback(type, message, redirectUrl) {
        if (!feedbackRoot) return;

        var className = type === 'success' ? 'agro-access__feedback--success' : 'agro-access__feedback--error';
        var action = redirectUrl
            ? '<a class="agro-access__feedback-link" href="' + escapeHtml(redirectUrl) + '">Ir al panel</a>'
            : '';

        feedbackRoot.innerHTML = '<div class="agro-access__feedback ' + className + '" role="alert">' + escapeHtml(message) + action + '</div>';
    }

    function renderReadyState(payload) {
        var user = payload.user || {};
        var userName = user.name || 'tu perfil';
        var userEmail = user.email || '';
        var panelUrl = payload.redirect_url || (readyState ? readyState.getAttribute('data-panel-url') : '');

        if (accessTitle) {
            accessTitle.textContent = 'Tu perfil AgroTech esta listo';
        }

        if (accessDescription) {
            accessDescription.innerHTML = 'Ya iniciaste sesion como <strong>' + escapeHtml(userName) + '</strong>. Puedes continuar directamente al panel del inversionista para calcular y comprar tokens.';
        }

        if (feedbackRoot) {
            feedbackRoot.innerHTML = '';
        }

        if (readyEmail) {
            readyEmail.textContent = userEmail ? 'Sesion activa con ' + userEmail + '.' : (payload.message || 'Cuenta creada correctamente.');
        }

        if (accessAssist) {
            accessAssist.hidden = true;
        }

        panels.forEach(function (panel) {
            panel.classList.remove('is-active');
            panel.hidden = true;
        });

        if (readyState) {
            readyState.hidden = false;
            readyState.querySelectorAll('a[href]').forEach(function (link) {
                if (link.classList.contains('btn-style-twelve') && panelUrl) {
                    link.setAttribute('href', panelUrl);
                }
            });
            readyState.focus({ preventScroll: true });
        }

        if (accessTopLink && panelUrl) {
            accessTopLink.textContent = 'Abrir panel';
            accessTopLink.setAttribute('href', panelUrl);
        }
    }

    function clearFormErrors(form) {
        form.querySelectorAll('.agro-access__feedback--error[id$="-error"], .agro-access__feedback--summary').forEach(function (errorEl) {
            errorEl.remove();
        });

        form.querySelectorAll('.field-inner--error').forEach(function (fieldEl) {
            fieldEl.classList.remove('field-inner--error');
        });

        form.querySelectorAll('[aria-invalid="true"]').forEach(function (input) {
            input.removeAttribute('aria-invalid');

            var describedBy = (input.getAttribute('aria-describedby') || '')
                .split(/\s+/)
                .filter(function (id) {
                    return id && !/-error$/.test(id);
                })
                .join(' ');

            if (describedBy) {
                input.setAttribute('aria-describedby', describedBy);
            } else {
                input.removeAttribute('aria-describedby');
            }
        });
    }

    function renderFieldErrors(form, errors) {
        Object.keys(errors || {}).forEach(function (fieldName) {
            if (fieldName === '__all__') {
                renderGlobalFeedback('error', errors[fieldName].join(' '));
                return;
            }

            var input = form.querySelector('[name="' + fieldName + '"]');
            if (!input) return;

            var fieldInner = input.closest('.field-inner');
            var errorId = input.id ? input.id + '-error' : 'agro-auth-' + fieldName + '-error';
            var errorEl = document.createElement('div');
            errorEl.className = 'agro-access__feedback agro-access__feedback--error';
            errorEl.id = errorId;
            errorEl.setAttribute('role', 'alert');
            errorEl.textContent = errors[fieldName].join(', ');

            if (fieldInner) {
                fieldInner.classList.add('field-inner--error');
                fieldInner.insertAdjacentElement('afterend', errorEl);
            } else {
                input.insertAdjacentElement('afterend', errorEl);
            }

            input.setAttribute('aria-invalid', 'true');
            var describedBy = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            if (describedBy.indexOf(errorId) === -1) {
                describedBy.push(errorId);
                input.setAttribute('aria-describedby', describedBy.join(' '));
            }
        });
    }

    authForms.forEach(function (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var submitButton = form.querySelector('[type="submit"]');
            clearFormErrors(form);
            if (feedbackRoot) feedbackRoot.innerHTML = '';

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
            }

            fetch(form.action || window.location.href, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json().then(function (payload) {
                        return {
                            ok: response.ok,
                            payload: payload
                        };
                    });
                })
                .then(function (result) {
                    var payload = result.payload || {};

                    if (!result.ok || !payload.success) {
                        renderGlobalFeedback('error', payload.message || 'Revisa los campos marcados.');
                        renderFieldErrors(form, payload.errors || {});
                        return;
                    }

                    renderReadyState(payload);
                    form.reset();
                })
                .catch(function () {
                    renderGlobalFeedback('error', 'No pudimos enviar el formulario. Intenta nuevamente.');
                })
                .finally(function () {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.removeAttribute('aria-busy');
                    }
                });
        });
    });
})();
