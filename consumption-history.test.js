const { test } = require("node:test");
const assert = require("node:assert/strict");
const { estimateConsumption } = require("./consumption-history.js");
const settings = { evKwhPer100Km: 18, fuelLitresPer100Km: 6 };

test("estimates electric and fuel consumption from separate operating modes", () => {
    const trips = [
        { distance: 10, electric: 20, fuel: 0 },
        { distance: 10, electric: 0.5, fuel: 5 },
        { distance: 10, electric: 10, fuel: 3 }
    ];
    const result = estimateConsumption(trips, 10, settings);
    assert.equal(result.evKwhPer100Km, 20);
    assert.equal(result.fuelLitresPer100Km, 5);
    assert.equal(result.source, "history");
    assert.equal(result.electric.count, 1);
    assert.equal(result.fuel.count, 1);
});

test("trip length changes estimates and selection is limited to the ten nearest trips", () => {
    const trips = Array.from({ length: 10 }, () => ({ distance: 5, electric: 30, fuel: 0 }))
        .concat(Array.from({ length: 10 }, () => ({ distance: 100, electric: 15, fuel: 0 })));
    const short = estimateConsumption(trips, 5, settings);
    const long = estimateConsumption(trips, 100, settings);
    assert.equal(short.evKwhPer100Km, 30);
    assert.equal(long.evKwhPer100Km, 15);
    assert.equal(short.electric.count, 10);
    assert.equal(long.electric.minDistance, 100);
});

test("similarity weighting reduces the influence of distant trips", () => {
    const trips = [{ distance: 10, electric: 30, fuel: 0 }, { distance: 100, electric: 10, fuel: 0 }];
    assert.ok(estimateConsumption(trips, 10, settings).evKwhPer100Km > estimateConsumption(trips, 100, settings).evKwhPer100Km);
});

test("missing, nonpositive and mixed-mode measurements fall back independently", () => {
    const trips = [{ distance: 0, electric: 20, fuel: 0 }, { distance: 10, electric: -1, fuel: 0 },
        { distance: 10, electric: 10, fuel: null }, { distance: 10, electric: null, fuel: 5 }];
    assert.equal(estimateConsumption(trips, 10, settings).source, "settings");
    const partial = estimateConsumption([{ distance: 10, electric: 25, fuel: 0 }], 10, settings);
    assert.equal(partial.evKwhPer100Km, 25);
    assert.equal(partial.fuelLitresPer100Km, 6);
    assert.equal(partial.fuel, null);
});

test("zero distance is finite, empty history falls back and invalid distances are rejected", () => {
    const result = estimateConsumption([{ distance: 1, electric: 20, fuel: 0 }], 0, settings);
    assert.ok(Number.isFinite(result.evKwhPer100Km));
    assert.equal(estimateConsumption([], 50, settings).source, "settings");
    assert.throws(() => estimateConsumption([], -1, settings), /distance/);
    assert.throws(() => estimateConsumption([], NaN, settings), /distance/);
});