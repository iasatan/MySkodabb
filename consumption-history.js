(function (root) {
    "use strict";

    function estimateRate(trips, distance, measurement, eligible) {
        const target = Math.max(distance, 1);
        const candidates = trips.filter(trip => trip.distance > 0 &&
            Number.isFinite(trip[measurement]) && trip[measurement] > 0 && eligible(trip))
            .map(trip => ({ trip, difference: Math.abs(Math.log(trip.distance / target)) }))
            .sort((first, second) => first.difference - second.difference).slice(0, 10);
        if (!candidates.length) return null;
        let total = 0;
        let weights = 0;
        for (const { trip, difference } of candidates) {
            const weight = trip.distance / (1 + difference) ** 2;
            total += trip[measurement] * weight;
            weights += weight;
        }
        return { value: total / weights, count: candidates.length,
            minDistance: Math.min(...candidates.map(candidate => candidate.trip.distance)),
            maxDistance: Math.max(...candidates.map(candidate => candidate.trip.distance)) };
    }

    function estimateConsumption(trips, distance, settings) {
        if (!Number.isFinite(distance) || distance < 0) throw new Error("distance");
        const electric = estimateRate(trips, distance, "electric", trip => trip.fuel === 0);
        const fuel = estimateRate(trips, distance, "fuel", trip => Number.isFinite(trip.electric) && trip.electric <= 1);
        return {
            evKwhPer100Km: electric?.value ?? settings.evKwhPer100Km,
            fuelLitresPer100Km: fuel?.value ?? settings.fuelLitresPer100Km,
            source: electric || fuel ? "history" : "settings", electric, fuel
        };
    }

    const api = { estimateConsumption };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.ConsumptionHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this);