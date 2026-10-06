const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Papa = require("./vendor/papaparse.min.js");
const { readTrips, consumptionByFactor } = require("./statistics-core.js");

function trip(values = {}) {
    return { date: new Date(2026, 9, 1, 10), day: "2026-10-01", distance: 10, minutes: 20,
        speed: 30, electric: 20, fuel: 0, cost: null, currency: "", ...values };
}

test("CSV speed uses the exported average, including zero and missing values", () => {
    const text = Papa.unparse({ fields: ["End of trip", "Mileage in km", "Travel time in minutes", "Average speed in km/h"],
        data: [["01.10.2026 10:00", 10, 20, 35], ["01.10.2026 11:00", 0, 5, 0], ["01.10.2026 12:00", 10, 20, ""], ["01.10.2026 13:00", 10, 20, -1]] });
    assert.deepEqual(readTrips(text, Papa).trips.map(value => value.speed), [null, null, 0, 35]);
});

test("distance groups use inclusive lower and exclusive upper bounds", () => {
    const groups = consumptionByFactor([0, 4, 5, 19, 20, 49, 50, 99, 100].map(distance => trip({ distance })), "distance");
    assert.deepEqual(groups.map(group => group.count), [2, 2, 2, 2, 1]);
    assert.equal(groups[0].electricAverage, 20);
});

test("speed groups keep missing speed separate and weight consumption by distance", () => {
    const groups = consumptionByFactor([trip({ distance: 5, speed: 20, electric: 40 }), trip({ distance: 15, speed: 39, electric: 20 }), trip({ speed: null })], "speed");
    assert.equal(groups[1].count, 2);
    assert.equal(groups[1].electricAverage, 25);
    assert.equal(groups.at(-1).lower, null);
    assert.equal(groups.at(-1).count, 1);
    assert.equal(groups[0].electricAverage, null);
});

test("duration and end-of-trip hour boundaries classify each trip exactly once", () => {
    const trips = [trip({ minutes: 10, date: new Date(2026, 9, 1, 6) }), trip({ minutes: 120, date: new Date(2026, 9, 1, 20) })];
    assert.deepEqual(consumptionByFactor(trips, "duration").map(group => group.count), [0, 1, 0, 0, 0, 1]);
    assert.deepEqual(consumptionByFactor(trips, "time").map(group => group.count), [0, 1, 0, 0, 1]);
});

test("fuel-use filters exclude unknown fuel rather than treating it as electric-only", () => {
    const trips = [trip(), trip({ fuel: 5 }), trip({ fuel: null })];
    assert.equal(consumptionByFactor(trips, "distance", "no-fuel")[1].count, 1);
    assert.equal(consumptionByFactor(trips, "distance", "with-fuel")[1].count, 1);
    assert.equal(consumptionByFactor(trips, "distance")[1].count, 3);
});

test("missing consumption and zero distance do not fabricate factor averages", () => {
    const groups = consumptionByFactor([trip({ distance: 0 }), trip({ electric: null, fuel: null })], "speed");
    assert.equal(groups[1].count, 2);
    assert.equal(groups[1].electricAverage, null);
    assert.equal(groups[1].fuelAverage, null);
    assert.equal(groups[1].electricDistance, 0);
});

test("all factor breakdowns preserve the sample trip count and total distance", () => {
    const file = fs.readdirSync(__dirname).find(name => /^tripStatistics_.*\.csv$/.test(name));
    if (!file) return;
    const { trips } = readTrips(fs.readFileSync(path.join(__dirname, file), "utf8"), Papa);
    for (const factor of ["distance", "speed", "duration", "time"]) {
        const groups = consumptionByFactor(trips, factor);
        assert.equal(groups.reduce((total, group) => total + group.count, 0), 331);
        assert.equal(groups.reduce((total, group) => total + group.distance, 0), 8076);
    }
});