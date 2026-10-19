const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function app(settings = {}, random = Math.random) {
    const storage = new Map([["skoda-utility-settings", JSON.stringify(settings)]]);
    const requests = [];
    const context = vm.createContext({
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key)
        },
        Math: Object.assign(Object.create(Math), { random }),
        URL,
        document: { addEventListener() {} },
        fetch: async (...args) => {
            requests.push(args);
            return { ok: true, json: async () => ({ vehicle: { name: "Live vehicle" } }), headers: { get: () => null } };
        }
    });
    for (const file of ["skodaApi.js", "i18n.js"]) {
        vm.runInContext(fs.readFileSync(require.resolve(`./${file}`), "utf8"), context);
    }
    return { context, storage, requests };
}

test("missing either or both credentials enables random, usable demo data without network requests", async () => {
    for (const settings of [{}, { apiKey: "key" }, { vin: "TMBJJ7NE0J0123456" }]) {
        const { context, requests } = app(settings);
        const result = await context.fetchVehicle({ cachedOnly: true });
        const summary = context.summarizeVehicle(result.data);
        assert.equal(result.demo, true);
        assert.equal(summary.vin, "DEMO");
        assert.ok(summary.stateOfCharge >= 20 && summary.stateOfCharge <= 90);
        assert.ok(summary.electricRangeKm > 0);
        assert.ok(summary.fuelLevelPercent >= 25 && summary.fuelLevelPercent <= 95);
        assert.ok(summary.fuelRangeKm > 0);
        assert.ok(summary.parkingPosition);
        assert.equal((await context.fetchBatteryPercentage()).stateOfCharge, summary.stateOfCharge);
        assert.equal(requests.length, 0);
    }
});

test("demo data is shared through its own cache and refresh generates new readings", async () => {
    let random = 0;
    const { context, storage } = app({}, () => random);
    storage.set("skoda-utility-vehicle-cache", "live cache sentinel");
    const first = await context.fetchVehicle();
    random = 0.9;
    const cached = await context.fetchVehicle();
    assert.equal(cached.fromCache, true);
    assert.deepEqual(cached.data, first.data);
    const refreshed = await context.fetchVehicle({ forceRefresh: true });
    assert.equal(refreshed.fromCache, false);
    assert.notEqual(refreshed.data.vehicle.charging.status.battery.stateOfChargeInPercent,
        first.data.vehicle.charging.status.battery.stateOfChargeInPercent);
    assert.equal(storage.get("skoda-utility-vehicle-cache"), "live cache sentinel");
});

test("demo controls persist simulated state and retain input validation", async () => {
    const { context, requests } = app();
    assert.equal(await context.setChargingLimit(90), 90);
    assert.equal(context.summarizeVehicle((await context.fetchVehicle()).data).targetSoc, 90);
    await context.setAirConditioning("start", { targetTemperature: { value: 22 }, airConditioningWithoutExternalPower: true });
    let result = await context.fetchVehicle();
    assert.equal(result.data.vehicle.airConditioning.state, "ON");
    assert.equal(result.data.vehicle.airConditioning.targetTemperature.value, 22);
    await context.setAirConditioning("stop");
    result = await context.fetchVehicle();
    assert.equal(result.data.vehicle.airConditioning.state, "OFF");
    await assert.rejects(context.setChargingLimit(101));
    await assert.rejects(context.setAirConditioning("invalid"));
    await assert.rejects(context.setAirConditioning("start", { targetTemperature: { value: "invalid" } }));
    assert.equal(requests.length, 0);
});

test("complete credentials use live requests even when demo data exists", async () => {
    const { context, requests } = app();
    await context.fetchVehicle();
    context.saveSkodaSettings({ apiKey: "key", vin: "TMBJJ7NE0J0123456" });
    const result = await context.fetchVehicle();
    assert.equal(result.demo, undefined);
    assert.equal(result.data.vehicle.name, "Live vehicle");
    assert.equal(requests.length, 1);
    context.saveSkodaSettings({ apiKey: "key", vin: "invalid" });
    await assert.rejects(context.fetchVehicle());
    assert.equal(requests.length, 1);
});

test("missing-credentials warning and demo notice follow the selected language", () => {
    const { context } = app({ language: "en" });
    assert.equal(context.t("credentials_missing"), "The API key or VIN is missing. Enter them on the Settings page.");
    assert.match(context.t("demo_notice"), /Demo mode/);
    context.saveSkodaSettings({ language: "hu" });
    assert.match(context.t("credentials_missing"), /Hiányzik az API kulcs/);
    assert.match(context.t("demo_notice"), /Demó mód/);
});