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

test("fuel price settings round trip without treating missing or invalid values as free fuel", () => {
    const { context } = app();
    assert.equal(context.loadSkodaSettings().fuelPrice, null);
    for (const [fuelPrice, expected] of [["710.5", 710.5], [0, 0], ["", null], [null, null], [-1, null], ["invalid", null]]) {
        context.saveSkodaSettings({ fuelPrice, currency: "EUR" });
        assert.equal(context.loadSkodaSettings().fuelPrice, expected);
        assert.equal(context.loadSkodaSettings().currency, "EUR");
    }
});

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

test("live consumption readings persist once per cached response with independent measurements", async () => {
    const { context, storage } = app({ apiKey: "key", vin: "TMBJJ7NE0J0123456" });
    const fetchedAt = Date.now();
    storage.set("skoda-utility-vehicle-cache", JSON.stringify({ vin: "TMBJJ7NE0J0123456", fetchedAt,
        data: { vehicle: { charging: { status: { battery: { stateOfChargeInPercent: 50, remainingCruisingRangeInKm: 80 } } },
            fuelStatus: { primaryEngineRange: { currentFuelLevelInPercent: 40, remainingRangeInKm: 300 } } } } }));
    await context.fetchVehicle();
    await context.fetchVehicle();
    let readings = context.loadConsumptionReadings();
    assert.equal(readings.length, 1);
    assert.equal(readings[0].electric, 25.7 * 50 / 80);
    assert.equal(readings[0].fuel, 6);
    assert.equal(readings[0].fetchedAt, fetchedAt);
    const cached = JSON.parse(storage.get("skoda-utility-vehicle-cache"));
    cached.fetchedAt++;
    delete cached.data.vehicle.fuelStatus;
    storage.set("skoda-utility-vehicle-cache", JSON.stringify(cached));
    await context.fetchVehicle();
    readings = context.loadConsumptionReadings();
    assert.equal(readings.length, 2);
    assert.equal(readings[0].fuel, null);
    assert.equal(readings[0].electric, 25.7 * 50 / 80);
});

test("demo data never enters consumption history and corrupt history is preserved", async () => {
    const { context, storage } = app();
    await context.fetchVehicle();
    assert.equal(storage.has("myskodabb.consumption.v1"), false);
    storage.set("myskodabb.consumption.v1", "broken");
    assert.throws(() => context.loadConsumptionReadings());
    context.saveSkodaSettings({ apiKey: "key", vin: "TMBJJ7NE0J0123456" });
    storage.set("skoda-utility-vehicle-cache", JSON.stringify({ vin: "TMBJJ7NE0J0123456", fetchedAt: Date.now(),
        data: { vehicle: { charging: { status: { battery: { stateOfChargeInPercent: 50, remainingCruisingRangeInKm: 80 } } } } } }));
    const result = await context.fetchVehicle();
    assert.equal(result.consumptionStorageError, "consumption_save_failed");
    assert.equal(storage.get("myskodabb.consumption.v1"), "broken");
});

test("storage-full failures report a warning without losing cached vehicle data or previous readings", async () => {
    const { context, storage } = app({ apiKey: "key", vin: "TMBJJ7NE0J0123456" });
    const previous = JSON.stringify({ version: 1, readings: [] });
    storage.set("myskodabb.consumption.v1", previous);
    storage.set("skoda-utility-vehicle-cache", JSON.stringify({ vin: "TMBJJ7NE0J0123456", fetchedAt: Date.now(),
        data: { vehicle: { charging: { status: { battery: { stateOfChargeInPercent: 50, remainingCruisingRangeInKm: 80 } } } } } }));
    context.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    const result = await context.fetchVehicle();
    assert.equal(result.fromCache, true);
    assert.equal(context.summarizeVehicle(result.data).stateOfCharge, 50);
    assert.equal(result.consumptionStorageError, "consumption_save_failed");
    assert.equal(storage.get("myskodabb.consumption.v1"), previous);
});

test("consumption history rejects malformed schemas and does not invent readings for missing ranges", async () => {
    const { context, storage } = app({ apiKey: "key", vin: "TMBJJ7NE0J0123456" });
    for (const value of [{ version: 2, readings: [] }, { version: 1, readings: [null] },
        { version: 1, readings: [{ vin: "invalid", fetchedAt: Date.now() }] }]) {
        storage.set("myskodabb.consumption.v1", JSON.stringify(value));
        assert.throws(() => context.loadConsumptionReadings());
    }
    storage.delete("myskodabb.consumption.v1");
    await context.fetchVehicle();
    assert.equal(context.loadConsumptionReadings().length, 0);
    assert.equal(storage.has("myskodabb.consumption.v1"), false);
});