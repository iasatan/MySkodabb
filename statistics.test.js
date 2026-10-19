const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Papa = require("./vendor/papaparse.min.js");
const { readTrips, createDemoTrips, summarize, monthly, consumptionByFactor, serializeTrips, deserializeTrips } = require("./statistics-core.js");

const headers = ["End of trip", "Mileage in km", "Travel time in minutes", "Average electric consumption in kWh/100km", "Average fuel consumption in l/100km", "Total cost", "Total cost currency"];
const csv = rows => Papa.unparse({ fields: headers, data: rows });
const read = rows => readTrips(csv(rows), Papa);

test("demo trips populate recent monthly charts, consumption groups and costs", () => {
    const now = new Date(2026, 9, 19, 12);
    const dataset = createDemoTrips(now, () => 0.5);
    assert.equal(dataset.demo, true);
    assert.equal(dataset.trips.length, 180);
    assert.equal(dataset.skipped, 0);
    for (const [index, trip] of dataset.trips.entries()) {
        assert.ok(trip.date < now);
        assert.ok(trip.distance > 0 && trip.minutes > 0 && trip.speed > 0);
        assert.ok(trip.electric > 0 && trip.fuel >= 0 && trip.cost > 0);
        if (index) assert.ok(trip.date < dataset.trips[index - 1].date);
    }
    const summary = summarize(dataset.trips);
    assert.ok(summary.electricOnlyDistance > 0 && summary.electricOnlyDistance < summary.distance);
    assert.equal(summary.costs.EUR.count, 180);
    assert.ok(monthly(dataset.trips).length >= 6);
    for (const factor of ["distance", "speed", "duration", "time"]) {
        assert.ok(consumptionByFactor(dataset.trips, factor).filter(group => group.count > 0).length >= 3);
    }
    const restored = deserializeTrips(serializeTrips("demo", dataset));
    assert.deepEqual(restored.trips, dataset.trips);
    assert.notEqual(createDemoTrips(now, () => 0).trips[0].distance,
        createDemoTrips(now, () => 0.9).trips[0].distance);
});

test("averages are distance-weighted and zero-distance trips still count", () => {
    const { trips } = read([
        ["01.10.2026 10:00", 10, 30, 30, 0, 100, "HUF"],
        ["02.10.2026 10:00", 90, 90, 10, 5, 200, "HUF"],
        ["02.10.2026 11:00", 0, 5, 99, "", "", ""]
    ]);
    const result = summarize(trips);
    assert.equal(result.count, 3);
    assert.equal(result.electricAverage, 12);
    assert.equal(result.fuelAverage, 4.5);
    assert.equal(result.distance, 100);
    assert.equal(result.minutes, 125);
    assert.equal(result.activeDays.size, 2);
    assert.equal(result.missingCosts, 1);
    assert.equal(result.electricOnlyDistance, 10);
});

test("missing measurements are not treated as zero and costs keep currencies separate", () => {
    const { trips } = read([
        ["01.10.2026 10:00", 10, 30, "", "", "", ""],
        ["02.10.2026 10:00", 90, 90, 10, 0, 0, "HUF"],
        ["03.10.2026 10:00", 20, 30, -1, 5, 5, "EUR"]
    ]);
    const result = summarize(trips);
    assert.equal(result.electricDistance, 110);
    assert.equal(result.electricEnergy, 8.8);
    assert.equal(result.costs.HUF.total, 0);
    assert.equal(result.costs.HUF.distance, 90);
    assert.equal(result.costs.EUR.total, 5);
    assert.equal(result.missingCosts, 1);
    assert.equal(result.knownFuelDistance, 110);
});

test("invalid dates and negative distances are skipped, not silently normalized", () => {
    const result = read([
        ["31.02.2026 10:00", 10, 30],
        ["01.10.2026 25:00", 10, 30],
        ["01.10.2026 10:00", -1, 30],
        ["01.10.2026 10:00", 1, -30],
        ["01.10.2026 10:00", 10, 30]
    ]);
    assert.equal(result.skipped, 4);
    assert.equal(result.trips.length, 1);
});

test("BOM, CRLF, decimal commas and semicolon delimiters are supported", () => {
    const text = "\uFEFF" + Papa.unparse({ fields: headers, data: [["01.10.2026 10:00", "10,5", 30, "20,5", 0, 0, "HUF"]] }, { delimiter: ";", newline: "\r\n" });
    const result = readTrips(text, Papa);
    assert.equal(result.trips[0].distance, 10.5);
    assert.equal(result.trips[0].electric, 20.5);
});

test("missing headers, empty exports and malformed quoted fields fail clearly", () => {
    assert.throws(() => readTrips("wrong,columns\n1,2", Papa), /columns/);
    assert.throws(() => read([]), /empty/);
    assert.throws(() => readTrips(headers.join(",") + '\n"unfinished', Papa), /malformed/);
});

test("months sort chronologically and empty summaries avoid invalid averages", () => {
    const { trips } = read([["01.10.2026 10:00", 20, 30], ["01.09.2026 10:00", 10, 30]]);
    assert.deepEqual(monthly(trips).map(value => value.month), ["2026-09", "2026-10"]);
    const result = summarize([]);
    assert.equal(result.electricAverage, null);
    assert.equal(result.fuelAverage, null);
    assert.equal(result.averageSpeed, null);
});

test("sample export imports completely with known totals", () => {
    const file = fs.readdirSync(__dirname).find(name => /^tripStatistics_.*\.csv$/.test(name));
    if (!file) return;
    const result = readTrips(fs.readFileSync(path.join(__dirname, file), "utf8"), Papa);
    const summary = summarize(result.trips);
    assert.equal(result.skipped, 0);
    assert.equal(summary.count, 331);
    assert.equal(summary.distance, 8076);
    assert.equal(summary.minutes, 11685);
    assert.ok(Math.abs(summary.costs.HUF.total - 197465.89) < 0.001);
});