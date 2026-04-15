(function () {
  function formatNumber(value) {
    const numeric = Number(value || 0);
    return new Intl.NumberFormat("es-CO").format(numeric);
  }

  function formatCurrency(value) {
    return "$" + formatNumber(value) + " COP";
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
    document.querySelectorAll("[data-wallet-equivalent]").forEach(function (item) {
      item.textContent = formatNumber(snapshot.equivalent_cop);
    });
    document.querySelectorAll("[data-wallet-assets]").forEach(function (item) {
      item.textContent = snapshot.portfolio_assets;
    });
    document.querySelectorAll("[data-wallet-total-invested]").forEach(function (item) {
      item.textContent = formatNumber(snapshot.total_invested);
    });
    document.querySelectorAll("[data-wallet-yield]").forEach(function (item) {
      item.textContent = snapshot.estimated_return_pct;
    });
  }

  function updateAssetCard(snapshot) {
    document.querySelectorAll('.investor-opportunity-card[data-asset-code="' + snapshot.code + '"]').forEach(function (card) {
      card.dataset.assetTokensAvailable = String(snapshot.tokens_available);
      card.dataset.tokensSold = String(snapshot.tokens_sold);
      card.dataset.totalTokens = String(snapshot.total_tokens);
      card.dataset.capitalRaised = String(snapshot.capital_raised);
      card.dataset.capitalRemaining = String(snapshot.capital_remaining);
      card.dataset.participantsEstimate = String(snapshot.participants_estimate);
      card.dataset.urgencyLabel = snapshot.urgency_label;
      card.dataset.urgencyTone = snapshot.urgency_tone;
      card.dataset.assetHolding = String(snapshot.holding_quantity);
      const progressCopy = card.querySelector("[data-asset-progress-copy]");
      const progressValue = card.querySelector("[data-asset-progress-value]");
      const progressBar = card.querySelector("[data-asset-progress-bar]");
      const availabilityCopy = card.querySelector("[data-asset-availability-copy]");
      const urgencyLabel = card.querySelector("[data-asset-urgency-label]");
      const capitalRaised = card.querySelector("[data-asset-capital-raised]");
      const capitalRemaining = card.querySelector("[data-asset-capital-remaining]");
      const participants = card.querySelector("[data-asset-participants]");
      const availableTokens = card.querySelector("[data-asset-tokens-available]");
      const priceAmount = card.querySelector("[data-asset-price-amount]");

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
        urgencyLabel.textContent = snapshot.urgency_label;
      }
      if (capitalRaised) {
        capitalRaised.textContent = formatCurrency(snapshot.capital_raised);
      }
      if (capitalRemaining) {
        capitalRemaining.textContent = formatCurrency(snapshot.capital_remaining);
      }
      if (participants) {
        participants.textContent = snapshot.participants_estimate;
      }
      if (availableTokens) {
        availableTokens.textContent = snapshot.tokens_available + " tokens";
      }
      if (priceAmount) {
        priceAmount.textContent = "$" + formatNumber(snapshot.capital_remaining);
      }
      const button = card.querySelector("[data-open-investment-modal]");
      if (button) {
        button.disabled = snapshot.tokens_available <= 0;
      }
    });
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
        openButton.dataset.capitalRemaining = String(snapshot.capital_remaining);
        openButton.dataset.participantsEstimate = String(snapshot.participants_estimate);
        openButton.dataset.urgencyLabel = snapshot.urgency_label;
        openButton.dataset.urgencyTone = snapshot.urgency_tone;
        openButton.dataset.assetHolding = String(snapshot.holding_quantity);
      }
    }

    const statusEl = document.querySelector("[data-detail-status-label]");
    if (statusEl) {
      statusEl.textContent = "Estado: " + snapshot.status_label;
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
      progressCopy.textContent = snapshot.tokens_sold + " / " + snapshot.total_tokens + " tokens vendidos";
    }
    const availabilityCopy = document.querySelector("[data-detail-availability-copy]");
    if (availabilityCopy) {
      availabilityCopy.textContent = snapshot.tokens_available + " tokens restantes";
    }
    const units = document.querySelector("[data-detail-asset-units]");
    if (units) {
      units.textContent = snapshot.tokens_available + " / " + snapshot.total_tokens;
    }
    const capitalRaised = document.querySelector("[data-detail-capital-raised]");
    if (capitalRaised) {
      capitalRaised.textContent = formatCurrency(snapshot.capital_raised);
    }
    const capitalRemaining = document.querySelector("[data-detail-capital-remaining]");
    if (capitalRemaining) {
      capitalRemaining.textContent = formatCurrency(snapshot.capital_remaining);
    }
    const participants = document.querySelector("[data-detail-participants]");
    if (participants) {
      participants.textContent = snapshot.participants_estimate;
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
      const chip = document.getElementById("selected-asset-tokens-chip");
      if (chip) {
        chip.textContent = snapshot.tokens_available + " tokens disponibles";
      }
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

  document.addEventListener("DOMContentLoaded", function () {
    const root = document.querySelector("[data-investment-root]");
    const modal = document.getElementById("agt-investment-modal");
    if (!root || !modal) {
      return;
    }

    const formState = modal.querySelector('[data-invest-state="form"]');
    const processingState = modal.querySelector('[data-invest-state="processing"]');
    const certificateState = modal.querySelector('[data-invest-state="certificate"]');
    const closeButtons = modal.querySelectorAll("[data-close-investment-modal]");
    const openButtons = document.querySelectorAll("[data-open-investment-modal]");
    const quantityInput = modal.querySelector("[data-invest-quantity-input]");
    const quantitySlider = modal.querySelector("[data-invest-quantity-slider]");
    const confirmButton = modal.querySelector("[data-confirm-investment]");
    const validation = modal.querySelector("[data-invest-validation]");
    const stepperItems = createStepper(modal.querySelector("[data-stepper]"));
    let currentAsset = null;
    let currentTrigger = null;

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
      const maxTokens = Math.max(1, Math.min(walletTokens, assetTokens));
      quantityInput.max = String(maxTokens);
      quantitySlider.max = String(maxTokens);
      quantityInput.value = "1";
      quantitySlider.value = "1";

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
      modal.querySelector("[data-invest-remaining-wallet]").textContent = Math.max(walletTokens - quantity, 0) + " tokens";
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
})();
