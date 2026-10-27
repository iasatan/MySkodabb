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
        NearbyChargers: chargers, fetch, AbortSignal, Intl,
        SKODA_WORKER_BASE_URL: "https://proxy.test", getLocale: () => "en", t: key => key, Option: class {}
    });
    vm.runInContext(fs.readFileSync(require.resolve("./nearby-chargers.js"), "utf8"), context);
    return { context, storage };
}

test("the page downloads the HAR endpoint with GET and stores the fresh response in localStorage", async () => {
    const requests = [];
    const source = { ...catalog([station(1)]), version: "live-catalog" };
    const { context, storage } = downloadPage(async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: async () => url.endsWith("/delta")
            ? { full: true, staticVersion: source.version, changes: [] } : source };
    });
    await context.loadChargerCatalog();
    assert.equal(requests[0].url, chargers.CATALOG_URL);
    assert.equal(requests[0].options.method, "GET");
    assert.equal(requests[0].options.credentials, "omit");
    assert.equal(JSON.parse(storage.get(chargers.CACHE_KEY)).catalog.version, "live-catalog");
    assert.ok(requests.every(request => !request.url.endsWith(".har")));
});

test("failed live download tries the fixed proxy, never reads the HAR, and never saves archived data", async () => {
    const requests = [];
    const { context, storage } = downloadPage(async url => { requests.push(url); throw new Error("offline"); });
    await context.loadChargerCatalog();
    assert.deepEqual(requests, [chargers.CATALOG_URL, "https://proxy.test/chargers/map-catalog"]);
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
            assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://iasatan.github.io");
            assert.equal(requests.at(-1).url, `https://olcsontoltok.hu/api/chargers/map-catalog${suffix}`);
            assert.deepEqual(requests.at(-1).options.headers, { Accept: "application/json" });
        }
        assert.equal((await worker.fetch(new Request("https://proxy.test/chargers/other"))).status, 400);
        assert.equal((await worker.fetch(new Request("https://proxy.test/chargers/map-catalog", { method: "POST" }))).status, 400);
        assert.equal(requests.length, 2);
        globalThis.fetch = async () => { throw new Error("offline"); };
        assert.equal((await worker.fetch(new Request("https://proxy.test/chargers/map-catalog"))).status, 502);
    } finally { globalThis.fetch = originalFetch; }
});