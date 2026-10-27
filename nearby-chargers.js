const chargerElements = Object.fromEntries([
    "refresh-car", "refresh-catalog", "charger-vehicle-status", "charger-catalog-status", "charger-warning",
    "charger-filters", "charger-radius", "charger-reserve", "charger-connector", "charger-card-only", "find-chargers",
    "charger-map", "charger-search-status", "charger-list"
].map(id => [id, document.getElementById(id)]));
let chargerCatalog = null;
let chargerVehicle = null;
let chargerVehicleMeta = null;
let chargerHome = null;
let chargerBusy = false;
let chargerStorage = null;
try { chargerStorage = localStorage; } catch {}

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

function setChargerCatalog(catalog, fetchedAt, source, persist = true) {
    chargerCatalog = catalog;
    if (persist) {
        try { NearbyChargers.saveCache(chargerStorage, catalog, fetchedAt); }
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
}

async function loadChargerCatalog(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = NearbyChargers.readCache(chargerStorage);
        if (cached) {
            setChargerCatalog(cached.catalog, cached.fetchedAt, "source_cache", false);
            return;
        }
    }
    chargerMessage("charger-catalog-status", t("loading"));
    try {
        let catalog = NearbyChargers.normalizeCatalog(await chargerPublicData("map-catalog"));
        try {
            catalog = NearbyChargers.mergePricing(catalog, await chargerPublicData("map-catalog/delta"));
        } catch { chargerMessage("charger-warning", t("chargers_pricing_failed"), true); }
        setChargerCatalog(catalog, Date.now(), "source_fresh");
    } catch {
        if (chargerCatalog) {
            chargerMessage("charger-catalog-status", t("chargers_refresh_failed"), true);
            return;
        }
        chargerMessage("charger-catalog-status", t("chargers_live_failed"), true);
    }
}

async function loadChargerVehicle(forceRefresh = false) {
    try {
        const result = await fetchVehicle({ forceRefresh });
        chargerVehicle = summarizeVehicle(result.data);
        chargerVehicleMeta = result;
    } catch (error) {
        chargerVehicle = null;
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
    if (NearbyChargers.validPosition(vehicle.parkingPosition)) {
        const { latitude, longitude } = vehicle.parkingPosition;
        chargerElements["charger-map"].src = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - .025},${latitude - .012},${longitude + .025},${latitude + .012}&layer=mapnik&marker=${latitude},${longitude}`;
        chargerElements["charger-map"].title = t("map_title");
        chargerElements["charger-map"].hidden = false;
    } else chargerElements["charger-map"].hidden = true;
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
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const locations = await chargerFetchJson(url);
    const position = { latitude: Number(locations[0]?.lat), longitude: Number(locations[0]?.lon) };
    if (!NearbyChargers.validPosition(position)) throw new Error(t("home_address_not_found"));
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

function renderChargerResults(chargers) {
    const list = chargerElements["charger-list"];
    list.replaceChildren();
    const money = value => new Intl.NumberFormat(getLocale(), { style: "currency", currency: chargerCatalog.currency, maximumFractionDigits: 1 }).format(value);
    for (const charger of chargers) {
        const article = document.createElement("article");
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
        for (const [label, value] of [
            ["chargers_driving", `${formatNumber(charger.drivingKm)} km`],
            ["chargers_energy_price", charger.pricePerKwh === null ? t("chargers_price_unknown") : `${money(charger.pricePerKwh)}/kWh`],
            ["chargers_remaining", `${formatNumber(chargerVehicle.electricRangeKm - charger.drivingKm)} km`],
            ["chargers_availability", t(charger.openNow === true ? "chargers_open" : "chargers_unknown")]
        ]) {
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
        const origin = chargerVehicle.parkingPosition;
        const directions = document.createElement("a");
        directions.href = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${charger.lat},${charger.lng}&travelmode=driving`;
        directions.textContent = t("chargers_directions");
        directions.target = "_blank";
        directions.rel = "noopener noreferrer";
        const details = document.createElement("a");
        details.href = `https://elmob.hu/otpr?charger=${encodeURIComponent(charger.id)}`;
        details.textContent = t("chargers_details");
        details.target = "_blank";
        details.rel = "noopener noreferrer";
        links.append(directions, details);
        article.append(identity, metrics, fees, links);
        list.append(article);
    }
}

async function findNearbyChargers() {
    chargerElements["charger-list"].replaceChildren();
    if (!chargerCatalog || !chargerVehicle) return;
    if (!NearbyChargers.validPosition(chargerVehicle.parkingPosition)) {
        chargerMessage("charger-search-status", t("parking_position_missing"), true);
        return;
    }
    if (typeof chargerVehicle.electricRangeKm !== "number" || !Number.isFinite(chargerVehicle.electricRangeKm) || chargerVehicle.electricRangeKm <= 0) {
        chargerMessage("charger-search-status", t("consumption_missing_ev"), true);
        return;
    }
    chargerMessage("charger-search-status", t("chargers_routing"));
    let home = null;
    let homeWarning = "";
    try { home = await chargerHomePosition(); }
    catch (error) { homeWarning = ` ${t("chargers_home_unavailable", { reason: error.message })}`; }
    const nearby = NearbyChargers.candidates(chargerCatalog, chargerVehicle.parkingPosition, home, chargerVehicle.electricRangeKm,
        Number(chargerElements["charger-radius"].value), Number(chargerElements["charger-reserve"].value), chargerElements["charger-connector"].value)
        .filter(charger => !chargerElements["charger-card-only"].checked || charger.acceptsBankCard);
    const selected = NearbyChargers.shortlist(nearby);
    try {
        const distances = await chargerDrivingDistances(chargerVehicle.parkingPosition, selected);
        const ranked = NearbyChargers.rankReachable(selected, distances);
        renderChargerResults(ranked);
        chargerMessage("charger-search-status", t(ranked.length ? "chargers_found" : "chargers_none", {
            count: ranked.length, checked: selected.length, total: nearby.length
        }) + homeWarning);
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
chargerElements["refresh-car"].addEventListener("click", () => chargerAction(async () => {
    await loadChargerVehicle(true);
    await findNearbyChargers();
}));
chargerElements["refresh-catalog"].addEventListener("click", () => chargerAction(async () => {
    chargerMessage("charger-warning", "");
    await loadChargerCatalog(true);
    await findNearbyChargers();
}));
document.addEventListener("DOMContentLoaded", () => chargerAction(async () => {
    await Promise.all([loadChargerVehicle(), loadChargerCatalog()]);
    await findNearbyChargers();
}));