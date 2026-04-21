(function () {
  function parseSeedEntries() {
    const seedNode = document.getElementById("agt-ledger-seed");
    if (!seedNode) {
      return [];
    }
    try {
      return JSON.parse(seedNode.textContent || "[]");
    } catch (error) {
      return [];
    }
  }

  function parseAssetCatalog() {
    const assetNode = document.getElementById("agt-ledger-assets");
    if (!assetNode) {
      return [];
    }
    try {
      return JSON.parse(assetNode.textContent || "[]");
    } catch (error) {
      return [];
    }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-CO").format(Number(value || 0));
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(items) {
    return items[randomBetween(0, items.length - 1)];
  }

  function parseTimestamp(value) {
    if (!value) {
      return Date.now();
    }
    return new Date(String(value).replace(" ", "T")).getTime() || Date.now();
  }

  function formatTimestamp(ms) {
    const date = new Date(ms);
    const two = function (n) { return String(n).padStart(2, "0"); };
    return date.getFullYear() + "-" + two(date.getMonth() + 1) + "-" + two(date.getDate()) + " " + two(date.getHours()) + ":" + two(date.getMinutes()) + ":" + two(date.getSeconds());
  }

  function formatTime(ms) {
    const date = new Date(ms);
    const two = function (n) { return String(n).padStart(2, "0"); };
    return two(date.getHours()) + ":" + two(date.getMinutes()) + ":" + two(date.getSeconds());
  }

  function shortHash(prefix) {
    const chars = "abcdef0123456789";
    let hash = prefix || "bc1q";
    for (let i = 0; i < 12; i += 1) {
      hash += chars[randomBetween(0, chars.length - 1)];
    }
    return hash.slice(0, 8) + "..." + hash.slice(-4);
  }

  function walletAddress() {
    const chars = "abcdef0123456789";
    let value = "bc1q";
    for (let i = 0; i < 16; i += 1) {
      value += chars[randomBetween(0, chars.length - 1)];
    }
    return value.slice(0, 8) + "..." + value.slice(-4);
  }

  function statusLabel(status) {
    return {
      confirmed: "Confirmada",
      pending: "Pendiente",
      validating: "Validando",
      rejected: "Rechazada",
    }[status] || "Confirmada";
  }

  function statusClass(status) {
    return "agt-ledger-status agt-ledger-status--" + status + ((status === "pending" || status === "validating") ? " is-shimmer" : "");
  }

  function normalizeEntry(entry, state) {
    const createdAtMs = entry.createdAtMs || parseTimestamp(entry.timestamp);
    state.blockCounter = Math.max(state.blockCounter, parseInt(String(entry.block || "").replace(/[^\d]/g, ""), 10) || 0);
    return {
      id: entry.id || "ledger-" + createdAtMs + "-" + Math.random().toString(16).slice(2, 6),
      block: entry.block || ("AGT-BLK-" + (++state.blockCounter)),
      timestamp: entry.timestamp || formatTimestamp(createdAtMs),
      timeLabel: entry.time_label || entry.timeLabel || formatTime(createdAtMs),
      operationType: entry.operation_type || entry.operationType || "Compra AGT",
      asset: entry.asset,
      assetCode: entry.asset_code || entry.assetCode || "",
      walletOrigin: entry.wallet_origin || entry.walletOrigin || walletAddress(),
      walletDestination: entry.wallet_destination || entry.walletDestination || walletAddress(),
      btcAmount: entry.btc_amount || entry.btcAmount || "0.000000",
      agtAmount: Number(entry.agt_amount || entry.agtAmount || 0),
      hash: entry.hash || entry.txHash || shortHash("bc1q"),
      prevHash: entry.prev_hash || entry.prevHash || shortHash("bc1q"),
      status: entry.status || "confirmed",
      statusLabel: entry.status_label || entry.statusLabel || statusLabel(entry.status || "confirmed"),
      isMine: Boolean(entry.is_mine ?? entry.isMine),
      createdAtMs: createdAtMs,
      isNew: Boolean(entry.isNew),
      source: entry.source || "seed",
      persist: Boolean(entry.persist),
    };
  }

  function dedupeEntries(entries) {
    const result = [];
    entries.forEach(function (entry) {
      const duplicate = result.find(function (item) {
        return item.isMine === entry.isMine &&
          item.assetCode === entry.assetCode &&
          item.agtAmount === entry.agtAmount &&
          Math.abs(item.createdAtMs - entry.createdAtMs) < 180000;
      });
      if (!duplicate) {
        result.push(entry);
      }
    });
    return result;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const root = document.querySelector("[data-ledger-root]");
    if (!root) {
      return;
    }

    const feed = root.querySelector("[data-ledger-feed]");
    const tableBody = root.querySelector("[data-ledger-table-body]");
    const statusFilter = root.querySelector("[data-ledger-status-filter]");
    const assetFilter = root.querySelector("[data-ledger-asset-filter]");
    const mineFilter = root.querySelector("[data-ledger-mine-filter]");
    const toggleLiveButton = root.querySelector("[data-ledger-toggle-live]");
    const expandButton = root.querySelector("[data-ledger-expand]");
    const persistKey = "agrotech-ledger-history-v1";
    const assetCards = Array.from(document.querySelectorAll(".investor-opportunity-card[data-asset-code]"));
    const cardAssetCatalog = assetCards.map(function (card) {
      return {
        code: card.dataset.assetCode,
        name: card.dataset.assetName,
      };
    });
    const assetCatalog = cardAssetCatalog.length ? cardAssetCatalog : parseAssetCatalog();
    const state = {
      entries: [],
      persistedEntries: [],
      liveEnabled: true,
      expanded: false,
      timer: null,
      blockCounter: 842390,
    };

    function loadPersisted() {
      try {
        const raw = window.sessionStorage.getItem(persistKey);
        return raw ? JSON.parse(raw) : [];
      } catch (error) {
        return [];
      }
    }

    function savePersisted() {
      const persistable = state.entries
        .filter(function (entry) { return entry.persist; })
        .slice(0, 20)
        .map(function (entry) {
          return {
            id: entry.id,
            block: entry.block,
            timestamp: entry.timestamp,
            timeLabel: entry.timeLabel,
            operationType: entry.operationType,
            asset: entry.asset,
            assetCode: entry.assetCode,
            walletOrigin: entry.walletOrigin,
            walletDestination: entry.walletDestination,
            btcAmount: entry.btcAmount,
            agtAmount: entry.agtAmount,
            hash: entry.hash,
            prevHash: entry.prevHash,
            status: entry.status,
            statusLabel: entry.statusLabel,
            isMine: entry.isMine,
            createdAtMs: entry.createdAtMs,
            source: entry.source,
            persist: entry.persist,
          };
        });
      window.sessionStorage.setItem(persistKey, JSON.stringify(persistable));
    }

    function updatePersistedStatuses(entries) {
      const now = Date.now();
      return entries.map(function (entry) {
        const normalized = normalizeEntry(entry, state);
        if ((normalized.status === "pending" || normalized.status === "validating") && now - normalized.createdAtMs > 2200) {
          normalized.status = "confirmed";
          normalized.statusLabel = statusLabel("confirmed");
        }
        return normalized;
      });
    }

    function populateAssetFilter() {
      assetCatalog.forEach(function (asset) {
        const option = document.createElement("option");
        option.value = asset.code;
        option.textContent = asset.name;
        assetFilter.appendChild(option);
      });
    }

    function getFilteredEntries() {
      return state.entries.filter(function (entry) {
        if (statusFilter.value !== "all" && entry.status !== statusFilter.value) {
          return false;
        }
        if (assetFilter.value !== "all" && entry.assetCode !== assetFilter.value) {
          return false;
        }
        if (mineFilter.checked && !entry.isMine) {
          return false;
        }
        return true;
      });
    }

    function feedMarkup(entry) {
      return (
        '<article class="agt-ledger-feed__item' + (entry.isNew ? " is-new" : "") + '">' +
          '<div class="agt-ledger-feed__line">' +
            '<strong>' + entry.timeLabel + "</strong> — " + entry.operationType + '<br><span>' + entry.asset +
            " · " + Number(entry.btcAmount).toFixed(6) + " BTC · " + entry.agtAmount + " AGT</span>" +
          "</div>" +
          '<div class="agt-ledger-feed__meta">' +
            '<span class="' + statusClass(entry.status) + '">' + entry.statusLabel + "</span>" +
            '<span class="agt-ledger-feed__hash"><span class="agt-ledger-feed__hash-label">Hash</span>' + entry.hash + "</span>" +
          "</div>" +
        "</article>"
      );
    }

    function rowMarkup(entry) {
      return (
        '<tr class="agt-ledger-row' + (entry.isNew ? " is-new" : "") + '">' +
          '<td data-label="Bloque"><div class="agt-ledger-row__block"><strong>' + entry.block + '</strong><span class="agt-ledger-row__label">Prev: ' + entry.prevHash + "</span></div></td>" +
          '<td data-label="Timestamp">' + entry.timestamp + "</td>" +
          '<td data-label="Operación">' + entry.operationType + "</td>" +
          '<td data-label="Activo"><strong>' + entry.asset + '</strong><div class="agt-ledger-row__label">' + entry.assetCode + "</div></td>" +
          '<td data-label="Wallet origen">' + entry.walletOrigin + "</td>" +
          '<td data-label="Wallet destino">' + entry.walletDestination + "</td>" +
          '<td data-label="BTC">' + Number(entry.btcAmount).toFixed(6) + " BTC</td>" +
          '<td data-label="AGT">' + entry.agtAmount + " AGT</td>" +
          '<td data-label="Hash"><div class="agt-ledger-row__hash"><strong>' + entry.hash + '</strong><button type="button" class="agt-ledger-copy" data-copy-hash="' + entry.hash + '">Copiar hash</button></div></td>' +
          '<td data-label="Estado"><span class="' + statusClass(entry.status) + '">' + entry.statusLabel + "</span></td>" +
        "</tr>"
      );
    }

    function render() {
      const entries = getFilteredEntries();
      feed.innerHTML = entries.slice(0, 7).map(feedMarkup).join("") || '<div class="agt-ledger-empty">No hay transacciones para los filtros seleccionados.</div>';
      const visibleRows = state.expanded ? entries : entries.slice(0, 8);
      tableBody.innerHTML = visibleRows.map(rowMarkup).join("") || '<tr><td colspan="10"><div class="agt-ledger-empty">No hay registros contables disponibles.</div></td></tr>';
      state.entries.forEach(function (entry) {
        entry.isNew = false;
      });
      expandButton.textContent = state.expanded ? "Mostrar menos" : "Ver ledger completo";
      toggleLiveButton.textContent = state.liveEnabled ? "Pausar actividad en vivo" : "Reanudar";
      toggleLiveButton.classList.toggle("is-paused", !state.liveEnabled);
    }

    function scheduleLiveTick() {
      window.clearTimeout(state.timer);
      if (!state.liveEnabled) {
        return;
      }
      state.timer = window.setTimeout(function () {
        insertEntry(generateMockEntry(), false);
        scheduleLiveTick();
      }, randomBetween(3000, 6000));
    }

    function generateMockEntry() {
      const asset = pick(assetCatalog.length ? assetCatalog : [{ code: "LOT-001", name: "Lote Brahman Norte 01" }]);
      const statuses = ["confirmed", "validating", "pending"];
      const status = pick(statuses);
      const agtAmount = randomBetween(4, 22);
      const btcAmount = (agtAmount * 500000) / 265905079;
      const newest = state.entries[0];
      return normalizeEntry({
        id: "mock-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
        asset: asset.name,
        assetCode: asset.code,
        btcAmount: btcAmount.toFixed(6),
        agtAmount: agtAmount,
        status: status,
        statusLabel: statusLabel(status),
        operationType: "Compra AGT",
        walletOrigin: walletAddress(),
        walletDestination: walletAddress(),
        hash: shortHash("bc1q"),
        prevHash: newest ? newest.hash : shortHash("bc1q"),
        createdAtMs: Date.now(),
        isMine: false,
        isNew: true,
        source: "mock",
        persist: false,
      }, state);
    }

    function insertEntry(entry, shouldPersist) {
      const normalized = normalizeEntry(entry, state);
      normalized.isNew = true;
      normalized.prevHash = state.entries.length ? state.entries[0].hash : normalized.prevHash;
      state.entries.unshift(normalized);
      state.entries = dedupeEntries(state.entries).sort(function (a, b) {
        return b.createdAtMs - a.createdAtMs;
      }).slice(0, 40);
      if (shouldPersist || normalized.persist) {
        normalized.persist = true;
        savePersisted();
      }
      render();
      return normalized;
    }

    function updateEntryStatus(id, status) {
      const target = state.entries.find(function (entry) { return entry.id === id; });
      if (!target) {
        return;
      }
      target.status = status;
      target.statusLabel = statusLabel(status);
      target.isNew = true;
      savePersisted();
      render();
    }

    function queueUserEntryTransitions(entry) {
      if (entry.status === "pending") {
        window.setTimeout(function () {
          updateEntryStatus(entry.id, "validating");
        }, 900);
        window.setTimeout(function () {
          updateEntryStatus(entry.id, "confirmed");
        }, randomBetween(1700, 2500));
      }
    }

    function seedInitialEntries() {
      const seedEntries = parseSeedEntries().map(function (entry) {
        return normalizeEntry(entry, state);
      });
      const persistedEntries = updatePersistedStatuses(loadPersisted());
      state.entries = dedupeEntries(seedEntries.concat(persistedEntries)).sort(function (a, b) {
        return b.createdAtMs - a.createdAtMs;
      }).slice(0, 40);
      savePersisted();
      for (let i = 0; i < 4; i += 1) {
        state.entries.push(generateMockEntry());
      }
      state.entries = state.entries.sort(function (a, b) { return b.createdAtMs - a.createdAtMs; }).slice(0, 40);
      render();
    }

    populateAssetFilter();
    seedInitialEntries();
    scheduleLiveTick();

    statusFilter.addEventListener("change", render);
    assetFilter.addEventListener("change", render);
    mineFilter.addEventListener("change", render);
    toggleLiveButton.addEventListener("click", function () {
      state.liveEnabled = !state.liveEnabled;
      render();
      scheduleLiveTick();
    });
    expandButton.addEventListener("click", function () {
      state.expanded = !state.expanded;
      render();
    });

    root.addEventListener("click", function (event) {
      const copyButton = event.target.closest("[data-copy-hash]");
      if (!copyButton) {
        return;
      }
      const value = copyButton.dataset.copyHash;
      const finishCopy = function () {
        const previous = copyButton.textContent;
        copyButton.textContent = "Copiado";
        window.setTimeout(function () {
          copyButton.textContent = previous;
        }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(finishCopy);
        return;
      }
      const helper = document.createElement("input");
      helper.value = value;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
      finishCopy();
    });

    window.addEventListener("agrotech-ledger-record", function (event) {
      const detail = event.detail || {};
      const newest = state.entries[0];
      const entry = insertEntry({
        id: detail.source + "-" + Date.now(),
        asset: detail.assetName || "Activo AgroTech",
        assetCode: detail.assetCode || "",
        btcAmount: Number(detail.btcAmount || 0).toFixed(6),
        agtAmount: Number(detail.agtAmount || 0),
        status: detail.status || "pending",
        statusLabel: statusLabel(detail.status || "pending"),
        operationType: detail.operationType || "Compra AGT",
        walletOrigin: detail.walletOrigin || walletAddress(),
        walletDestination: detail.walletDestination || walletAddress(),
        hash: detail.txHash || shortHash("bc1q"),
        prevHash: newest ? newest.hash : shortHash("bc1q"),
        block: detail.blockId || ("AGT-BLK-" + (++state.blockCounter)),
        createdAtMs: Date.now(),
        isMine: true,
        source: detail.source || "user",
        persist: Boolean(detail.persist),
      }, Boolean(detail.persist));

      queueUserEntryTransitions(entry);
    });
  });
})();
