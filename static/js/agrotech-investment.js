(function () {
  const TOKEN_FACE_VALUE_COP = 500000;
  const copCurrencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

  function initWalletSummaryAccordion() {
    document.querySelectorAll("[data-wallet-summary]").forEach(function (summary) {
      var toggle = summary.querySelector("[data-wallet-summary-toggle]");
      var body = summary.querySelector("[data-wallet-summary-body]");

      if (!toggle || !body) {
        return;
      }

      function setExpanded(expanded) {
        summary.classList.toggle("is-expanded", expanded);
        summary.classList.toggle("is-collapsed", !expanded);
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");

        if (expanded) {
          body.style.maxHeight = body.scrollHeight + "px";
        } else {
          body.style.maxHeight = body.scrollHeight + "px";
          window.requestAnimationFrame(function () {
            body.style.maxHeight = "0px";
          });
        }
      }

      function syncLayout() {
        if (!summary.classList.contains("is-expanded")) {
          summary.classList.add("is-collapsed");
          body.style.maxHeight = "0px";
          toggle.setAttribute("aria-expanded", "false");
          return;
        }

        body.style.maxHeight = body.scrollHeight + "px";
      }

      summary.classList.add("is-collapsed");
      body.style.maxHeight = "0px";
      toggle.setAttribute("aria-expanded", "false");

      toggle.addEventListener("click", function () {
        setExpanded(!summary.classList.contains("is-expanded"));
      });

      window.addEventListener("resize", function () {
        if (summary.classList.contains("is-expanded")) {
          body.style.maxHeight = body.scrollHeight + "px";
        }
      });

      syncLayout();
    });
  }

  function formatNumber(value) {
    const numeric = Number(value || 0);
    return new Intl.NumberFormat("es-CO").format(numeric);
  }

  function formatCurrency(value) {
    const numeric = Number(value || 0);
    return copCurrencyFormatter.format(Number.isFinite(numeric) ? numeric : 0);
  }

  function calculateAvailableCapital(value, tokenPrice) {
    const tokensAvailable = Math.max(toInteger(value), 0);
    const normalizedTokenPrice = Number(tokenPrice || TOKEN_FACE_VALUE_COP);
    return tokensAvailable * (Number.isFinite(normalizedTokenPrice) ? normalizedTokenPrice : TOKEN_FACE_VALUE_COP);
  }

  function buildOpportunityMarketMetrics(totalTokens, tokensSold, tokenPrice) {
    const normalizedTotalTokens = Math.max(toInteger(totalTokens), 0);
    const normalizedTokensSold = clampNumber(toInteger(tokensSold), 0, normalizedTotalTokens);
    const tokensAvailable = Math.max(normalizedTotalTokens - normalizedTokensSold, 0);

    return {
      total_tokens: normalizedTotalTokens,
      tokens_sold: normalizedTokensSold,
      tokens_available: tokensAvailable,
      capital_available: calculateAvailableCapital(tokensAvailable, tokenPrice),
      capital_raised: calculateAvailableCapital(normalizedTokensSold, tokenPrice),
    };
  }

  function formatCompactValue(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
      return "0";
    }
    if (numeric >= 1000000) {
      return (numeric / 1000000).toFixed(2) + "M";
    }
    if (Math.round(numeric) === numeric) {
      return formatNumber(numeric);
    }
    return numeric.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getCookie(name) {
    const cookieValue = document.cookie
      .split(";")
      .map(function (item) { return item.trim(); })
      .find(function (item) { return item.startsWith(name + "="); });
    return cookieValue ? decodeURIComponent(cookieValue.split("=")[1]) : "";
  }

  function toInteger(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function updateRecentCertificates(contract, assetName) {
    document.querySelectorAll("[data-recent-certificates-list]").forEach(function (list) {
      const empty = list.querySelector("[data-certificates-empty]");
      if (empty) {
        empty.remove();
      }

      const existing = list.querySelector('[data-certificate-id="' + contract.certificate_id + '"]');
      if (existing) {
        const download = existing.querySelector(".agt-contract-list__download");
        if (download) {
          download.href = contract.download_pdf_url;
        }
        return;
      }

      const item = document.createElement("article");
      item.className = "agt-contract-list__item agt-contract-list__item--certificate";
      item.setAttribute("data-certificate-id", contract.certificate_id);
      item.innerHTML =
        '<div><strong>' + escapeHtml(assetName) + '</strong><span>' + escapeHtml(contract.certificate_id) + '</span></div>' +
        '<div><strong>' + escapeHtml(contract.tokens_acquired) + ' AGT</strong><span>' + escapeHtml(contract.issued_at.slice(0, 16)) + '</span></div>' +
        '<a href="' + escapeHtml(contract.download_pdf_url) + '" class="agt-contract-list__download">Descargar PDF</a>';
      list.prepend(item);
    });
  }

  // Demo layer: extiende la card visualmente sin reemplazar la logica real de compra.
  const opportunityDemo = {
    config: {
      demoMode: true,
      animatedTokenFlow: true,
      classificationMode: "smart",
      minUpdateInterval: 3200,
      maxUpdateInterval: 7600,
      activityIntensity: 0.45,
    },
    cards: new Map(),
  };

  function createSeededRandom(seedValue) {
    let seed = Math.max(1, toInteger(seedValue) || 1);
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  function buildCardSeed(code) {
    return String(code || "").split("").reduce(function (acc, char, index) {
      return acc + (char.charCodeAt(0) * (index + 1));
    }, 0);
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function readOpportunityDemoConfig(root) {
    const dataset = (root && root.dataset) || {};
    const parseBool = function (value, fallback) {
      if (value === undefined || value === null || value === "") {
        return fallback;
      }
      return String(value).toLowerCase() !== "false";
    };
    const parseNumber = function (value, fallback) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };

    return {
      demoMode: parseBool(dataset.demoMode, opportunityDemo.config.demoMode),
      animatedTokenFlow: parseBool(dataset.animatedTokenFlow, opportunityDemo.config.animatedTokenFlow),
      classificationMode: dataset.classificationMode || opportunityDemo.config.classificationMode,
      minUpdateInterval: parseNumber(dataset.demoMinUpdateInterval, opportunityDemo.config.minUpdateInterval),
      maxUpdateInterval: parseNumber(dataset.demoMaxUpdateInterval, opportunityDemo.config.maxUpdateInterval),
      activityIntensity: clampNumber(
        parseNumber(dataset.demoActivityIntensity, opportunityDemo.config.activityIntensity),
        0.05,
        1
      ),
    };
  }

  function normalizeOpportunitySnapshot(input) {
    const tokenPrice = Number(input.token_price || 0);
    const marketMetrics = buildOpportunityMarketMetrics(input.total_tokens, input.tokens_sold, tokenPrice);
    const estimatedReturn = Number(input.estimated_return || 0);
    const progressPercent = marketMetrics.total_tokens ? Math.round((marketMetrics.tokens_sold / marketMetrics.total_tokens) * 100) : 0;
    const capitalAvailable = input.capital_available !== undefined
      ? Number(input.capital_available)
      : marketMetrics.capital_available;
    const capitalRaised = input.capital_raised !== undefined
      ? Number(input.capital_raised)
      : marketMetrics.capital_raised;

    return {
      code: input.code || "",
      total_tokens: marketMetrics.total_tokens,
      tokens_sold: marketMetrics.tokens_sold,
      tokens_available: marketMetrics.tokens_available,
      token_price: tokenPrice,
      estimated_return: estimatedReturn,
      capital_available: capitalAvailable,
      capital_remaining: capitalAvailable,
      capital_raised: capitalRaised,
      participants_estimate: Math.max(toInteger(input.participants_estimate), 0),
      urgency_label: input.urgency_label || "Disponible",
      urgency_tone: input.urgency_tone || "available",
      progress_percent: progressPercent,
      activity_score: Math.max(Number(input.activity_score || 0), 0),
      holding_quantity: Math.max(toInteger(input.holding_quantity), 0),
    };
  }

  function resolveSmartUrgency(snapshot, cardState) {
    const soldRatio = snapshot.total_tokens ? snapshot.tokens_sold / snapshot.total_tokens : 0;
    const availableRatio = snapshot.total_tokens ? snapshot.tokens_available / snapshot.total_tokens : 0;
    const estimatedReturn = Number(snapshot.estimated_return || 0);
    const activityScore = Math.max(Number(snapshot.activity_score || 0), 0);
    const typeKey = String((cardState && cardState.typeKey) || "").toLowerCase();

    if (snapshot.tokens_available <= Math.max(4, Math.ceil(snapshot.total_tokens * 0.07))) {
      return { label: "Ultimos tokens", tone: "critical" };
    }
    if (estimatedReturn >= 17 && soldRatio >= 0.45) {
      return { label: "Activo premium", tone: "premium" };
    }
    if (activityScore >= 3 && soldRatio >= 0.72) {
      return { label: "Rotacion acelerada", tone: "accelerated" };
    }
    if (activityScore >= 2.4 && soldRatio >= 0.58) {
      return { label: "Alta demanda", tone: "hot" };
    }
    if (activityScore >= 1.6 && soldRatio >= 0.4) {
      return { label: "Demanda creciente", tone: "warm" };
    }
    if (soldRatio <= 0.22 || availableRatio >= 0.78) {
      return { label: "Oportunidad temprana", tone: "early" };
    }
    if (activityScore >= 0.85 || typeKey === "individual") {
      return { label: "Interes moderado", tone: "moderate" };
    }
    return { label: "Movimiento estable", tone: "stable" };
  }

  function computeOpportunityPresentation(snapshot, cardState, config) {
    const baseTone = cardState && cardState.baseUrgencyTone ? cardState.baseUrgencyTone : snapshot.urgency_tone;
    const baseLabel = cardState && cardState.baseUrgencyLabel ? cardState.baseUrgencyLabel : snapshot.urgency_label;
    const smartUrgency = config.classificationMode === "smart"
      ? resolveSmartUrgency(snapshot, cardState)
      : { label: baseLabel, tone: baseTone };
    const flowIntensity = clampNumber(0.35 + (snapshot.progress_percent / 100) * 0.4 + (snapshot.activity_score * 0.08), 0.28, 1);
    const flowDuration = clampNumber(1.95 - (snapshot.progress_percent / 100) * 0.8 - (snapshot.activity_score * 0.08), 0.9, 2.2);

    return {
      urgency_label: smartUrgency.label,
      urgency_tone: smartUrgency.tone,
      flow_intensity: Number(flowIntensity.toFixed(2)),
      flow_duration: Number(flowDuration.toFixed(2)),
    };
  }

  function applyOpportunityTone(card, tone) {
    if (!card) {
      return;
    }
    const allTones = ["is-hot", "is-warm", "is-stable", "is-early", "is-moderate", "is-premium", "is-accelerated", "is-critical"];
    const urgency = card.querySelector(".investor-opportunity-card__urgency");
    if (!urgency) {
      return;
    }
    urgency.classList.remove.apply(urgency.classList, allTones);
    const toneClassMap = {
      hot: "is-hot",
      warm: "is-warm",
      stable: "is-stable",
      early: "is-early",
      moderate: "is-moderate",
      premium: "is-premium",
      accelerated: "is-accelerated",
      critical: "is-critical",
      almost: "is-critical",
    };
    const toneClass = toneClassMap[tone] || "";
    if (toneClass) {
      urgency.classList.add(toneClass);
    }
  }

  // Renderiza solo el estado visible de la oportunidad; el checkout sigue usando los datasets reales.
  function renderOpportunityCard(card, snapshot, options) {
    const settings = options || {};
    const progressCopy = card.querySelector("[data-asset-progress-copy]");
    const progressValue = card.querySelector("[data-asset-progress-value]");
    const progressBar = card.querySelector("[data-asset-progress-bar]");
    const availabilityCopy = card.querySelector("[data-asset-availability-copy]");
    const urgencyLabel = card.querySelector("[data-asset-urgency-label]");
    const capitalRaised = card.querySelector("[data-asset-capital-raised]");
    const capitalAvailable = card.querySelector("[data-asset-capital-available]");
    const participants = card.querySelector("[data-asset-participants]");
    const availableTokens = card.querySelector("[data-asset-tokens-available]");
    const priceAmount = card.querySelector("[data-asset-price-amount]");
    const visual = settings.visual || {};
    const label = visual.urgency_label || snapshot.urgency_label;
    const tone = visual.urgency_tone || snapshot.urgency_tone;

    if (progressCopy) {
      progressCopy.textContent = snapshot.tokens_sold + " / " + snapshot.total_tokens + " tokens vendidos";
    }
    if (progressValue) {
      progressValue.textContent = snapshot.progress_percent + "%";
    }
    if (progressBar) {
      progressBar.style.width = snapshot.progress_percent + "%";
    }
    if (availabilityCopy) {
      availabilityCopy.textContent = snapshot.tokens_sold + " vendidos | " + snapshot.tokens_available + " disponibles";
    }
    if (urgencyLabel) {
      urgencyLabel.textContent = label;
    }
    if (capitalRaised) {
      capitalRaised.textContent = formatCurrency(snapshot.capital_raised);
    }
    if (capitalAvailable) {
      capitalAvailable.textContent = formatCurrency(snapshot.capital_available);
    }
    if (participants) {
      participants.textContent = snapshot.participants_estimate;
    }
    if (availableTokens) {
      availableTokens.textContent = snapshot.tokens_available + " tokens";
    }
    if (priceAmount) {
      priceAmount.textContent = formatCurrency(snapshot.capital_available);
    }

    card.style.setProperty("--token-flow-duration", (visual.flow_duration || 1.4) + "s");
    card.style.setProperty("--token-flow-intensity", String(visual.flow_intensity || 0.7));
    applyOpportunityTone(card, tone);
    card.dataset.demoUrgencyLabel = label;
    card.dataset.demoUrgencyTone = tone;

    if (settings.highlight) {
      card.classList.remove("is-demo-updating");
      void card.offsetWidth;
      card.classList.add("is-demo-updating");
      window.setTimeout(function () {
        card.classList.remove("is-demo-updating");
      }, 520);
    }
  }

  function createStepper(stepper) {
    const labels = [
      "Validando disponibilidad de tokens",
      "Reservando participación en el activo",
      "Generando contrato digital de copropiedad",
      "Calculando hash del contrato",
      "Registrando transacción en blockchain",
      "Actualizando portafolio del inversionista",
      "Confirmando adquisición",
    ];
    stepper.innerHTML = labels.map(function (label) {
      return '<div class="agt-stepper__item"><span class="agt-stepper__dot"></span><span>' + label + "</span></div>";
    }).join("");
    return Array.from(stepper.querySelectorAll(".agt-stepper__item"));
  }

  function syncWallet(snapshot) {
    if (!snapshot) {
      return;
    }
    document.querySelectorAll("[data-investment-root]").forEach(function (root) {
      root.dataset.walletTokens = snapshot.tokens_available;
    });
    document.querySelectorAll("[data-wallet-tokens]").forEach(function (item) {
      item.textContent = snapshot.tokens_available;
    });
    document.querySelectorAll("[data-wallet-owned-tokens]").forEach(function (item) {
      item.textContent = snapshot.wallet_total_tokens || snapshot.tokens_available || 0;
    });
    document.querySelectorAll("[data-wallet-pocket-tokens]").forEach(function (item) {
      item.textContent = snapshot.tokens_available + " AGT";
    });
    document.querySelectorAll("[data-wallet-equivalent]").forEach(function (item) {
      item.textContent = formatNumber(snapshot.equivalent_cop);
    });
    document.querySelectorAll("[data-wallet-assets]").forEach(function (item) {
      item.textContent = snapshot.portfolio_assets;
    });
    document.querySelectorAll("[data-wallet-total-invested]").forEach(function (item) {
      item.textContent = formatNumber(snapshot.invested_capital || snapshot.total_invested);
    });
    document.querySelectorAll("[data-wallet-yield]").forEach(function (item) {
      item.textContent = snapshot.estimated_return_pct;
    });
  }

  function syncMarketAvailability() {
    let totalTokens = 0;
    let totalCapital = 0;
    let totalSold = 0;
    let totalSupply = 0;
    let activeAssets = 0;

    document.querySelectorAll(".investor-opportunity-card[data-asset-code]").forEach(function (card) {
      const tokensAvailable = toInteger(card.dataset.assetTokensAvailable);
      const tokensSold = toInteger(card.dataset.tokensSold);
      const totalAssetTokens = toInteger(card.dataset.totalTokens);
      const capitalAvailable = Number(card.dataset.capitalAvailable || 0);
      totalTokens += Math.max(tokensAvailable, 0);
      totalSold += Math.max(tokensSold, 0);
      totalSupply += Math.max(totalAssetTokens, 0);
      if (tokensAvailable > 0) {
        activeAssets += 1;
      }
      totalCapital += Number.isFinite(capitalAvailable) ? Math.max(capitalAvailable, 0) : 0;
    });

    document.querySelectorAll("[data-market-tokens]").forEach(function (item) {
      item.textContent = formatNumber(totalTokens);
    });

    document.querySelectorAll("[data-market-equivalent]").forEach(function (item) {
      item.textContent = formatCompactValue(totalCapital);
    });

    document.querySelectorAll("[data-market-assets]").forEach(function (item) {
      item.textContent = formatNumber(activeAssets);
    });

    document.querySelectorAll("[data-market-funded-pct]").forEach(function (item) {
      const pct = totalSupply > 0 ? (totalSold / totalSupply) * 100 : 0;
      item.textContent = pct.toFixed(2);
    });
  }

  function updateAssetCard(snapshot) {
    document.querySelectorAll('.investor-opportunity-card[data-asset-code="' + snapshot.code + '"]').forEach(function (card) {
      const normalized = normalizeOpportunitySnapshot(snapshot);
      const cardState = opportunityDemo.cards.get(card.dataset.assetCode) || buildOpportunityCardState(card);
      const visual = computeOpportunityPresentation(normalized, cardState, opportunityDemo.config);

      card.dataset.assetTokensAvailable = String(normalized.tokens_available);
      card.dataset.tokensSold = String(normalized.tokens_sold);
      card.dataset.totalTokens = String(normalized.total_tokens);
      card.dataset.capitalRaised = String(normalized.capital_raised);
      card.dataset.capitalAvailable = String(normalized.capital_available);
      card.dataset.capitalRemaining = String(normalized.capital_remaining);
      card.dataset.participantsEstimate = String(normalized.participants_estimate);
      card.dataset.urgencyLabel = normalized.urgency_label;
      card.dataset.urgencyTone = normalized.urgency_tone;
      card.dataset.assetHolding = String(normalized.holding_quantity);
      card.dataset.estimatedReturn = String(normalized.estimated_return);
      renderOpportunityCard(card, normalized, { visual: visual, highlight: true });

      const button = card.querySelector("[data-open-investment-modal]");
      if (button) {
        button.disabled = normalized.tokens_available <= 0;
      }

      if (cardState.timeoutId) {
        window.clearTimeout(cardState.timeoutId);
        cardState.timeoutId = null;
      }
      cardState.card = card;
      cardState.real = Object.assign({}, normalized);
      cardState.visible = Object.assign({}, normalized);
      cardState.activityScore = 0;
      opportunityDemo.cards.set(card.dataset.assetCode, cardState);
      scheduleOpportunitySimulation(cardState, opportunityDemo.config);
    });
    syncMarketAvailability();
  }

  function updateDetailPanels(snapshot, position) {
    const detailPanel = document.querySelector('[data-asset-detail-panel][data-asset-code="' + snapshot.code + '"]');
    if (detailPanel) {
      const openButton = detailPanel.querySelector("[data-open-investment-modal]");
      if (openButton) {
        openButton.dataset.assetTokensAvailable = String(snapshot.tokens_available);
        openButton.dataset.tokensSold = String(snapshot.tokens_sold);
        openButton.dataset.totalTokens = String(snapshot.total_tokens);
        openButton.dataset.capitalRaised = String(snapshot.capital_raised);
        openButton.dataset.capitalAvailable = String(snapshot.capital_available);
        openButton.dataset.capitalRemaining = String(snapshot.capital_remaining);
        openButton.dataset.participantsEstimate = String(snapshot.participants_estimate);
        openButton.dataset.urgencyLabel = snapshot.urgency_label;
        openButton.dataset.urgencyTone = snapshot.urgency_tone;
        openButton.dataset.assetHolding = String(snapshot.holding_quantity);
        openButton.dataset.assetStatus = snapshot.lifecycle_status_label || snapshot.status_label;
        openButton.disabled = snapshot.tokens_available <= 0;
        const buttonText = openButton.querySelector(".txt");
        if (buttonText) {
          buttonText.textContent = snapshot.tokens_available > 0 ? "Invertir en este lote con AGT" : "Ronda cerrada";
        }
      }
    }

    const statusEl = document.querySelector("[data-detail-status-label]");
    if (statusEl) {
      statusEl.textContent = "Estado del activo: " + (snapshot.lifecycle_status_label || snapshot.status_label);
    }
    const roundStatusPill = document.querySelector("[data-detail-round-status-pill]");
    if (roundStatusPill) {
      roundStatusPill.textContent = "Ronda: " + snapshot.round_status_label;
    }
    const roundStatus = document.querySelector("[data-detail-round-status]");
    if (roundStatus) {
      roundStatus.textContent = snapshot.round_status_label;
    }
    const roundStatusStrong = document.querySelector("[data-detail-round-status-strong]");
    if (roundStatusStrong) {
      roundStatusStrong.textContent = snapshot.round_status_label;
    }
    const sideRoundStatus = document.querySelector("[data-detail-side-round-status]");
    if (sideRoundStatus) {
      sideRoundStatus.textContent = snapshot.round_status_label;
    }
    const lifecycleStrong = document.querySelector("[data-detail-lifecycle-strong]");
    if (lifecycleStrong) {
      lifecycleStrong.textContent = snapshot.lifecycle_status_label || snapshot.status_label;
    }
    const sideLifecycle = document.querySelector("[data-detail-side-lifecycle-status]");
    if (sideLifecycle) {
      sideLifecycle.textContent = snapshot.lifecycle_status_label || snapshot.status_label;
    }
    const progressValue = document.querySelector("[data-detail-progress-value]");
    if (progressValue) {
      progressValue.textContent = snapshot.progress_percent + "%";
    }
    const progressBar = document.querySelector("[data-detail-progress-bar]");
    if (progressBar) {
      progressBar.style.width = snapshot.progress_percent + "%";
    }
    const progressCopy = document.querySelector("[data-detail-progress-copy]");
    if (progressCopy) {
      progressCopy.textContent = snapshot.tokens_sold + " / " + snapshot.total_tokens + " tokens colocados";
    }
    const availabilityCopy = document.querySelector("[data-detail-availability-copy]");
    if (availabilityCopy) {
      availabilityCopy.textContent = snapshot.tokens_available + " tokens disponibles para inversión";
    }
    const tokensIssued = document.querySelector("[data-detail-token-issued]");
    if (tokensIssued) {
      tokensIssued.textContent = snapshot.total_tokens;
    }
    const tokensSold = document.querySelector("[data-detail-token-sold]");
    if (tokensSold) {
      tokensSold.textContent = snapshot.tokens_sold;
    }
    const tokenAvailable = document.querySelector("[data-detail-token-available]");
    if (tokenAvailable) {
      tokenAvailable.textContent = snapshot.tokens_available;
    }
    const fundingPercent = document.querySelector("[data-detail-funding-percent]");
    if (fundingPercent) {
      fundingPercent.textContent = snapshot.progress_percent + "%";
    }
    const capitalRaised = document.querySelector("[data-detail-capital-raised]");
    if (capitalRaised) {
      capitalRaised.textContent = formatCurrency(snapshot.capital_raised);
    }
    const capitalRaisedGrid = document.querySelector("[data-detail-capital-raised-grid]");
    if (capitalRaisedGrid) {
      capitalRaisedGrid.textContent = formatCurrency(snapshot.capital_raised);
    }
    const capitalPending = document.querySelector("[data-detail-capital-pending]");
    if (capitalPending) {
      capitalPending.textContent = formatCurrency(snapshot.capital_available);
    }
    const participants = document.querySelector("[data-detail-participants]");
    if (participants) {
      participants.textContent = snapshot.participants_estimate;
    }
    const participantsGrid = document.querySelector("[data-detail-participants-grid]");
    if (participantsGrid) {
      participantsGrid.textContent = snapshot.participants_estimate;
    }
    const positionTokens = document.querySelector("[data-detail-position-tokens]");
    if (positionTokens) {
      positionTokens.textContent = snapshot.holding_quantity;
    }
    const positionParticipation = document.querySelector("[data-detail-position-participation]");
    if (positionParticipation) {
      positionParticipation.textContent = snapshot.user_participation_pct + "%";
    }
    const positionTotal = document.querySelector("[data-detail-position-total]");
    if (positionTotal && position) {
      positionTotal.textContent = formatCurrency(position.total_invested);
    }
  }

  function updatePortfolioPanel(snapshot, position, transaction) {
    const selectedCodeInput = document.getElementById("selected-asset-code-input");
    if (selectedCodeInput && selectedCodeInput.value === snapshot.code) {
      const availableEl = document.getElementById("portfolio-asset-tokens-available");
      if (availableEl) {
        availableEl.textContent = snapshot.tokens_available;
      }
      const holdingEl = document.getElementById("portfolio-asset-holding");
      if (holdingEl) {
        holdingEl.textContent = position.holding_quantity;
      }
      const totalInvestedEl = document.getElementById("portfolio-asset-total-invested");
      if (totalInvestedEl) {
        totalInvestedEl.textContent = formatCurrency(position.total_invested);
      }
      const badge = document.getElementById("portfolio-panel-badge");
      if (badge) {
        badge.textContent = snapshot.code + " validado";
      }
      const pending = document.getElementById("portfolio-panel-pending");
      const note = document.getElementById("portfolio-pending-note");
      const grid = document.getElementById("portfolio-panel-grid");
      if (pending) {
        pending.classList.add("is-hidden");
      }
      if (note) {
        note.classList.add("is-hidden");
      }
      if (grid) {
        grid.classList.remove("is-hidden");
      }
    }
    const tbody = document.getElementById("investment-transactions-body");
    if (tbody && transaction) {
      const row = document.createElement("tr");
      row.innerHTML = "<td>" + transaction.created_at + "</td><td>" + transaction.quantity + "</td><td>$" + formatNumber(transaction.total_amount / transaction.quantity) + "</td><td>$" + formatNumber(transaction.total_amount) + "</td>";
      tbody.prepend(row);
    }
  }

  function updateBlockchainPanels(contract, assetName, assetCode) {
    document.querySelectorAll('[data-blockchain-panel][data-asset-code="' + assetCode + '"]').forEach(function (panel) {
      const status = panel.querySelector("[data-contract-status]");
      if (status) {
        status.textContent = contract.blockchain_status;
        status.classList.add("is-confirmed");
      }
      const contractId = panel.querySelector("[data-contract-id]");
      if (contractId) {
        contractId.textContent = contract.contract_id;
      }
      const hash = panel.querySelector("[data-contract-hash]");
      if (hash) {
        hash.textContent = contract.tx_hash;
      }
      const block = panel.querySelector("[data-contract-block]");
      if (block) {
        block.textContent = contract.block_id;
      }
      const issued = panel.querySelector("[data-contract-issued]");
      if (issued) {
        issued.textContent = contract.issued_at;
      }
      const note = panel.querySelector("[data-contract-note]");
      if (note) {
        note.textContent = "La inversión en " + assetName + " fue confirmada en blockchain y quedó respaldada por un contrato digital de copropiedad activo.";
      }
    });
  }

  function collectOpportunityCards(root) {
    return Array.from((root || document).querySelectorAll(".investor-opportunity-card[data-asset-code]"));
  }

  function buildOpportunityCardState(card) {
    const snapshot = normalizeOpportunitySnapshot({
      code: card.dataset.assetCode,
      total_tokens: card.dataset.totalTokens,
      tokens_sold: card.dataset.tokensSold,
      tokens_available: card.dataset.assetTokensAvailable,
      capital_raised: card.dataset.capitalRaised,
      capital_available: card.dataset.capitalAvailable,
      capital_remaining: card.dataset.capitalRemaining,
      participants_estimate: card.dataset.participantsEstimate,
      urgency_label: card.dataset.baseUrgencyLabel || card.dataset.urgencyLabel,
      urgency_tone: card.dataset.baseUrgencyTone || card.dataset.urgencyTone,
      estimated_return: card.dataset.estimatedReturn,
      token_price: card.dataset.assetTokenPrice,
      holding_quantity: card.dataset.assetHolding,
    });
    const seed = buildCardSeed(card.dataset.assetCode);

    return {
      card: card,
      seed: seed,
      random: createSeededRandom(seed),
      typeKey: card.dataset.assetTypeKey || "",
      baseUrgencyLabel: card.dataset.baseUrgencyLabel || snapshot.urgency_label,
      baseUrgencyTone: card.dataset.baseUrgencyTone || snapshot.urgency_tone,
      real: Object.assign({}, snapshot),
      visible: Object.assign({}, snapshot),
      activityScore: Number((0.3 + ((seed % 5) * 0.12)).toFixed(2)),
      timeoutId: null,
    };
  }

  function maybeAdvanceOpportunity(cardState, config) {
    const next = Object.assign({}, cardState.real);
    const sellableTokens = Math.max(next.tokens_available, 0);

    if (sellableTokens <= 0) {
      cardState.activityScore = Math.max(cardState.activityScore * 0.6, 0.15);
      next.activity_score = Number(cardState.activityScore.toFixed(2));
      return next;
    }

    const soldRatio = next.total_tokens ? next.tokens_sold / next.total_tokens : 0;
    const returnFactor = clampNumber(next.estimated_return / 20, 0.2, 1);
    const progressFactor = soldRatio >= 0.65 ? 0.75 : soldRatio <= 0.2 ? 0.55 : 0.65;
    const activityFactor = clampNumber(config.activityIntensity * (0.75 + returnFactor + progressFactor), 0.08, 0.95);
    const movementChance = activityFactor * (0.48 + (cardState.random() * 0.35));

    if (cardState.random() > movementChance) {
      cardState.activityScore = Math.max(cardState.activityScore * 0.78, 0.18);
      next.activity_score = Number(cardState.activityScore.toFixed(2));
      return next;
    }

    const maxDelta = sellableTokens <= 8 ? 1 : sellableTokens <= 20 ? 2 : 3;
    const delta = Math.max(1, Math.min(maxDelta, Math.ceil(cardState.random() * maxDelta * config.activityIntensity)));
    cardState.activityScore = clampNumber(cardState.activityScore + (delta * 0.7), 0.3, 4.2);
    next.activity_score = Number(cardState.activityScore.toFixed(2));
    return next;
  }

  function scheduleOpportunitySimulation(cardState, config) {
    if (!config.demoMode || !config.animatedTokenFlow) {
      return;
    }

    const run = function () {
      const minInterval = Math.max(1400, Number(config.minUpdateInterval) || 3200);
      const maxInterval = Math.max(minInterval + 400, Number(config.maxUpdateInterval) || 7600);
      const interval = Math.round(minInterval + ((maxInterval - minInterval) * cardState.random()));

      cardState.timeoutId = window.setTimeout(function () {
        const nextVisible = maybeAdvanceOpportunity(cardState, config);
        const visual = computeOpportunityPresentation(nextVisible, cardState, config);
        cardState.visible = nextVisible;
        cardState.card.dataset.assetTokensAvailable = String(nextVisible.tokens_available);
        cardState.card.dataset.tokensSold = String(nextVisible.tokens_sold);
        cardState.card.dataset.capitalAvailable = String(nextVisible.capital_available);
        cardState.card.dataset.capitalRemaining = String(nextVisible.capital_remaining);
        renderOpportunityCard(cardState.card, nextVisible, { visual: visual, highlight: nextVisible.tokens_sold !== cardState.real.tokens_sold });
        syncMarketAvailability();
        scheduleOpportunitySimulation(cardState, config);
      }, interval);
    };

    run();
  }

  function initOpportunityDemo(root) {
    const cards = collectOpportunityCards(root);
    if (!cards.length) {
      return;
    }

    opportunityDemo.config = readOpportunityDemoConfig(root);
    opportunityDemo.cards.clear();

    cards.forEach(function (card) {
      const cardState = buildOpportunityCardState(card);
      const visual = computeOpportunityPresentation(cardState.visible, cardState, opportunityDemo.config);
      opportunityDemo.cards.set(card.dataset.assetCode, cardState);
      renderOpportunityCard(card, cardState.visible, { visual: visual, highlight: false });
      scheduleOpportunitySimulation(cardState, opportunityDemo.config);
    });

    syncMarketAvailability();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const root = document.querySelector("[data-investment-root]");
    const modal = document.getElementById("agt-investment-modal");
    if (!root || !modal) {
      return;
    }

    initOpportunityDemo(root);

    const formState = modal.querySelector('[data-invest-state="form"]');
    const processingState = modal.querySelector('[data-invest-state="processing"]');
    const certificateState = modal.querySelector('[data-invest-state="certificate"]');
    const closeButtons = modal.querySelectorAll("[data-close-investment-modal]");
    const openButtons = document.querySelectorAll("[data-open-investment-modal]");
    const quantityInput = modal.querySelector("[data-invest-quantity-input]");
    const quantitySlider = modal.querySelector("[data-invest-quantity-slider]");
    const confirmButton = modal.querySelector("[data-confirm-investment]");
    const balanceNote = modal.querySelector("[data-invest-balance-note]");
    const validation = modal.querySelector("[data-invest-validation]");
    const stepperItems = createStepper(modal.querySelector("[data-stepper]"));
    let currentAsset = null;
    let currentTrigger = null;

    function updateBalanceNote(walletTokens, assetTokens, maxTokens) {
      if (!balanceNote) {
        return;
      }

      if (assetTokens <= 0) {
        balanceNote.hidden = false;
        balanceNote.textContent = "Este activo no tiene tokens disponibles en este momento.";
        return;
      }

      if (walletTokens <= 0) {
        balanceNote.hidden = false;
        balanceNote.textContent = "Este activo tiene " + assetTokens + " tokens disponibles, pero tu wallet AGT no tiene saldo para invertir ahora.";
        return;
      }

      if (walletTokens < assetTokens) {
        balanceNote.hidden = false;
        balanceNote.textContent = "El activo tiene " + assetTokens + " tokens disponibles. Tu wallet AGT tiene " + walletTokens + ", por eso ahora puedes invertir hasta " + maxTokens + ".";
        return;
      }

      balanceNote.hidden = false;
      balanceNote.textContent = "Este activo tiene " + assetTokens + " tokens disponibles y tu wallet AGT alcanza para invertir hasta " + maxTokens + ".";
    }

    function setState(name) {
      [formState, processingState, certificateState].forEach(function (state) {
        state.classList.toggle("is-active", state.dataset.investState === name);
      });
    }

    function openModal(source) {
      currentTrigger = source;
      currentAsset = source.closest("[data-invest-endpoint]") || source;
      const walletTokens = toInteger(root.dataset.walletTokens);
      const assetTokens = toInteger(currentAsset.dataset.assetTokensAvailable);
      const maxTokens = Math.max(Math.min(walletTokens, assetTokens), 0);
      const initialQuantity = maxTokens > 0 ? 1 : 0;

      quantityInput.min = maxTokens > 0 ? "1" : "0";
      quantitySlider.min = maxTokens > 0 ? "1" : "0";
      quantityInput.max = String(Math.max(maxTokens, initialQuantity));
      quantitySlider.max = String(Math.max(maxTokens, initialQuantity));
      quantityInput.value = String(initialQuantity);
      quantitySlider.value = String(initialQuantity);

      modal.querySelector("[data-modal-asset-name]").textContent = currentAsset.dataset.assetName;
      modal.querySelector("[data-modal-asset-copy]").textContent = "Tu inversión quedará respaldada por un contrato digital de copropiedad. La operación será registrada mediante hash en blockchain y actualizará el portafolio AgroTech.";
      modal.querySelector("[data-modal-asset-image]").src = currentAsset.dataset.assetImage;
      modal.querySelector("[data-modal-asset-image]").alt = currentAsset.dataset.assetName;
      modal.querySelector("[data-modal-asset-code]").textContent = currentAsset.dataset.assetCode;
      modal.querySelector("[data-modal-asset-status]").textContent = currentAsset.dataset.assetStatus;
      modal.querySelector("[data-modal-asset-urgency]").textContent = currentAsset.dataset.urgencyLabel || currentAsset.dataset.assetStatus;
      modal.querySelector("[data-modal-token-price]").textContent = formatCurrency(currentAsset.dataset.assetTokenPrice);
      modal.querySelector("[data-modal-wallet-tokens]").textContent = walletTokens;
      modal.querySelector("[data-modal-asset-tokens]").textContent = assetTokens;
      modal.querySelector("[data-modal-participants]").textContent = currentAsset.dataset.participantsEstimate || "0";
      modal.querySelector("[data-modal-asset-badge]").textContent = currentAsset.dataset.urgencyLabel || "Disponible";
      updateBalanceNote(walletTokens, assetTokens, maxTokens);
      validation.hidden = true;
      validation.textContent = "";
      confirmButton.disabled = false;
      setState("form");
      modal.classList.add("is-open");
      document.body.style.overflow = "hidden";
      recalculate();
    }

    function closeModal() {
      modal.classList.remove("is-open");
      document.body.style.overflow = "";
      if (balanceNote) {
        balanceNote.hidden = true;
        balanceNote.textContent = "";
      }
      currentAsset = null;
      currentTrigger = null;
    }

    function showError(message) {
      validation.hidden = false;
      validation.textContent = message;
      confirmButton.disabled = true;
    }

    function recalculate() {
      if (!currentAsset) {
        return false;
      }
      const quantity = toInteger(quantityInput.value);
      const walletTokens = toInteger(root.dataset.walletTokens);
      const assetTokens = toInteger(currentAsset.dataset.assetTokensAvailable);
      const tokenPrice = toInteger(currentAsset.dataset.assetTokenPrice);
      const totalTokens = toInteger(currentAsset.dataset.totalTokens);
      const estimatedReturn = Number(currentAsset.dataset.estimatedReturn || "0");
      const maxTokens = Math.max(Math.min(walletTokens, assetTokens), 0);

      updateBalanceNote(walletTokens, assetTokens, maxTokens);

      validation.hidden = true;
      confirmButton.disabled = false;

      if (quantity <= 0) {
        showError("Debes ingresar al menos 1 token AGT para invertir.");
        return false;
      }
      if (quantity > walletTokens) {
        showError("No tienes suficientes tokens AGT disponibles en tu wallet.");
        return false;
      }
      if (quantity > assetTokens) {
        showError("La cantidad supera la disponibilidad actual del activo.");
        return false;
      }

      const totalCop = quantity * tokenPrice;
      const participation = totalTokens ? ((quantity / totalTokens) * 100).toFixed(2) : "0.00";
      modal.querySelector("[data-invest-total-cop]").textContent = formatCurrency(totalCop);
      modal.querySelector("[data-invest-participation]").textContent = participation + "%";
      modal.querySelector("[data-invest-estimated-return]").textContent = estimatedReturn.toFixed(2) + "%";
      modal.querySelector("[data-invest-remaining-wallet]").textContent = Math.max(walletTokens - quantity, 0);
      return true;
    }

    function markStepper(activeIndex) {
      stepperItems.forEach(function (item, index) {
        item.classList.toggle("is-active", index === activeIndex);
        item.classList.toggle("is-complete", index < activeIndex);
      });
    }

    function wait(ms) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, ms);
      });
    }

    async function runInvestment() {
      if (!currentAsset || !recalculate()) {
        return;
      }

      setState("processing");
      confirmButton.disabled = true;
      let responseData = null;

      for (let index = 0; index < stepperItems.length; index += 1) {
        markStepper(index);
        if (index === 3) {
          const response = await fetch(currentAsset.dataset.investEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify({
              quantity: toInteger(quantityInput.value),
            }),
          });
          responseData = await response.json();
          if (!response.ok || !responseData.success) {
            setState("form");
            validation.hidden = false;
            validation.textContent = responseData.message || "No fue posible completar la operación.";
            confirmButton.disabled = false;
            return;
          }
        }
        await wait(index === 3 ? 760 : 420);
      }

      if (!responseData) {
        return;
      }

      syncWallet(responseData.wallet);
      updateAssetCard(responseData.asset);
      updateDetailPanels(responseData.asset, responseData.position);
      updatePortfolioPanel(responseData.asset, responseData.position, responseData.transaction);
      updateBlockchainPanels(responseData.contract, currentAsset.dataset.assetName, responseData.asset.code);
      window.dispatchEvent(new CustomEvent("agrotech-ledger-record", {
        detail: {
          source: "agt_investment",
          assetCode: responseData.asset.code,
          assetName: currentAsset.dataset.assetName,
          btcAmount: 0,
          agtAmount: responseData.transaction.quantity,
          status: "confirmed",
          operationType: "Asignacion de participacion",
          walletOriginLabel: "Wallet AGT inversionista",
          walletDestinationLabel: "Supply tokenizado",
          txHash: responseData.contract.tx_hash,
          blockId: responseData.contract.block_id,
          persist: false
        }
      }));

      modal.querySelector("[data-certificate-investor]").textContent = root.dataset.investorName || "Inversionista AgroTech";
      modal.querySelector("[data-certificate-asset]").textContent = currentAsset.dataset.assetName;
      modal.querySelector("[data-certificate-code]").textContent = currentAsset.dataset.assetCode;
      modal.querySelector("[data-certificate-tokens]").textContent = responseData.contract.tokens_acquired + " AGT";
      modal.querySelector("[data-certificate-participation]").textContent = responseData.contract.participation_pct + "%";
      modal.querySelector("[data-certificate-total]").textContent = formatCurrency(responseData.contract.investment_value_cop);
      modal.querySelector("[data-certificate-return]").textContent = responseData.contract.estimated_return_pct + "%";
      modal.querySelector("[data-certificate-issued]").textContent = responseData.contract.issued_at;
      modal.querySelector("[data-certificate-hash]").textContent = responseData.contract.tx_hash;
      modal.querySelector("[data-certificate-contract]").textContent = responseData.contract.contract_id;
      modal.querySelector("[data-certificate-status]").textContent = responseData.contract.status;
      modal.querySelector("[data-certificate-validation]").textContent = responseData.contract.blockchain_status;
      const downloadCertificate = modal.querySelector("[data-download-certificate]");
      if (downloadCertificate) {
        downloadCertificate.setAttribute("href", responseData.contract.download_pdf_url);
        downloadCertificate.removeAttribute("aria-disabled");
        downloadCertificate.classList.remove("is-disabled");
      }
      updateRecentCertificates(responseData.contract, currentAsset.dataset.assetName);
      setState("certificate");
    }

    openButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        openModal(button);
      });
    });

    closeButtons.forEach(function (button) {
      button.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeModal();
      }
    });

    quantityInput.addEventListener("input", function () {
      quantitySlider.value = quantityInput.value || "1";
      recalculate();
    });

    quantitySlider.addEventListener("input", function () {
      quantityInput.value = quantitySlider.value;
      recalculate();
    });

    confirmButton.addEventListener("click", runInvestment);

    const viewContract = modal.querySelector("[data-view-contract]");
    if (viewContract) {
      viewContract.addEventListener("click", function () {
        setState("certificate");
      });
    }
  });

  initWalletSummaryAccordion();
})();
