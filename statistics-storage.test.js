const { test } = require("node:test");
const assert = require("node:assert/strict");
const Papa = require("./vendor/papaparse.min.js");
const { readTrips, mergeTrips, summarize, consumptionByFactor, serializeTrips, deserializeTrips } = require("./statistics-core.js");

function dataset() {
    return readTrips(Papa.unparse({
        fields: ["End of trip", "Mileage in km", "Travel time in minutes", "Average speed in km/h", "Average electric consumption in kWh/100km", "Average fuel consumption in l/100km", "Total cost", "Total cost currency"],
        data: [["01.10.2026 10:05", 10, 20, 30, -1, 0, 0, "HUF"], ["02.10.2026 21:15", 20, 30, "", "", "", "", ""]]
    }), Papa);
}

test("snapshot round-trip restores Dates, missing values, zero costs and negative consumption", () => {
    const parsed = dataset();
    parsed.skipped = 2;
    const saved = serializeTrips("trips.csv", parsed);
    const restored = deserializeTrips(saved);
    assert.equal(restored.name, "trips.csv");
    assert.equal(restored.skipped, 2);
    assert.deepEqual(restored.trips, parsed.trips);
    assert.deepEqual(summarize(restored.trips), summarize(parsed.trips));
    assert.deepEqual(consumptionByFactor(restored.trips, "time"), consumptionByFactor(parsed.trips, "time"));
});

test("adding trips removes duplicates across and within datasets without mutating inputs", () => {
    const current = dataset();
    const incoming = deserializeTrips(serializeTrips("overlap.csv", current));
    const newer = { ...incoming.trips[0], date: new Date(2026, 9, 3, 12), day: "2026-10-03" };
    current.trips.push(current.trips[0]);
    incoming.trips.push(newer, newer);
    const merged = mergeTrips(current.trips, incoming.trips);
    assert.equal(merged.duplicates, 4);
    assert.deepEqual(merged.trips, [newer, ...dataset().trips]);
    assert.equal(current.trips.length, 3);
    assert.equal(incoming.trips.length, 4);
    const restored = deserializeTrips(serializeTrips("merged.csv", { ...merged, skipped: 2 }));
    assert.deepEqual(restored.trips, merged.trips);
    assert.equal(restored.skipped, 2);
    assert.equal(mergeTrips(merged.trips, incoming.trips).trips.length, 3);
});

test("adding trips preserves distinct records even when trip times overlap", () => {
    const original = dataset().trips[0];
    const variants = [
        { ...original, distance: original.distance + 1 },
        { ...original, minutes: original.minutes + 1 },
        { ...original, speed: 0 },
        { ...original, electric: 0 },
        { ...original, fuel: 0 },
        { ...original, cost: 0, currency: "EUR" }
    ];
    const merged = mergeTrips([original], variants);
    assert.equal(merged.trips.length, 7);
    assert.equal(merged.duplicates, 0);
});

test("snapshots reject corrupt JSON, unsupported versions and empty datasets", () => {
    for (const text of ["broken", "null", '{"version":2}', '{"version":1,"name":"trips.csv","skipped":0,"trips":[]}']) {
        assert.throws(() => deserializeTrips(text));
    }
});

test("snapshots reject invalid dates, numbers, metadata and trip shapes", () => {
    const original = JSON.parse(serializeTrips("trips.csv", dataset()));
    for (const [column, value] of [[0, "31.02.2026 10:00"], [1, -1], [2, null], [3, "30"], [4, "bad"], [5, -1], [6, -1], [7, null]]) {
        const snapshot = structuredClone(original);
        snapshot.trips[0][column] = value;
        assert.throws(() => deserializeTrips(JSON.stringify(snapshot)), /snapshot/);
    }
    const snapshot = structuredClone(original);
    snapshot.trips[0].pop();
    assert.throws(() => deserializeTrips(JSON.stringify(snapshot)), /snapshot/);
    original.skipped = -1;
    assert.throws(() => deserializeTrips(JSON.stringify(original)), /snapshot/);
});