const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const chargers = require("./nearby-chargers-core.js");

const car = { latitude: 47.5, longitude: 19 };
const home = { latitude: 47.5, longitude: 19.5 };
function station(id, lng = 19.05, extra = {}) {
    return { id, name: `Charger ${id}`, lat: 47.5, lng, usageType: "public", connectors: [], ...extra };
}
function catalog(items) {
    return { currency: "HUF", chargers: items };
}

function downloadPage(fetch) {
    const storage = new Map();
    const context = vm.createContext({
        document: {
            getElementById: () => ({ value: "", classList: { toggle() {} }, addEventListener() {}, replaceChildren() {}, add() {} }),
            addEventListener() {}
        },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        NearbyChargers: chargers, fetch, AbortSignal, Intl, URL,
        SKODA_WORKER_BASE_URL: "https://proxy.test", getLocale: () => "en", t: key => key, Option: class {}
    });
    vm.runInContext(fs.readFileSync(require.resolve("./nearby-chargers.js"), "utf8"), context);
    return { context, storage };
}

test("charger cards offer Google Maps and Apple Maps driving directions from the car", () => {
    const { context } = downloadPage();
    const element = () => ({
        children: [],
        append(...children) { this.children.push(...children); },
        replaceChildren() { this.children = []; }
    });
    const list = element();
    context.document.createElement = element;
    context.list = list;
    context.car = car;
    context.charger = station(1, 19.05, { drivingKm: 5, pricePerKwh: null });
    context.formatNumber = String;
    vm.runInContext(`
        chargerElements["charger-list"] = list;
        chargerCatalog = { currency: "HUF" };
        chargerVehicle = { parkingPosition: car, electricRangeKm: 100 };
        renderChargerResults([charger]);
    `, context);
    const links = list.children[0].children[3].children;
    assert.equal(links.length, 3);
    const [google, apple, details] = links;
    const googleUrl = new URL(google.href);
    assert.equal(googleUrl.origin, "https://www.google.com");
    assert.equal(googleUrl.searchParams.get("origin"), "47.5,19");
    assert.equal(googleUrl.searchParams.get("destination"), "47.5,19.05");
    assert.equal(googleUrl.searchParams.get("travelmode"), "driving");
    const appleUrl = new URL(apple.href);
    assert.equal(appleUrl.origin, "https://maps.apple.com");
    assert.equal(appleUrl.searchParams.get("saddr"), "47.5,19");
    assert.equal(appleUrl.searchParams.get("daddr"), "47.5,19.05");
    assert.equal(appleUrl.searchParams.get("dirflg"), "d");
    assert.equal(google.textContent, "chargers_directions");
    assert.equal(apple.textContent, "chargers_directions_apple");
    for (const link of [google, apple]) {
        assert.equal(link.target, "_blank");
        assert.equal(link.rel, "noopener noreferrer");
    }
    assert.equal(details.href, "https://elmob.hu/otpr?charger=1");
    vm.runInContext(`
        chargerSearchDestination = { address: "Destination", position: { latitude: 47.5, longitude: 20 } };
        renderChargerResults([charger]);
    `, context);
    const destinationCard = list.children[0];
    assert.equal(destinationCard.children[1].children.length, 3);
    assert.equal(destinationCard.children[1].children[0].children[0].textContent, "chargers_destination_driving");
    assert.equal(new URL(destinationCard.children[3].children[0].href).searchParams.get("origin"), "47.5,19");
    vm.runInContext("chargerVehicle = null; renderChargerResults([charger])", context);
    assert.equal(new URL(list.children[0].children[3].children[0].href).searchParams.get("origin"), "47.5,20");
});

test("hybrid price limit uses car consumption when available and settings independently otherwise", () => {
    const settings = { batteryKwh: 20, fuelTankLitres: 40, evKwhPer100Km: 18, fuelLitresPer100Km: 6, fuelPrice: 600, currency: "HUF" };
    const vehicle = { stateOfCharge: 50, electricRangeKm: 50, fuelLevelPercent: 50, fuelRangeKm: 400 };
    const source = catalog([]);
    assert.equal(chargers.hybridPriceLimit(vehicle, settings, source), 135);
    assert.equal(chargers.hybridPriceLimit(null, settings, source), 180);
    assert.equal(chargers.hybridPriceLimit({ ...vehicle, stateOfCharge: 0 }, settings, source), 150);
    assert.equal(chargers.hybridPriceLimit({ ...vehicle, fuelRangeKm: null }, settings, source), 162);
    assert.equal(chargers.hybridPriceLimit({ ...vehicle, fuelLevelPercent: 101 }, settings, source), 162);
    assert.equal(chargers.hybridPriceLimit(vehicle, { ...settings, fuelPrice: 0 }, source), 0);
    assert.equal(chargers.hybridPriceLimit(vehicle, { ...settings, fuelPrice: null }, source), null);
    assert.equal(chargers.hybridPriceLimit(null, { ...settings, evKwhPer100Km: 0 }, source), null);
    const euro = { ...settings, fuelPrice: 1.5, currency: "EUR" };
    assert.equal(chargers.hybridPriceLimit(vehicle, euro, { ...source, ratesFromHuf: { EUR: 0.0025 } }), 135);
    assert.equal(chargers.hybridPriceLimit(vehicle, euro, source), null);
});

test("hybrid filter excludes expensive and unknown tariffs before routing, keeps equal prices and can be turned off", async () => {
    const { context } = downloadPage();
    const routed = [];
    const results = [];
    context.loadSkodaSettings = () => ({ evKwhPer100Km: 18, fuelLitresPer100Km: 6, fuelPrice: 600, currency: "HUF" });
    context.chargerHomePosition = async () => null;
    context.renderChargerMap = () => {};
    context.renderChargerResults = chargers => results.push(chargers);
    context.chargerDrivingDistances = async (position, candidates) => {
        routed.push(Array.from(candidates, charger => charger.id));
        return candidates.map(() => 5);
    };
    context.source = catalog([station(1, 19.05, { pricePerKwh: 0 }), station(2, 19.05, { pricePerKwh: 180 }),
        station(3, 19.05, { pricePerKwh: 181 }), station(4)]);
    context.car = car;
    vm.runInContext(`
        chargerCatalog = source;
        chargerVehicle = { parkingPosition: car, electricRangeKm: 100 };
        chargerElements["charger-radius"].value = 25;
        chargerElements["charger-reserve"].value = 10;
        chargerElements["charger-hybrid-only"].checked = true;
    `, context);
    await context.findNearbyChargers();
    assert.deepEqual(routed[0], [1, 2]);
    assert.deepEqual(Array.from(results[0], charger => charger.id), [1, 2]);
    vm.runInContext('chargerElements["charger-hybrid-only"].checked = false', context);
    await context.findNearbyChargers();
    assert.deepEqual(routed[1], [1, 2, 3, 4]);
    context.loadSkodaSettings = () => ({ evKwhPer100Km: 18, fuelLitresPer100Km: 6, fuelPrice: null, currency: "HUF" });
    vm.runInContext('chargerElements["charger-hybrid-only"].checked = true', context);
    await context.findNearbyChargers();
    assert.equal(routed.length, 2);
    assert.equal(vm.runInContext('chargerElements["charger-search-status"].textContent', context), "chargers_hybrid_unavailable");
});

test("address lookup uses geocoding, caches successful lookups and rejects missing coordinates", async () => {
    const requests = [];
    const { context } = downloadPage(async url => {
        requests.push(String(url));
        return { ok: true, json: async () => String(url).includes("Missing") ? [{ lat: null, lon: null }] : [{ lat: "47.5", lon: "20" }] };
    });
    const position = await context.chargerGeocodeAddress("Destination & town");
    assert.equal(position.latitude, 47.5);
    assert.equal(position.longitude, 20);
    const url = new URL(requests[0]);
    assert.equal(url.origin, "https://nominatim.openstreetmap.org");
    assert.equal(url.searchParams.get("q"), "Destination & town");
    assert.equal(url.searchParams.get("limit"), "1");
    await context.chargerGeocodeAddress("Destination & town");
    assert.equal(requests.length, 1);
    await assert.rejects(context.chargerGeocodeAddress("Missing"), /chargers_address_not_found/);
});

test("destination search uses the selected address, ignores current range and returns to the car when cleared", async () => {
    const { context } = downloadPage();
    const routed = [];
    const results = [];
    context.chargerGeocodeAddress = async address => {
        assert.equal(address, "Destination");
        return { latitude: 47.5, longitude: 20 };
    };
    context.chargerHomePosition = async () => null;
    context.renderChargerMap = () => {};
    context.renderChargerResults = chargers => results.push(Array.from(chargers, charger => charger.id));
    context.chargerDrivingDistances = async (position, candidates) => {
        routed.push({ longitude: position.longitude, ids: Array.from(candidates, charger => charger.id) });
        return candidates.map(() => 5);
    };
    context.source = catalog([station(1, 19.01), station(2, 20.05)]);
    context.car = car;
    vm.runInContext(`
        chargerCatalog = source;
        chargerVehicle = { parkingPosition: car, electricRangeKm: 1 };
        chargerElements["charger-address"].value = "  Destination  ";
        chargerElements["charger-radius"].value = 25;
        chargerElements["charger-reserve"].value = 10;
    `, context);
    await context.findNearbyChargers();
    assert.deepEqual(routed[0], { longitude: 20, ids: [2] });
    assert.deepEqual(results[0], [2]);
    assert.equal(vm.runInContext('chargerElements["charger-results-heading"].textContent', context), "chargers_destination_results");
    vm.runInContext('chargerElements["charger-address"].value = ""', context);
    await context.findNearbyChargers();
    assert.deepEqual(routed[1], { longitude: 19, ids: [1] });
    assert.deepEqual(results[1], []);
    assert.equal(vm.runInContext('chargerElements["charger-results-heading"].textContent', context), "chargers_results");
    context.chargerGeocodeAddress = async () => { throw new Error("offline"); };
    vm.runInContext('chargerElements["charger-address"].value = "Missing"', context);
    await context.findNearbyChargers();
    assert.equal(routed.length, 2);
    assert.equal(vm.runInContext('chargerElements["charger-search-status"].textContent', context), "chargers_address_failed");
});

test("charger prices use a relative green-yellow-red gradient and neutral unknown prices", () => {
    const { context } = downloadPage();
    const colors = prices => Array.from(context.chargerPriceColors(prices.map(pricePerKwh => ({ pricePerKwh }))));
    assert.deepEqual(colors([0, 100, 200, null]), [
        "hsl(120, 75%, 30%)", "hsl(60, 75%, 30%)", "hsl(0, 75%, 30%)", "#68716e"
    ]);
    assert.deepEqual(colors([200, 125, 100, 175]), [
        "hsl(0, 75%, 30%)", "hsl(90, 75%, 30%)", "hsl(120, 75%, 30%)", "hsl(30, 75%, 30%)"
    ]);
    assert.deepEqual(colors([50, 50]), ["hsl(120, 75%, 30%)", "hsl(120, 75%, 30%)"]);
    assert.deepEqual(colors([null, undefined, NaN, Infinity, -1, "100"]), Array(6).fill("#68716e"));
    assert.deepEqual(colors([]), []);
});

test("the map displays the car and current chargers, reframes results and clears old markers", () => {
    const { context } = downloadPage();
    const markers = [];
    const views = [];
    const handlers = {};
    let mapCreations = 0;
    const map = {
        on(event, handler) { handlers[event] = handler; },
        invalidateSize() {},
        fitBounds(positions, options) { views.push({ positions, options }); },
        setView(position, zoom) { views.push({ position, zoom }); }
    };
    const layer = { addTo() { return this; }, clearLayers() { markers.length = 0; } };
    context.L = {
        map() { mapCreations += 1; return map; },
        tileLayer() { return { addTo() {} }; },
        layerGroup() { return layer; },
        divIcon: options => options,
        marker(position, options) {
            const marker = {
                position, options,
                bindPopup(popup) { this.popup = popup; return this; },
                addTo() { markers.push(this); return this; }
            };
            return marker;
        }
    };
    const container = { setAttribute() {} };
    context.container = container;
    context.document.createElement = () => ({ style: {}, children: [], append(...children) { this.children.push(...children); } });
    context.car = car;
    context.stations = [station(1, 19.05, { pricePerKwh: 100 }), station(2, 19.1, { name: "<unsafe> & charger", pricePerKwh: 200 })];
    vm.runInContext(`
        chargerElements["charger-map"] = container;
        chargerVehicle = { parkingPosition: car };
        renderChargerMap(stations);
    `, context);
    assert.equal(container.hidden, false);
    assert.equal(markers.length, 3);
    assert.equal(markers[0].options.title, "map_title");
    assert.equal(markers[1].options.title, "Charger 1");
    assert.equal(markers[1].options.icon.html.textContent, "1");
    assert.equal(markers[1].options.icon.html.style.backgroundColor, "hsl(120, 75%, 30%)");
    assert.equal(markers[2].options.icon.html.style.backgroundColor, "hsl(0, 75%, 30%)");
    assert.equal(markers[2].popup.children[0].textContent, "<unsafe> & charger");
    assert.equal(markers[2].popup.children[2].href, "#charger-result-2");
    assert.equal(JSON.stringify(views[0].positions), JSON.stringify([[47.5, 19], [47.5, 19.05], [47.5, 19.1]]));
    assert.equal(views[0].options.maxZoom, 14);
    handlers.resize();
    assert.equal(JSON.stringify(views.at(-1)), JSON.stringify(views[0]));
    vm.runInContext("renderChargerMap([stations[1]])", context);
    assert.equal(markers.length, 2);
    assert.equal(markers[1].options.title, "<unsafe> & charger");
    assert.equal(markers[1].options.icon.html.style.backgroundColor, "hsl(120, 75%, 30%)");
    assert.equal(mapCreations, 1);
    vm.runInContext("renderChargerMap([])", context);
    assert.equal(markers.length, 1);
    assert.equal(views.at(-1).zoom, 13);
    vm.runInContext('chargerSearchDestination = { address: "Destination", position: { latitude: 47.5, longitude: 20 } }; renderChargerMap([])', context);
    assert.equal(markers[0].options.title, "Destination");
    assert.equal(JSON.stringify(views.at(-1).position), "[47.5,20]");
    vm.runInContext("chargerSearchDestination = null", context);
    vm.runInContext("chargerVehicle = null; renderChargerMap([])", context);
    assert.equal(container.hidden, true);
});

test("the page downloads catalogue and prices through the worker and stores the fresh response in localStorage", async () => {
    const requests = [];
    const source = { ...catalog([station(1)]), version: "live-catalog" };
    const { context, storage } = downloadPage(async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: async () => url.endsWith("/delta")
            ? { full: true, staticVersion: source.version, changes: [] } : source };
    });
    await context.loadChargerCatalog();
    assert.deepEqual(requests.map(request => request.url), [
        "https://proxy.test/chargers/map-catalog", "https://proxy.test/chargers/map-catalog/delta"
    ]);
    assert.equal(requests[0].options.method, "GET");
    assert.equal(requests[0].options.credentials, "omit");
    assert.equal(JSON.parse(storage.get(chargers.CACHE_KEY)).catalog.version, "live-catalog");
    assert.ok(requests.every(request => !request.url.endsWith(".har")));
});

test("failed live download never calls the CORS-blocked upstream or saves archived data", async () => {
    const requests = [];
    const { context, storage } = downloadPage(async url => { requests.push(url); throw new Error("offline"); });
    await context.loadChargerCatalog();
    assert.deepEqual(requests, ["https://proxy.test/chargers/map-catalog"]);
    assert.equal(storage.has(chargers.CACHE_KEY), false);
});

test("the saved HAR is a valid catalogue and does not invent energy tariffs", () => {
    const filename = fs.readdirSync(__dirname).find(name => name.endsWith(".har"));
    const har = JSON.parse(fs.readFileSync(require("node:path").join(__dirname, filename), "utf8"));
    const entry = har.log.entries.find(item => item.request.url === chargers.CATALOG_URL);
    const response = entry.response.content;
    const text = response.encoding === "base64" ? Buffer.from(response.text, "base64").toString("utf8") : response.text;
    const parsed = chargers.normalizeCatalog(JSON.parse(text));
    assert.ok(parsed.chargers.length > 2000);
    const nearby = chargers.candidates(parsed, car, home, 100, 25);
    assert.ok(nearby.length > 0);
    assert.ok(nearby.every(item => item.pricePerKwh === null));
});

test("haversine distance, homeward preference and range reserve", () => {
    assert.equal(chargers.distanceKm(car, car), 0);
    assert.ok(Math.abs(chargers.distanceKm(car, { latitude: 48.5, longitude: 19 }) - 111.195) < 0.01);
    assert.equal(chargers.distanceKm(car, { latitude: 91, longitude: 19 }), null);
    const nearby = chargers.candidates(catalog([station(1), station(2, 18.95), station(3, 19.9)]), car, home, 20, 50);
    assert.equal(nearby.length, 2);
    assert.equal(nearby.find(item => item.id === 1).towardHome, true);
    assert.equal(nearby.find(item => item.id === 2).towardHome, false);
    assert.equal(nearby[0].budgetKm, 18);
    assert.equal(chargers.candidates(catalog([station(1)]), car, home, null, 25).length, 0);
    assert.equal(chargers.candidates(catalog([station(1)]), car, home, 0, 25).length, 0);
});

test("only known driving distances within the battery budget are reachable", () => {
    const nearby = chargers.candidates(catalog([station(1), station(2), station(3), station(4)]), car, home, 10, 25);
    assert.deepEqual(chargers.rankReachable(nearby, [9, 9.1, null, NaN]).map(item => item.id), [1]);
});

test("chargers past home or behind the car are not between the car and home", () => {
    const nearby = chargers.candidates(catalog([station(1, 19.49), station(2, 19.51), station(3, 18.99)]), car, home, 100, 100);
    assert.equal(nearby.find(item => item.id === 1).towardHome, true);
    assert.equal(nearby.find(item => item.id === 2).towardHome, false);
    assert.equal(nearby.find(item => item.id === 3).towardHome, false);
});

test("ranking prefers homeward, cheaper, card-paying chargers, leaving unknown prices unknown", () => {
    const nearby = chargers.candidates(catalog([
        station(1, 18.95, { pricePerKwh: 0, acceptsBankCard: true }),
        station(2, 19.05, { pricePerKwh: 200 }),
        station(3, 19.05, { pricePerKwh: 100 }),
        station(4, 19.05, { pricePerKwh: 100, acceptsBankCard: true }),
        station(5, 19.05, { acceptsBankCard: true })
    ]), car, home, 50, 25);
    assert.deepEqual(chargers.rankReachable(nearby, nearby.map(() => 5)).map(item => item.id), [4, 3, 2, 5, 1]);
    assert.equal(chargers.rankReachable(nearby, nearby.map(() => 5), true).length, 3);
});

test("connector filtering uses the matching connector's payment support and excludes private stations", () => {
    const nearby = chargers.candidates(catalog([
        station(1, 19.05, { acceptsBankCard: true, connectors: [
            { type: "Type 2", acceptsBankCard: false }, { type: "CCS Type 2", acceptsBankCard: true }
        ] }), station(2, 19.05, { usageType: "private" }), station(3)
    ]), car, null, 20, 25, 10, "Type 2");
    assert.equal(nearby.length, 1);
    assert.equal(nearby[0].acceptsBankCard, false);
    assert.equal(nearby[0].towardHome, false);
});

test("cache round trip validates data and a failed replacement preserves the previous cache", () => {
    const data = new Map();
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    assert.equal(chargers.readCache(storage), null);
    chargers.saveCache(storage, catalog([station(1)]), 100);
    assert.equal(chargers.readCache(storage).fetchedAt, 100);
    assert.throws(() => chargers.saveCache(storage, {}));
    assert.equal(chargers.readCache(storage).catalog.chargers[0].id, 1);
    assert.throws(() => chargers.saveCache({ setItem() { throw new Error("quota"); } }, catalog([station(1)])));
    data.set(chargers.CACHE_KEY, "broken");
    assert.equal(chargers.readCache(storage), null);
});

test("shortlist is bounded, deduplicated and includes homeward candidates", () => {
    const nearby = Array.from({ length: 100 }, (_, index) => ({ id: index, towardHome: index >= 50 }));
    const selected = chargers.shortlist(nearby);
    assert.equal(selected.length, 60);
    assert.equal(new Set(selected.map(item => item.id)).size, 60);
    assert.ok(selected.some(item => item.towardHome));
});

test("full version-matched pricing merges connector tariffs and converts currencies before ranking", () => {
    const source = { ...catalog([station(1, 19.05, { connectors: [{ type: "Type 2" }, { type: "CCS Type 2" }] })]),
        version: "static-v1", ratesFromHuf: { EUR: 0.0025 } };
    const delta = { full: true, staticVersion: "static-v1", changes: [{ id: 1, status: "operational", openNow: true,
        connectors: [{ pricePerKwh: 0.5, priceCurrency: "EUR" }, { pricePerKwh: 300, priceCurrency: "HUF" }] }] };
    const merged = chargers.mergePricing(source, delta, 123);
    assert.equal(merged.pricingAt, 123);
    assert.equal(chargers.candidates(merged, car, home, 20, 25, 10, "Type 2")[0].pricePerKwh, 200);
    assert.equal(chargers.candidates(merged, car, home, 20, 25, 10, "CCS Type 2")[0].pricePerKwh, 300);
    assert.throws(() => chargers.mergePricing(source, { ...delta, full: false }));
    assert.throws(() => chargers.mergePricing(source, { ...delta, staticVersion: "other" }));
    assert.equal(source.chargers[0].connectors[0].pricePerKwh, undefined);
});

test("closed and broken chargers are excluded; unknown availability and free tariffs are preserved", () => {
    const source = catalog([station(1, 19.05, { status: "broken" }), station(2, 19.05, { openNow: false }),
        station(3, 19.05, { connectors: [{ type: "Type 2", pricePerKwh: 0 }] })]);
    const nearby = chargers.candidates(source, car, home, 20, 25);
    assert.equal(nearby.length, 1);
    assert.equal(nearby[0].pricePerKwh, 0);
});

test("worker proxies only the two fixed public catalogue routes, without API keys or forwarded query parameters", async () => {
    const source = fs.readFileSync(require.resolve("./proxy/worker.js"), "utf8");
    const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({ url, options });
        return new Response('{"chargers":[]}', { headers: { "Content-Type": "application/json" } });
    };
    try {
        for (const suffix of ["", "/delta"]) {
            const response = await worker.fetch(new Request(`https://proxy.test/chargers/map-catalog${suffix}?apiKey=secret&target=evil`));
            assert.equal(response.status, 200);
            assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
            assert.equal(requests.at(-1).url, `https://olcsontoltok.hu/api/chargers/map-catalog${suffix}`);
            assert.deepEqual(requests.at(-1).options.headers, { Accept: "application/json" });
            assert.equal(requests.at(-1).options.redirect, "manual");
        }
        const preflight = await worker.fetch(new Request("https://proxy.test/chargers/map-catalog", {
            method: "OPTIONS", headers: { Origin: "http://127.0.0.1:8097" }
        }));
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
        const privateResponse = await worker.fetch(new Request("https://proxy.test/api/v1/vehicles/TMBJJ7NE0J0123456"));
        assert.equal(privateResponse.headers.get("Access-Control-Allow-Origin"), "https://iasatan.github.io");
        const privatePreflight = await worker.fetch(new Request("https://proxy.test/api/v1/vehicles/TMBJJ7NE0J0123456", { method: "OPTIONS" }));
        assert.equal(privatePreflight.headers.get("Access-Control-Allow-Origin"), "https://iasatan.github.io");
        assert.equal((await worker.fetch(new Request("https://proxy.test/chargers/other"))).status, 400);
        assert.equal((await worker.fetch(new Request("https://proxy.test/chargers/map-catalog", { method: "POST" }))).status, 400);
        assert.equal(requests.length, 2);
        globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: "https://olcsontoltok.hu/" } });
        const redirected = await worker.fetch(new Request("https://proxy.test/chargers/map-catalog"));
        assert.equal(redirected.status, 502);
        assert.equal(redirected.headers.get("Location"), null);
        assert.equal(redirected.headers.get("Access-Control-Allow-Origin"), "*");
        globalThis.fetch = async () => { throw new Error("offline"); };
        const failed = await worker.fetch(new Request("https://proxy.test/chargers/map-catalog"));
        assert.equal(failed.status, 502);
        assert.equal(failed.headers.get("Access-Control-Allow-Origin"), "*");
    } finally { globalThis.fetch = originalFetch; }
});