(function (root) {
    "use strict";

    const columns = {
        date: "End of trip",
        distance: "Mileage in km",
        minutes: "Travel time in minutes",
        speed: "Average speed in km/h",
        electric: "Average electric consumption in kWh/100km",
        fuel: "Average fuel consumption in l/100km",
        cost: "Total cost",
        currency: "Total cost currency"
    };

    function numeric(value) {
        if (value == null || String(value).trim() === "") return null;
        const result = Number(String(value).trim().replace(",", "."));
        return Number.isFinite(result) ? result : null;
    }

    function tripDate(value) {
        const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(String(value).trim());
        if (!match) return null;
        const [, day, month, year, hour, minute] = match.map(Number);
        const date = new Date(year, month - 1, day, hour, minute);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
            date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
        return date;
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function readTrips(text, parser) {
        const parsed = parser.parse(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: header => header.trim() });
        const required = [columns.date, columns.distance, columns.minutes];
        if (!required.every(column => parsed.meta.fields?.includes(column))) {
            throw new Error("columns");
        }
        if (parsed.errors.some(error => error.code !== "TooFewFields")) throw new Error("malformed");
        let skipped = 0;
        const trips = [];
        for (const row of parsed.data) {
            const date = tripDate(row[columns.date]);
            const distance = numeric(row[columns.distance]);
            const minutes = numeric(row[columns.minutes]);
            if (!date || distance === null || distance < 0 || minutes === null || minutes < 0) {
                skipped++;
                continue;
            }
            const rawCost = numeric(row[columns.cost]);
            const currency = String(row[columns.currency] || "").trim().toUpperCase();
            const fuel = numeric(row[columns.fuel]);
            const speed = numeric(row[columns.speed]);
            trips.push({
                date, day: dateKey(date), distance, minutes,
                speed: speed !== null && speed >= 0 ? speed : null,
                electric: numeric(row[columns.electric]),
                fuel: fuel !== null && fuel >= 0 ? fuel : null,
                cost: rawCost !== null && rawCost >= 0 && currency ? rawCost : null,
                currency
            });
        }
        if (!trips.length) throw new Error("empty");
        trips.sort((first, second) => second.date - first.date);
        return { trips, skipped };
    }

    function accumulateConsumption(result, trip) {
        if (trip.electric !== null && trip.distance > 0) {
            result.electricEnergy += trip.electric * trip.distance / 100;
            result.electricDistance += trip.distance;
        }
        if (trip.fuel !== null && trip.distance > 0) {
            result.fuelLitres += trip.fuel * trip.distance / 100;
            result.fuelDistance += trip.distance;
            result.knownFuelDistance += trip.distance;
            if (trip.fuel === 0) result.electricOnlyDistance += trip.distance;
        }
    }

    function summarize(trips) {
        const result = { count: trips.length, distance: 0, minutes: 0, electricEnergy: 0, fuelLitres: 0,
            electricDistance: 0, fuelDistance: 0, electricOnlyDistance: 0, knownFuelDistance: 0,
            costs: {}, missingCosts: 0, activeDays: new Set(), longest: null };
        for (const trip of trips) {
            result.distance += trip.distance;
            result.minutes += trip.minutes;
            result.activeDays.add(trip.day);
            if (!result.longest || trip.distance > result.longest.distance) result.longest = trip;
            accumulateConsumption(result, trip);
            if (trip.cost !== null) {
                if (!result.costs[trip.currency]) result.costs[trip.currency] = { total: 0, distance: 0, count: 0 };
                result.costs[trip.currency].total += trip.cost;
                result.costs[trip.currency].distance += trip.distance;
                result.costs[trip.currency].count++;
            } else result.missingCosts++;
        }
        result.electricAverage = result.electricDistance ? result.electricEnergy / result.electricDistance * 100 : null;
        result.fuelAverage = result.fuelDistance ? result.fuelLitres / result.fuelDistance * 100 : null;
        result.averageSpeed = result.minutes ? result.distance / result.minutes * 60 : null;
        return result;
    }

    function monthly(trips) {
        const groups = new Map();
        for (const trip of trips) {
            const month = trip.day.slice(0, 7);
            if (!groups.has(month)) groups.set(month, []);
            groups.get(month).push(trip);
        }
        return Array.from(groups).sort(([first], [second]) => first.localeCompare(second))
            .map(([month, group]) => ({ month, ...summarize(group) }));
    }

    const factors = {
        distance: { limits: [0, 5, 20, 50, 100], unit: "km", value: trip => trip.distance },
        speed: { limits: [0, 20, 40, 60, 80, 100, 120], unit: "km/h", value: trip => trip.speed },
        duration: { limits: [0, 10, 20, 40, 60, 120], unit: "min", value: trip => trip.minutes },
        time: { limits: [0, 6, 10, 16, 20], unit: "", value: trip => trip.date.getHours(), end: 24 }
    };

    function consumptionByFactor(trips, factor, mode = "all") {
        const definition = factors[factor];
        if (!definition) throw new Error("factor");
        const groups = definition.limits.map((lower, index) => ({
            lower, upper: definition.limits[index + 1] ?? definition.end ?? Infinity, trips: []
        }));
        const unknown = [];
        for (const trip of trips) {
            if (mode === "no-fuel" && trip.fuel !== 0) continue;
            if (mode === "with-fuel" && (trip.fuel === null || trip.fuel <= 0)) continue;
            const value = definition.value(trip);
            const group = groups.find(bucket => Number.isFinite(value) && value >= bucket.lower && value < bucket.upper);
            if (group) group.trips.push(trip);
            else unknown.push(trip);
        }
        const result = groups.map(group => ({ lower: group.lower, upper: group.upper, unit: definition.unit, ...summarize(group.trips) }));
        if (unknown.length) result.push({ lower: null, upper: null, unit: definition.unit, ...summarize(unknown) });
        return result;
    }

    const api = { readTrips, summarize, monthly, dateKey, consumptionByFactor };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.TripStatistics = api;
})(typeof globalThis !== "undefined" ? globalThis : this);