(function () {
    var mapRoot = document.querySelector("[data-asset-map]");
    if (!mapRoot) {
        return;
    }

    var mapShell = mapRoot.querySelector(".asset-location-map");
    var liveMapElement = mapRoot.querySelector("[data-leaflet-map]");
    var controls = mapRoot.querySelectorAll("[data-map-mode]");
    var fallbackMarker = mapRoot.querySelector("[data-map-marker]");
    var leafletMap = null;
    var cowMarker = null;
    var zoneCircle = null;
    var animationFrame = null;
    var currentMode = "farm";

    function toNumber(value, fallback) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    var assetPoint = [
        toNumber(mapShell && mapShell.getAttribute("data-map-lat"), 2.5359),
        toNumber(mapShell && mapShell.getAttribute("data-map-lng"), -75.5277)
    ];
    var farmCode = (mapShell && mapShell.getAttribute("data-map-code")) || "";
    var farmName = (mapShell && mapShell.getAttribute("data-map-farm")) || "Finca AgroTech";
    var placeName = (mapShell && mapShell.getAttribute("data-map-place")) || "Huila";
    var movementProfiles = {
        "FARM-001": { latRadius: .0015, lngRadius: .0019, zoneRadius: 470, stepDuration: 6200, holdDuration: 2600, driftFactor: .18 },
        "FARM-002": { latRadius: .0013, lngRadius: .0017, zoneRadius: 430, stepDuration: 5800, holdDuration: 2400, driftFactor: .16 },
        "FARM-003": { latRadius: .0017, lngRadius: .0021, zoneRadius: 510, stepDuration: 6800, holdDuration: 2800, driftFactor: .2 }
    };

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character];
        });
    }

    function cowMarkerHtml() {
        return '<img src="/static/images/icons/vectormaps.png" alt="" aria-hidden="true">';
    }

    function setMode(mode) {
        currentMode = mode || "farm";

        if (mapShell) {
            mapShell.classList.remove("is-farm", "is-region");
            mapShell.classList.add("is-" + currentMode);
        }

        controls.forEach(function (control) {
            var isActive = control.getAttribute("data-map-mode") === currentMode;
            control.classList.toggle("is-active", isActive);
            control.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        if (!leafletMap) {
            return;
        }

        if (currentMode === "farm") {
            leafletMap.flyTo(assetPoint, 14, { duration: .7 });
        } else if (currentMode === "region") {
            leafletMap.flyTo([2.5359, -75.5277], 9, { duration: .7 });
        }
    }

    function getMovementProfile(code) {
        return movementProfiles[code] || {
            latRadius: .0014,
            lngRadius: .0018,
            zoneRadius: 440,
            stepDuration: 6000,
            holdDuration: 2500,
            driftFactor: .17
        };
    }

    function createSeededRandom(seed) {
        var hash = 2166136261;

        for (var i = 0; i < seed.length; i += 1) {
            hash ^= seed.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return function () {
            hash += 2147483646;
            hash = Math.imul(hash ^ (hash >>> 15), 1 | hash);
            hash ^= hash + Math.imul(hash ^ (hash >>> 7), 61 | hash);
            return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
        };
    }

    function easeInOut(progress) {
        return progress < .5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    }

    function clampToPasture(point, center, profile) {
        var latDelta = point[0] - center[0];
        var lngDelta = point[1] - center[1];
        var normalizedDistance = Math.pow(latDelta / profile.latRadius, 2) + Math.pow(lngDelta / profile.lngRadius, 2);

        if (normalizedDistance <= 1) {
            return point;
        }

        var scale = .92 / Math.sqrt(normalizedDistance);
        return [
            center[0] + (latDelta * scale),
            center[1] + (lngDelta * scale)
        ];
    }

    function randomPointInPasture(center, profile, random) {
        var angle = random() * Math.PI * 2;
        var distance = Math.sqrt(random()) * .92;

        return [
            center[0] + (Math.sin(angle) * profile.latRadius * distance),
            center[1] + (Math.cos(angle) * profile.lngRadius * distance)
        ];
    }

    function nextPasturePoint(from, center, profile, random) {
        for (var attempt = 0; attempt < 6; attempt += 1) {
            var angle = random() * Math.PI * 2;
            var stepScale = .08 + (random() * profile.driftFactor);
            var candidate = clampToPasture([
                from[0] + (Math.sin(angle) * profile.latRadius * stepScale),
                from[1] + (Math.cos(angle) * profile.lngRadius * stepScale)
            ], center, profile);
            var latShift = Math.abs(candidate[0] - from[0]);
            var lngShift = Math.abs(candidate[1] - from[1]);

            if (latShift > profile.latRadius * .05 || lngShift > profile.lngRadius * .05) {
                return candidate;
            }
        }

        return randomPointInPasture(center, profile, random);
    }

    function interpolatePoint(from, to, progress) {
        var easedProgress = easeInOut(progress);
        return [
            from[0] + ((to[0] - from[0]) * easedProgress),
            from[1] + ((to[1] - from[1]) * easedProgress)
        ];
    }

    function animateCow(center) {
        var profile = getMovementProfile(farmCode);
        var random = createSeededRandom((farmCode || farmName) + "|" + placeName);
        var from = randomPointInPasture(center, profile, random);
        var to = nextPasturePoint(from, center, profile, random);
        var start = performance.now();

        if (cowMarker) {
            cowMarker.setLatLng(from);
        }

        function tick(now) {
            if (cowMarker) {
                var cycleDuration = profile.stepDuration + profile.holdDuration;
                var elapsed = now - start;

                if (elapsed < profile.stepDuration) {
                    cowMarker.setLatLng(interpolatePoint(from, to, elapsed / profile.stepDuration));
                } else if (elapsed < cycleDuration) {
                    cowMarker.setLatLng(to);
                } else {
                    from = to;
                    to = nextPasturePoint(from, center, profile, random);
                    start = now;
                    cowMarker.setLatLng(from);
                }
            }
            animationFrame = window.requestAnimationFrame(tick);
        }

        animationFrame = window.requestAnimationFrame(tick);
    }

    function initLeafletMap() {
        if (!window.L || !mapShell || !liveMapElement) {
            return false;
        }

        var L = window.L;
        var movementProfile = getMovementProfile(farmCode);

        leafletMap = L.map(liveMapElement, {
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: true
        }).setView(assetPoint, 14);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd",
            maxZoom: 20,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(leafletMap);

        zoneCircle = L.circle(assetPoint, {
            radius: movementProfile.zoneRadius,
            color: "#1f6b38",
            weight: 2,
            opacity: .75,
            fillColor: "#7dd596",
            fillOpacity: .18
        }).addTo(leafletMap);

        L.marker(assetPoint, {
            title: farmName
        }).addTo(leafletMap).bindPopup("<strong>" + escapeHtml(farmName) + "</strong>" + escapeHtml(placeName));

        cowMarker = L.marker(assetPoint, {
            icon: L.divIcon({
                className: "asset-location-cow-marker",
                html: cowMarkerHtml(),
                iconSize: [44, 32],
                iconAnchor: [22, 22]
            }),
            title: "Movimiento del activo"
        }).addTo(leafletMap).bindPopup("<strong>Activo en pastoreo</strong>" + escapeHtml(farmName));

        mapShell.classList.add("has-live-map");
        setTimeout(function () {
            leafletMap.invalidateSize();
        }, 80);
        animateCow(assetPoint);
        return true;
    }

    controls.forEach(function (control) {
        control.setAttribute("aria-pressed", control.classList.contains("is-active") ? "true" : "false");
        control.addEventListener("click", function () {
            setMode(control.getAttribute("data-map-mode") || "farm");
        });
    });

    if (fallbackMarker) {
        fallbackMarker.addEventListener("click", function () {
            fallbackMarker.classList.toggle("is-focused");
            setMode("farm");
        });
    }

    window.addEventListener("beforeunload", function () {
        if (animationFrame) {
            window.cancelAnimationFrame(animationFrame);
        }
        if (leafletMap) {
            leafletMap.remove();
        }
    });

    initLeafletMap();
    setMode(currentMode);
})();
