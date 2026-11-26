const chargerElements = Object.fromEntries([
    "refresh-car", "refresh-catalog", "charger-vehicle-status", "charger-catalog-status", "charger-warning",
    "charger-filters", "charger-address", "charger-radius", "charger-reserve", "charger-connector", "charger-card-only", "charger-hybrid-only", "find-chargers",
    "charger-map", "charger-search-status", "charger-list", "charger-results-heading", "charger-method", "charger-hybrid-label",
    "charger-refresh-dialog", "charger-refresh-form", "charger-refresh-cancel", "charger-types", "charger-counties", "charger-changes"
].map(id => [id, document.getElementById(id)]));
let chargerCatalog = null;
let chargerCatalogPreferences = null;
let chargerVehicle = null;
let chargerVehicleMeta = null;
let chargerHome = null;
let chargerSearchDestination = null;
const chargerAddressCache = new Map();
let chargerBusy = false;
let chargerMap = null;
let chargerMapMarkers = null;
let chargerMapPositions = [];
let chargerStorage = null;
try { chargerStorage = localStorage; } catch {}

const chargerTypeOptions = ["CCS Type 2", "Type 2", "CHAdeMO", "Unknown"];
const chargerCountyOptions = ["Baranya", "Borsod-Abaúj-Zemplén", "Budapest", "Bács-Kiskun", "Békés",
    "Csongrád-Csanád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves", "Jász-Nagykun-Szolnok",
    "Komárom-Esztergom", "Nógrád", "Pest", "Somogy", "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala"];

function populateChargerOptions(container, options, selected) {
    container.replaceChildren();
    for (const option of new Set([...options, ...selected])) {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = option;
        input.checked = selected.includes(option);
        label.append(input, document.createTextNode(option));
        container.append(label);
    }
}

function openChargerRefreshDialog() {
    const settings = loadSkodaSettings();
    populateChargerOptions(chargerElements["charger-types"], chargerTypeOptions, settings.chargerTypes);
    populateChargerOptions(chargerElements["charger-counties"], chargerCountyOptions, settings.chargerCounties);
    chargerElements["charger-refresh-dialog"].showModal();
}

function chargerMessage(id, message, error = false) {
    chargerElements[id].textContent = message;
    chargerElements[id].classList.toggle("error", error);
}

function chargerDate(timestamp) {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(timestamp);
}

async function chargerFetchJson(url) {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(12000), credentials: "omit", cache: "no-store" });
    if (!response.ok) throw new Error(t("chargers_download_failed", { status: response.status }));
    return response.json();
}

async function chargerPublicData(path) {
    return chargerFetchJson(`${SKODA_WORKER_BASE_URL}/chargers/${path}`);
}

function chargerCachePreferences(settings) {
    const compare = (first, second) => (first > second) - (first < second);
    return JSON.stringify([settings.currency, [...(settings.chargerTypes || [])].sort(compare), [...(settings.chargerCounties || [])].sort(compare)]);
}

function chargerDatabaseOperation(mode, operation) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("myskodabb-chargers", 1);
        let blocked = false;
        request.onupgradeneeded = () => request.result.createObjectStore("cache");
        request.onerror = () => reject(request.error);
        request.onblocked = () => { blocked = true; reject(new Error("IndexedDB blocked")); };
        request.onsuccess = () => {
            const database = request.result;
            if (blocked) { database.close(); return; }
            database.onversionchange = () => database.close();
            try {
                const transaction = database.transaction("cache", mode);
                const result = operation(transaction.objectStore("cache"));
                transaction.oncomplete = () => { database.close(); resolve(result.result); };
                transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error); };
            } catch (error) { database.close(); reject(error); }
        };
    });
}

async function writeChargerCache(catalog, fetchedAt, settings) {
    let serialized;
    NearbyChargers.saveCache({ setItem: (key, value) => { serialized = value; } }, catalog, fetchedAt, settings);
    await chargerDatabaseOperation("readwrite", store => store.put({ serialized, preferences: chargerCachePreferences(settings) }, NearbyChargers.CACHE_KEY));
}

async function readChargerCache() {
    const settings = loadSkodaSettings();
    try {
        const stored = await chargerDatabaseOperation("readonly", store => store.get(NearbyChargers.CACHE_KEY));
        if (stored) {
            if (stored.preferences !== chargerCachePreferences(settings)) return null;
            return NearbyChargers.readCache({ getItem: () => stored.serialized });
        }
    } catch {}
    const legacy = NearbyChargers.readCache(chargerStorage);
    if (!legacy) return null;
    try {
        await writeChargerCache(legacy.catalog, legacy.fetchedAt, settings);
        try { chargerStorage.removeItem(NearbyChargers.CACHE_KEY); } catch {}
    } catch { chargerMessage("charger-warning", t("chargers_storage_failed"), true); }
    return legacy;
}

async function setChargerCatalog(catalog, fetchedAt, source, persist = true, settings = loadSkodaSettings()) {
    catalog = NearbyChargers.compactCatalog(catalog, settings);
    chargerCatalog = catalog;
    chargerCatalogPreferences = chargerCachePreferences(settings);
    let saved = !persist;
    if (persist) {
        try { await writeChargerCache(catalog, fetchedAt, settings); saved = true; }
        catch { chargerMessage("charger-warning", t("chargers_storage_failed"), true); }
    }
    chargerMessage("charger-catalog-status", t("chargers_catalog_status", {
        count: catalog.chargers.length, date: chargerDate(fetchedAt), source: t(source)
    }) + (catalog.pricingAt ? ` ${t("chargers_pricing_date", { date: chargerDate(catalog.pricingAt) })}` : ` ${t("chargers_no_prices")}`) +
        (Date.now() - fetchedAt > 86400000 ? ` ${t("chargers_stale")}` : ""));
    const select = chargerElements["charger-connector"];
    const previous = select.value;
    select.replaceChildren(new Option(t("chargers_all_connectors"), ""));
    const types = [...new Set(catalog.chargers.flatMap(charger => (charger.connectors || []).map(connector => connector.type)).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second));
    for (const type of types) select.add(new Option(type, type));
    if (types.includes(previous)) select.value = previous;
    return saved;
}

function renderChargerChanges(previous, current, comparable) {
    const container = chargerElements["charger-changes"];
    container.replaceChildren();
    container.hidden = false;
    const heading = document.createElement("h2");
    heading.textContent = t("chargers_changes_title");
    container.append(heading);
    const message = key => {
        const paragraph = document.createElement("p");
        paragraph.textContent = t(key);
        container.append(paragraph);
    };
    if (!previous) { message("chargers_changes_first"); return; }
    if (!comparable) { message("chargers_changes_selection"); return; }
    const changes = NearbyChargers.compareCatalogs(previous, current);
    const name = charger => `${charger.name}${charger.county ? " (" + charger.county + ")" : ""} [${charger.id}]`;
    const currency = new Intl.NumberFormat(getLocale(), { style: "currency", currency: current.currency, maximumFractionDigits: 2 });
    const formatPrices = prices => prices.map(price => price === null ? t("chargers_price_unknown") : `${currency.format(price)}/kWh`).join(", ");
    const section = (key, items, describe) => {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = t(key, { count: items.length });
        details.append(summary);
        if (items.length) {
            const list = document.createElement("ul");
            for (const item of items) {
                const entry = document.createElement("li");
                entry.textContent = describe(item);
                list.append(entry);
            }
            details.append(list);
        }
        container.append(details);
    };
    section("chargers_changes_added", changes.added, name);
    section("chargers_changes_removed", changes.removed, name);
    if (previous.pricingAt && current.pricingAt) {
        section("chargers_changes_unavailable", changes.unavailable, name);
        if (previous.currency === current.currency) {
            section("chargers_changes_prices", changes.prices, change =>
                `${name(change.charger)} - ${[change.type, change.powerKw == null ? null : change.powerKw + " kW"].filter(Boolean).join(" ") || t("chargers_energy_price")}: ${formatPrices(change.before)} -> ${formatPrices(change.after)}`);
        } else message("chargers_changes_prices_unavailable");
    } else message("chargers_changes_prices_unavailable");
}

async function loadChargerCatalog(forceRefresh = false, preferences = null) {
    if (!forceRefresh) {
        const cached = await readChargerCache();
        if (cached) {
            await setChargerCatalog(cached.catalog, cached.fetchedAt, "source_cache", !cached.catalog.compact);
            return;
        }
    }
    const previous = chargerCatalog;
    const previousPreferences = chargerCatalogPreferences;
    if (forceRefresh) {
        chargerElements["charger-changes"].hidden = true;
        chargerElements["charger-changes"].replaceChildren();
    }
    chargerMessage("charger-catalog-status", t("loading"));
    try {
        let catalog = NearbyChargers.normalizeCatalog(await chargerPublicData("map-catalog"));
        try {
            catalog = NearbyChargers.mergePricing(catalog, await chargerPublicData("map-catalog/delta"));
        } catch { chargerMessage("charger-warning", t("chargers_pricing_failed"), true); }
        const settings = { ...loadSkodaSettings(), ...preferences };
        const saved = await setChargerCatalog(catalog, Date.now(), "source_fresh", true, settings);
        if (preferences && saved) saveSkodaSettings(settings, { preserveChargerCache: true });
        if (forceRefresh) renderChargerChanges(previous, chargerCatalog, previousPreferences === chargerCachePreferences(settings));
    } catch {
        if (chargerCatalog) {
            chargerMessage("charger-catalog-status", t("chargers_refresh_failed"), true);
            return;
        }
        chargerMessage("charger-catalog-status", t("chargers_live_failed"), true);
    }
}

function renderChargerHybridLabel() {
    const settings = loadSkodaSettings();
    const cost = NearbyChargers.hybridCostPerKm(chargerVehicle, settings);
    const price = cost === null ? t("chargers_price_unknown") : `${new Intl.NumberFormat(getLocale(), {
        style: "currency", currency: settings.currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2
    }).format(cost)}/km`;
    chargerElements["charger-hybrid-label"].textContent = `${t("chargers_hybrid_only")} (${price})`;
}

async function loadChargerVehicle(forceRefresh = false) {
    try {
        const result = await fetchVehicle({ forceRefresh });
        chargerVehicle = summarizeVehicle(result.data);
        chargerVehicleMeta = result;
    } catch (error) {
        chargerVehicle = null;
        renderChargerHybridLabel();
        chargerMessage("charger-vehicle-status", error.message, true);
        return;
    }
    const vehicle = chargerVehicle;
    const vehicleSource = chargerVehicleMeta.fromCache ? "source_cache" : "source_fresh";
    chargerMessage("charger-vehicle-status", t("chargers_vehicle_status", {
        soc: vehicle.stateOfCharge === null ? "?" : formatNumber(vehicle.stateOfCharge),
        range: vehicle.electricRangeKm === null ? "?" : formatNumber(vehicle.electricRangeKm),
        date: chargerDate(chargerVehicleMeta.fetchedAt),
        source: t(chargerVehicleMeta.demo ? "source_demo" : vehicleSource)
    }));
    renderChargerHybridLabel();
    renderChargerMap([]);
}

function fitChargerMap() {
    if (chargerMapPositions.length > 1) chargerMap.fitBounds(chargerMapPositions, { padding: [32, 32], maxZoom: 14 });
    else if (chargerMapPositions.length) chargerMap.setView(chargerMapPositions[0], 13);
}

function chargerPriceColors(chargers) {
    const validPrice = price => typeof price === "number" && Number.isFinite(price) && price >= 0;
    const prices = chargers.map(charger => charger.pricePerKwh).filter(validPrice);
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    return chargers.map(charger => {
        if (!validPrice(charger.pricePerKwh)) return "#68716e";
        const fraction = maximum > minimum ? (charger.pricePerKwh - minimum) / (maximum - minimum) : 0;
        return `hsl(${120 * (1 - fraction)}, 75%, 30%)`;
    });
}

function renderChargerMap(chargers) {
    const container = chargerElements["charger-map"];
    const origin = chargerSearchDestination?.position ?? chargerVehicle?.parkingPosition;
    if (!NearbyChargers.validPosition(origin) || typeof L === "undefined") {
        container.hidden = true;
        if (typeof L === "undefined") chargerMessage("charger-warning", t("chargers_map_unavailable"), true);
        return;
    }
    container.hidden = false;
    container.setAttribute("aria-label", t(chargerSearchDestination ? "chargers_destination_map" : "chargers_map"));
    if (!chargerMap) {
        chargerMap = L.map(container, { scrollWheelZoom: false });
        chargerMap.on("resize", fitChargerMap);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(chargerMap);
        chargerMapMarkers = L.layerGroup().addTo(chargerMap);
    }
    chargerMapMarkers.clearLayers();
    const carPosition = [origin.latitude, origin.longitude];
    const carLabel = document.createElement("span");
    const originLabel = chargerSearchDestination ? chargerSearchDestination.address : t("map_title");
    carLabel.textContent = originLabel;
    L.marker(carPosition, {
        title: originLabel,
        icon: L.divIcon({ className: "charger-map-marker car", html: "&#9670;", iconSize: [32, 32], iconAnchor: [16, 16] })
    }).bindPopup(carLabel).addTo(chargerMapMarkers);
    const positions = [carPosition];
    const priceColors = chargerPriceColors(chargers);
    chargers.forEach((charger, index) => {
        const position = [charger.lat, charger.lng];
        positions.push(position);
        const popup = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = charger.name;
        const details = document.createElement("a");
        details.href = `#charger-result-${index + 1}`;
        details.textContent = t("chargers_map_details");
        popup.append(name, document.createElement("br"), details);
        const badge = document.createElement("span");
        badge.className = "charger-map-price";
        badge.textContent = String(index + 1);
        badge.style.backgroundColor = priceColors[index];
        L.marker(position, {
            title: charger.name,
            icon: L.divIcon({ className: "charger-map-marker", html: badge, iconSize: [32, 32], iconAnchor: [16, 16] })
        }).bindPopup(popup).addTo(chargerMapMarkers);
    });
    chargerMapPositions = positions;
    chargerMap.invalidateSize();
    fitChargerMap();
}

async function chargerGeocodeAddress(address) {
    if (chargerAddressCache.has(address)) return chargerAddressCache.get(address);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const locations = await chargerFetchJson(url);
    const position = { latitude: Number(locations[0]?.lat ?? Number.NaN), longitude: Number(locations[0]?.lon ?? Number.NaN) };
    if (!NearbyChargers.validPosition(position)) throw new Error(t("chargers_address_not_found"));
    chargerAddressCache.set(address, position);
    return position;
}

async function chargerHomePosition() {
    const address = loadSkodaSettings().homeAddress;
    if (!address) throw new Error(t("chargers_home_missing"));
    if (chargerHome?.address === address) return chargerHome.position;
    try {
        const saved = JSON.parse(chargerStorage?.getItem("myskodabb.chargerHome.v1"));
        if (saved?.address === address && NearbyChargers.validPosition(saved.position)) {
            chargerHome = saved;
            return saved.position;
        }
    } catch {}
    const position = await chargerGeocodeAddress(address);
    chargerHome = { address, position };
    try { chargerStorage?.setItem("myskodabb.chargerHome.v1", JSON.stringify(chargerHome)); } catch {}
    return position;
}

async function chargerDrivingDistances(car, candidates) {
    if (!candidates.length) return [];
    const coordinates = [car, ...candidates.map(charger => charger.position)].map(position => `${position.longitude},${position.latitude}`).join(";");
    const url = `https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=0&annotations=distance`;
    const result = await chargerFetchJson(url);
    if (result.code !== "Ok" || !Array.isArray(result.distances?.[0]) ||
        result.distances[0].length !== candidates.length + 1) throw new Error(t("route_failed"));
    return result.distances[0].slice(1).map(distance => typeof distance === "number" && Number.isFinite(distance) ? distance / 1000 : null);
}

function chargerResultMetrics(charger, money) {
    const values = [
        [chargerSearchDestination ? "chargers_destination_driving" : "chargers_driving", `${formatNumber(charger.drivingKm)} km`],
        ["chargers_energy_price", charger.pricePerKwh === null ? t("chargers_price_unknown") : `${money(charger.pricePerKwh)}/kWh`],
        ["chargers_availability", t(charger.openNow === true ? "chargers_open" : "chargers_unknown")]
    ];
    if (!chargerSearchDestination) values.splice(2, 0, ["chargers_remaining", `${formatNumber(chargerVehicle.electricRangeKm - charger.drivingKm)} km`]);
    return values;
}

function renderChargerResults(chargers) {
    const list = chargerElements["charger-list"];
    list.replaceChildren();
    const money = value => new Intl.NumberFormat(getLocale(), { style: "currency", currency: chargerCatalog.currency, maximumFractionDigits: 1 }).format(value);
    for (const charger of chargers) {
        const article = document.createElement("article");
        article.id = `charger-result-${list.children.length + 1}`;
        article.className = `charger-item${charger.towardHome ? " homeward" : ""}`;
        const identity = document.createElement("div");
        const heading = document.createElement("h3");
        heading.textContent = charger.name;
        const operator = document.createElement("p");
        operator.textContent = [charger.operatorName, charger.county].filter(Boolean).join(" \u00b7 ");
        const tags = document.createElement("p");
        tags.className = "charger-tags";
        tags.textContent = [charger.towardHome ? t("chargers_homeward") : null,
            t(charger.acceptsBankCard ? "chargers_card_yes" : "chargers_card_no")].filter(Boolean).join(" \u00b7 ");
        const connectors = document.createElement("p");
        connectors.textContent = [...new Set((charger.connectors || []).map(connector => {
            const power = connector.powerKw ? ` ${formatNumber(connector.powerKw)} kW` : "";
            return `${connector.type}${power}`;
        }))].join(", ");
        identity.append(heading, operator, tags, connectors);
        const metrics = document.createElement("dl");
        metrics.className = "charger-metrics";
        for (const [label, value] of chargerResultMetrics(charger, money)) {
            const group = document.createElement("div");
            const term = document.createElement("dt");
            term.textContent = t(label);
            const description = document.createElement("dd");
            description.textContent = value;
            group.append(term, description);
            metrics.append(group);
        }
        const fees = document.createElement("p");
        fees.className = "charger-fees";
        fees.textContent = [
            ["chargers_start_fee", charger.extraFees?.startFee], ["chargers_card_hold", charger.extraFees?.startBlock],
            ["chargers_idle_fee", charger.extraFees?.idle], ["chargers_parking_fee", charger.extraFees?.parking]
        ].filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0)
            .map(([key, value]) => `${t(key)}: ${money(value)}`).join(" \u00b7 ") || t("chargers_fees_unknown");
        const links = document.createElement("div");
        links.className = "link-row";
        const origin = NearbyChargers.validPosition(chargerVehicle?.parkingPosition)
            ? chargerVehicle.parkingPosition : chargerSearchDestination.position;
        const directions = document.createElement("a");
        directions.href = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${charger.lat},${charger.lng}&travelmode=driving`;
        directions.textContent = t("chargers_directions");
        directions.target = "_blank";
        directions.rel = "noopener noreferrer";
        const appleDirections = document.createElement("a");
        appleDirections.href = `https://maps.apple.com/?saddr=${origin.latitude},${origin.longitude}&daddr=${charger.lat},${charger.lng}&dirflg=d`;
        appleDirections.textContent = t("chargers_directions_apple");
        appleDirections.target = "_blank";
        appleDirections.rel = "noopener noreferrer";
        const details = document.createElement("a");
        details.href = `https://elmob.hu/otpr?charger=${encodeURIComponent(charger.id)}`;
        details.textContent = t("chargers_details");
        details.target = "_blank";
        details.rel = "noopener noreferrer";
        links.append(directions, appleDirections, details);
        article.append(identity, metrics, fees, links);
        list.append(article);
    }
    renderChargerMap(chargers);
}

async function chargerSearchOrigin() {
    const address = chargerElements["charger-address"].value.trim();
    if (address) {
        chargerMessage("charger-search-status", t("chargers_geocoding"));
        try { chargerSearchDestination = { address, position: await chargerGeocodeAddress(address) }; }
        catch { throw new Error(t("chargers_address_failed")); }
    }
    const origin = chargerSearchDestination?.position ?? chargerVehicle?.parkingPosition;
    if (!NearbyChargers.validPosition(origin)) throw new Error(t("parking_position_missing"));
    const range = chargerVehicle?.electricRangeKm;
    if (!chargerSearchDestination && !(typeof range === "number" && Number.isFinite(range) && range > 0)) {
        throw new Error(t("consumption_missing_ev"));
    }
    return origin;
}

async function findNearbyChargers() {
    chargerElements["charger-list"].replaceChildren();
    chargerSearchDestination = null;
    renderChargerMap([]);
    if (!chargerCatalog) return;
    let origin;
    try { origin = await chargerSearchOrigin(); }
    catch (error) {
        chargerMessage("charger-search-status", error.message, true);
        return;
    }
    chargerElements["charger-results-heading"].textContent = t(chargerSearchDestination ? "chargers_destination_results" : "chargers_results");
    chargerElements["charger-method"].textContent = t(chargerSearchDestination ? "chargers_destination_method" : "chargers_method");
    renderChargerMap([]);
    let hybridLimit = null;
    let hybridStatus = "";
    if (chargerElements["charger-hybrid-only"].checked) {
        hybridLimit = NearbyChargers.hybridPriceLimit(chargerVehicle, loadSkodaSettings(), chargerCatalog);
        if (hybridLimit === null) {
            chargerMessage("charger-search-status", t("chargers_hybrid_unavailable"), true);
            return;
        }
        const price = new Intl.NumberFormat(getLocale(), { style: "currency", currency: chargerCatalog.currency, maximumFractionDigits: 2 }).format(hybridLimit);
        hybridStatus = ` ${t("chargers_hybrid_limit", { price })}`;
    }
    chargerMessage("charger-search-status", t("chargers_routing"));
    let home = null;
    let homeWarning = "";
    try { home = await chargerHomePosition(); }
    catch (error) { homeWarning = ` ${t("chargers_home_unavailable", { reason: error.message })}`; }
    const radius = Number(chargerElements["charger-radius"].value);
    const nearby = NearbyChargers.candidates(chargerCatalog, origin, home, chargerSearchDestination ? radius : chargerVehicle.electricRangeKm,
        radius, chargerSearchDestination ? 0 : Number(chargerElements["charger-reserve"].value), chargerElements["charger-connector"].value)
        .filter(charger => !chargerElements["charger-card-only"].checked || charger.acceptsBankCard)
        .filter(charger => hybridLimit === null || typeof charger.pricePerKwh === "number" && Number.isFinite(charger.pricePerKwh) &&
            charger.pricePerKwh >= 0 && charger.pricePerKwh <= hybridLimit);
    const selected = NearbyChargers.shortlist(nearby).map(charger => chargerSearchDestination ? { ...charger, budgetKm: Infinity } : charger);
    try {
        const distances = await chargerDrivingDistances(origin, selected);
        const ranked = NearbyChargers.rankReachable(selected, distances);
        renderChargerResults(ranked);
        const resultKeys = chargerSearchDestination ? ["chargers_destination_none", "chargers_destination_found"] : ["chargers_none", "chargers_found"];
        chargerMessage("charger-search-status", t(resultKeys[Number(ranked.length > 0)], {
            address: chargerSearchDestination?.address,
            count: ranked.length, checked: selected.length, total: nearby.length
        }) + hybridStatus + homeWarning);
    } catch {
        chargerMessage("charger-search-status", t("chargers_routing_failed") + homeWarning, true);
    }
}

async function chargerAction(action) {
    if (chargerBusy) return;
    chargerBusy = true;
    const controls = [chargerElements["refresh-car"], chargerElements["refresh-catalog"],
        ...chargerElements["charger-filters"].elements];
    controls.forEach(control => { control.disabled = true; });
    document.querySelector(".charger-results").setAttribute("aria-busy", "true");
    try { await action(); }
    catch (error) { chargerMessage("charger-warning", error.message, true); }
    finally {
        chargerBusy = false;
        controls.forEach(control => { control.disabled = false; });
        document.querySelector(".charger-results").setAttribute("aria-busy", "false");
    }
}

chargerElements["charger-filters"].addEventListener("submit", event => {
    event.preventDefault();
    void chargerAction(findNearbyChargers);
});
chargerElements["charger-hybrid-only"].addEventListener("change", () => chargerAction(findNearbyChargers));
chargerElements["refresh-car"].addEventListener("click", () => chargerAction(async () => {
    await loadChargerVehicle(true);
    await findNearbyChargers();
}));
chargerElements["refresh-catalog"].addEventListener("click", openChargerRefreshDialog);
chargerElements["charger-refresh-cancel"].addEventListener("click", () => chargerElements["charger-refresh-dialog"].close());
chargerElements["charger-refresh-form"].addEventListener("submit", event => {
    event.preventDefault();
    const selected = id => [...chargerElements[id].querySelectorAll("input:checked")].map(input => input.value);
    const preferences = { chargerTypes: selected("charger-types"), chargerCounties: selected("charger-counties") };
    chargerElements["charger-refresh-dialog"].close();
    void chargerAction(async () => {
        chargerMessage("charger-warning", "");
        await loadChargerCatalog(true, preferences);
        await findNearbyChargers();
    });
});
document.addEventListener("DOMContentLoaded", () => chargerAction(async () => {
    await loadChargerVehicle();
    const cached = await readChargerCache();
    if (cached) {
        await setChargerCatalog(cached.catalog, cached.fetchedAt, "source_cache", !cached.catalog.compact);
        await findNearbyChargers();
    } else {
        openChargerRefreshDialog();
    }
}));