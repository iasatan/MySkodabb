(function (root) {
    "use strict";

    const CACHE_KEY = "myskodabb.chargers.v1";
    const CATALOG_URL = "https://olcsontoltok.hu/api/chargers/map-catalog";
    const validNumber = value => typeof value === "number" && Number.isFinite(value);
    const nonnegative = value => validNumber(value) && value >= 0 ? value : null;

    function validPosition(position) {
        return position && validNumber(position.latitude) && Math.abs(position.latitude) <= 90 &&
            validNumber(position.longitude) && Math.abs(position.longitude) <= 180;
    }

    function distanceKm(start, end) {
        if (!validPosition(start) || !validPosition(end)) return null;
        const radians = degrees => degrees * Math.PI / 180;
        const latitudeDelta = radians(end.latitude - start.latitude);
        const longitudeDelta = radians(end.longitude - start.longitude);
        const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(start.latitude)) *
            Math.cos(radians(end.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
        return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
    }

    function normalizeCatalog(catalog) {
        if (!catalog || !Array.isArray(catalog.chargers) || !catalog.chargers.length ||
            typeof catalog.currency !== "string" || !/^[A-Z]{3}$/.test(catalog.currency)) {
            throw new Error("chargers_invalid_catalog");
        }
        const chargers = catalog.chargers.filter(charger => charger &&
            ["string", "number"].includes(typeof charger.id) && typeof charger.name === "string" &&
            validPosition({ latitude: charger.lat, longitude: charger.lng }));
        if (!chargers.length) throw new Error("chargers_invalid_catalog");
        return { version: catalog.version || null, currency: catalog.currency,
            ratesFromHuf: catalog.ratesFromHuf || {}, pricingAt: nonnegative(catalog.pricingAt), chargers };
    }

    function convertPrice(amount, currency, catalog) {
        if (nonnegative(amount) === null) return null;
        if (currency === catalog.currency) return amount;
        const source = currency === "HUF" ? 1 : catalog.ratesFromHuf?.[currency];
        const target = catalog.currency === "HUF" ? 1 : catalog.ratesFromHuf?.[catalog.currency];
        return validNumber(source) && source > 0 && validNumber(target) && target > 0 ? amount / source * target : null;
    }

    function mergePricing(catalog, delta, fetchedAt = Date.now()) {
        if (delta?.full !== true || !Array.isArray(delta.changes) ||
            delta.staticVersion !== catalog.version) throw new Error("chargers_invalid_pricing");
        const changes = new Map(delta.changes.filter(change => change?.id !== undefined).map(change => [change.id, change]));
        return { ...catalog, pricingAt: fetchedAt, chargers: catalog.chargers.map(charger => {
            const change = changes.get(charger.id);
            return { ...charger, status: change?.status ?? null, openNow: change?.openNow ?? null,
                connectors: (charger.connectors || []).map((connector, index) => {
                    const pricing = change?.connectors?.[index];
                    return { ...connector, pricePerKwh: convertPrice(pricing?.pricePerKwh, pricing?.priceCurrency, catalog),
                        priceCurrency: catalog.currency, status: pricing?.status ?? null };
                }) };
        }) };
    }

    function readCache(storage) {
        try {
            const cached = JSON.parse(storage.getItem(CACHE_KEY));
            if (cached?.schema !== 1 || !validNumber(cached.fetchedAt) || cached.fetchedAt <= 0) return null;
            return { ...cached, catalog: normalizeCatalog(cached.catalog) };
        } catch {
            return null;
        }
    }

    function saveCache(storage, catalog, fetchedAt = Date.now()) {
        const cached = { schema: 1, fetchedAt, catalog: normalizeCatalog(catalog) };
        storage.setItem(CACHE_KEY, JSON.stringify(cached));
        return cached;
    }

    function candidates(catalog, car, home, rangeKm, radiusKm, reservePercent = 10, connectorType = "") {
        if (!validPosition(car) || !validNumber(rangeKm) || rangeKm < 0 ||
            !validNumber(radiusKm) || radiusKm <= 0 || !validNumber(reservePercent) ||
            reservePercent < 0 || reservePercent > 100) return [];
        const budgetKm = rangeKm * (1 - reservePercent / 100);
        const homeDistanceKm = validPosition(home) ? distanceKm(car, home) : null;
        return catalog.chargers.flatMap(charger => {
            if (charger.usageType !== "public" || charger.status === "broken" || charger.openNow === false) return [];
            const connectors = Array.isArray(charger.connectors) ? charger.connectors : [];
            const matching = connectorType ? connectors.filter(connector => connector.type === connectorType) : connectors;
            if (connectorType && !matching.length) return [];
            const position = { latitude: charger.lat, longitude: charger.lng };
            const directKm = distanceKm(car, position);
            if (directKm > Math.min(budgetKm, radiusKm)) return [];
            const homeKm = homeDistanceKm === null ? null : distanceKm(position, home);
            const detourKm = homeKm === null ? null : Math.max(0, directKm + homeKm - homeDistanceKm);
            const progressKm = homeDistanceKm > 0.1
                ? (directKm ** 2 + homeDistanceKm ** 2 - homeKm ** 2) / (2 * homeDistanceKm) : null;
            const towardHome = homeKm !== null && homeDistanceKm > 0.1 && homeKm < homeDistanceKm &&
                progressKm >= 0 && progressKm <= homeDistanceKm &&
                detourKm <= Math.max(2, directKm * 0.25);
            const prices = matching.map(connector => nonnegative(connector.pricePerKwh)).filter(price => price !== null);
            const fallbackPrice = connectorType ? null : nonnegative(charger.pricePerKwh);
            return [{ ...charger, position, directKm, detourKm, towardHome, budgetKm,
                acceptsBankCard: connectorType ? matching.some(connector => connector.acceptsBankCard === true) :
                    charger.acceptsBankCard === true || matching.some(connector => connector.acceptsBankCard === true),
                pricePerKwh: prices.length ? Math.min(...prices) : fallbackPrice,
                startFee: nonnegative(charger.extraFees?.startFee) }];
        }).sort((first, second) => first.directKm - second.directKm);
    }

    function shortlist(nearby, limit = 60) {
        const nearest = nearby.slice(0, Math.ceil(limit * 2 / 3));
        const homeward = nearby.filter(charger => charger.towardHome).slice(0, limit - nearest.length);
        const selected = new Map([...nearest, ...homeward].map(charger => [charger.id, charger]));
        for (const charger of nearby) {
            if (selected.size >= limit) break;
            selected.set(charger.id, charger);
        }
        return [...selected.values()];
    }

    function rankReachable(chargers, distancesKm, cardOnly = false) {
        return chargers.flatMap((charger, index) => {
            const drivingKm = distancesKm[index];
            if (!validNumber(drivingKm) || drivingKm < 0 || drivingKm > charger.budgetKm ||
                cardOnly && !charger.acceptsBankCard) return [];
            return [{ ...charger, drivingKm }];
        }).sort((first, second) => Number(second.towardHome) - Number(first.towardHome) ||
            (first.pricePerKwh ?? Infinity) - (second.pricePerKwh ?? Infinity) ||
            Number(second.acceptsBankCard) - Number(first.acceptsBankCard) ||
            (first.startFee ?? Infinity) - (second.startFee ?? Infinity) || first.drivingKm - second.drivingKm);
    }

    const api = { CACHE_KEY, CATALOG_URL, validPosition, distanceKm, normalizeCatalog, mergePricing, readCache, saveCache,
        candidates, shortlist, rankReachable };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.NearbyChargers = api;
})(typeof globalThis !== "undefined" ? globalThis : this);