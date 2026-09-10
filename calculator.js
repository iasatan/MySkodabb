const CHARGING_EFFICIENCY = 0.9;

const form = document.getElementById("calc-form");
const resultBox = document.getElementById("result");
const distanceInput = document.getElementById("distance");
const routeDistanceBtn = document.getElementById("route-distance");
const routeHint = document.getElementById("route-hint");
const useCarConsumptionInput = document.getElementById("use-car-consumption");
const consumptionHint = document.getElementById("consumption-hint");

function num(value) {
    return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value);
}

function initLocalizedLabels() {
    document.getElementById("fuelPrice-label").textContent = t("label_fuelPrice", { unit: getCurrencyUnit("fuel") });
    document.getElementById("elecPrice-label").textContent = t("label_elecPrice", { unit: getCurrencyUnit("elec") });
    const settings = loadSkodaSettings();
    document.getElementById("assumptions-list").innerHTML = `
        <li>${t("assumption_battery", { value: num(settings.batteryKwh) })}</li>
        <li>${t("assumption_hybrid", { value: num(settings.fuelLitresPer100Km) })}</li>
        <li>${t("assumption_ev", { value: num(settings.evKwhPer100Km) })}</li>
        <li>${t("assumption_loss")}</li>
    `;
}
document.addEventListener("DOMContentLoaded", initLocalizedLabels);

function readCalculationInputs() {
    const fuelPrice = Number(document.getElementById("fuelPrice").value);
    const elecPrice = Number(document.getElementById("elecPrice").value);
    const battery = Number(document.getElementById("battery").value);
    const distance = Number(distanceInput.value);
    return { fuelPrice, elecPrice, battery, distance };
}

function runCalculation(showError = true) {
    const { fuelPrice, elecPrice, battery, distance } = readCalculationInputs();
    const valid =
        [fuelPrice, elecPrice, battery, distance].every((v) => Number.isFinite(v) && v >= 0) &&
        battery <= 100;

    if (!valid) {
        if (!showError) {
            return;
        }
        resultBox.hidden = false;
        resultBox.className = "result";
        resultBox.innerHTML = `<p class="error">${t("error_invalid_inputs")}</p>`;
        return;
    }

    render(calculate({ fuelPrice, elecPrice, battery, distance, consumption: getConsumption() }));
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    runCalculation();
});

form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => runCalculation(false));
});

const targetSocInput = document.getElementById("targetSoc");
const setLimitBtn = document.getElementById("set-limit");
const limitHint = document.getElementById("limit-hint");

setLimitBtn.addEventListener("click", async () => {
    setLimitBtn.disabled = true;
    limitHint.className = "hint";
    limitHint.textContent = t("limit_setting");
    try {
        const target = await setChargingLimit(Number(targetSocInput.value));
        limitHint.textContent = t("limit_set_done", { target });
    } catch (error) {
        limitHint.className = "hint error";
        limitHint.textContent = error.message;
    } finally {
        setLimitBtn.disabled = false;
    }
});

const refreshDataBtn = document.getElementById("refresh-data");
const batteryHint = document.getElementById("battery-hint");

async function loadBattery(forceRefresh) {
    refreshDataBtn.disabled = true;
    batteryHint.className = "hint";
    batteryHint.textContent = t("data_fetching");
    try {
        const { stateOfCharge, fetchedAt, fromCache, remainingRequests } = await fetchBatteryPercentage({ forceRefresh });
        document.getElementById("battery").value = Math.round(stateOfCharge);
        const source = fromCache ? t("source_cache") : t("source_fresh");
        const quota = remainingRequests ? t("quota_remaining", { count: remainingRequests }) : "";
        const time = new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit" });
        batteryHint.textContent = t("battery_hint", { soc: stateOfCharge, source, time: time.format(fetchedAt), quota });
    } catch (error) {
        batteryHint.className = "hint error";
        batteryHint.textContent = error.message;
    } finally {
        refreshDataBtn.disabled = false;
    }
}

refreshDataBtn.addEventListener("click", () => loadBattery(true));
window.addEventListener("DOMContentLoaded", () => loadBattery(false));

let carConsumption = null;

function getConsumption() {
    const settings = loadSkodaSettings();
    return useCarConsumptionInput.checked && carConsumption
        ? carConsumption
        : {
            fuelLitresPer100Km: settings.fuelLitresPer100Km,
            evKwhPer100Km: settings.evKwhPer100Km,
            source: "settings"
        };
}

async function loadCarConsumption() {
    useCarConsumptionInput.disabled = true;
    consumptionHint.className = "hint";
    consumptionHint.textContent = t("consumption_using_cache");
    try {
        const result = await fetchVehicle({ cachedOnly: true });
        const vehicle = summarizeVehicle(result.data);
        if (vehicle.stateOfCharge === null || !vehicle.electricRangeKm || vehicle.electricRangeKm <= 0) {
            throw new Error(t("consumption_missing_ev"));
        }

        const settings = loadSkodaSettings();
        if (!settings.fuelTankLitres || settings.fuelTankLitres <= 0) {
            throw new Error(t("consumption_missing_tank"));
        }
        const evKwhPer100Km = settings.batteryKwh * (vehicle.stateOfCharge / 100) /
            vehicle.electricRangeKm * 100;
        const fuelRangeAvailable = vehicle.fuelRangeKm !== null && vehicle.fuelRangeKm > 0;
        const fuelLevelAvailable = vehicle.fuelLevelPercent !== null && vehicle.fuelLevelPercent >= 0;
        if (!fuelRangeAvailable || !fuelLevelAvailable) {
            throw new Error(t("consumption_missing_fuel"));
        }
        const fuelLitresPer100Km = settings.fuelTankLitres * (vehicle.fuelLevelPercent / 100) /
            vehicle.fuelRangeKm * 100;

        document.getElementById("battery").value = Math.round(vehicle.stateOfCharge);
        carConsumption = {
            fuelLitresPer100Km,
            evKwhPer100Km,
            stateOfCharge: vehicle.stateOfCharge,
            electricRangeKm: vehicle.electricRangeKm,
            fuelLevelPercent: vehicle.fuelLevelPercent,
            fuelRangeKm: vehicle.fuelRangeKm,
            source: "car"
        };
        consumptionHint.textContent = t("consumption_summary", {
            soc: num(vehicle.stateOfCharge),
            evRange: num(vehicle.electricRangeKm),
            evConsumption: num(evKwhPer100Km),
            fuelLevel: vehicle.fuelLevelPercent === null ? "?" : num(vehicle.fuelLevelPercent),
            fuelRange: vehicle.fuelRangeKm === null ? "?" : num(vehicle.fuelRangeKm),
            fuelConsumption: num(fuelLitresPer100Km)
        });
    } catch (error) {
        useCarConsumptionInput.checked = false;
        carConsumption = null;
        consumptionHint.className = "hint error";
        consumptionHint.textContent = error.message;
    } finally {
        useCarConsumptionInput.disabled = false;
    }
}

useCarConsumptionInput.addEventListener("change", () => {
    if (useCarConsumptionInput.checked) {
        loadCarConsumption();
    } else {
        carConsumption = null;
        consumptionHint.className = "hint";
        consumptionHint.textContent = t("consumption_hint_off");
    }
});

async function fetchRouteDistance() {
    const { homeAddress } = loadSkodaSettings();
    if (!homeAddress) {
        throw new Error(t("home_address_missing"));
    }

    const vehicleResult = await fetchVehicle();
    const parkingPosition = summarizeVehicle(vehicleResult.data).parkingPosition;
    if (!parkingPosition) {
        throw new Error(t("parking_position_missing"));
    }

    const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
    geocodeUrl.searchParams.set("q", homeAddress);
    geocodeUrl.searchParams.set("format", "jsonv2");
    geocodeUrl.searchParams.set("limit", "1");
    const geocodeResponse = await fetch(geocodeUrl);
    if (!geocodeResponse.ok) {
        throw new Error(t("geocode_failed"));
    }
    const locations = await geocodeResponse.json();
    if (!locations.length) {
        throw new Error(t("home_address_not_found"));
    }

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${parkingPosition.longitude},${parkingPosition.latitude};${locations[0].lon},${locations[0].lat}`;
    const routeResponse = await fetch(`${routeUrl}?overview=false&alternatives=true`);
    if (!routeResponse.ok) {
        throw new Error(t("route_failed"));
    }
    const route = await routeResponse.json();
    if (route.code !== "Ok" || !route.routes?.length) {
        throw new Error(t("route_not_found"));
    }
    const shortestRoute = route.routes.reduce((shortest, current) =>
        current.distance < shortest.distance ? current : shortest
    );
    return shortestRoute.distance / 1000;
}

async function loadRouteDistance() {
    routeDistanceBtn.disabled = true;
    routeHint.className = "hint";
    routeHint.textContent = t("route_fetching");
    try {
        const distance = await fetchRouteDistance();
        distanceInput.value = distance.toFixed(1);
        routeHint.textContent = t("route_hint", { distance: num(distance) });
    } catch (error) {
        routeHint.className = "hint error";
        routeHint.textContent = error.message;
    } finally {
        routeDistanceBtn.disabled = false;
    }
}

routeDistanceBtn.addEventListener("click", loadRouteDistance);
window.addEventListener("DOMContentLoaded", loadRouteDistance);

function calculate({ fuelPrice, elecPrice, battery, distance, consumption }) {
    const settings = loadSkodaSettings();
    const batteryKwh = settings.batteryKwh;
    const fuelLitresPerKm = consumption.fuelLitresPer100Km / 100;
    const evKwhPerKm = consumption.evKwhPer100Km / 100;
    const stored = batteryKwh * (battery / 100);
    const evRange = stored / evKwhPerKm;
    const neededKwh = distance * evKwhPerKm;
    const currentElectricDistance = Math.min(distance, evRange);
    const noChargeHybridDistance = Math.max(0, distance - currentElectricDistance);
    const chargeTargetKwh = Math.min(neededKwh, batteryKwh);
    const chargeKwh = Math.max(0, chargeTargetKwh - stored);
    const chargedElectricDistance = Math.min(distance, batteryKwh / evKwhPerKm);
    const hybridDistance = Math.max(0, distance - chargedElectricDistance);

    // A töltéshez a hálózatból a veszteség miatt több energiát kell vennünk.
    const gridKwh = chargeKwh / CHARGING_EFFICIENCY;
    const chargeCost = gridKwh * elecPrice;
    const fuelLitres = hybridDistance * fuelLitresPerKm;
    const fuelCost = fuelLitres * fuelPrice;
    const noChargeFuelLitres = noChargeHybridDistance * fuelLitresPerKm;
    const noChargeFuelCost = noChargeFuelLitres * fuelPrice;
    const chargeScenarioCost = chargeCost + fuelCost;

    const evCostPerKm = (evKwhPerKm / CHARGING_EFFICIENCY) * elecPrice;
    const fuelCostPerKm = fuelLitresPerKm * fuelPrice;
    const breakEvenElecPrice = fuelCostPerKm / (evKwhPerKm / CHARGING_EFFICIENCY);
    const breakEvenFuelPrice = evCostPerKm / fuelLitresPerKm;

    const fullChargeKwh = (batteryKwh - stored) / CHARGING_EFFICIENCY;
    const requiredSoc = Math.min(100, Math.ceil((chargeTargetKwh / batteryKwh) * 100));

    return {
        distance,
        stored,
        evRange,
        neededKwh,
        deficitKwh: chargeKwh,
        deficitKm: hybridDistance,
        gridKwh,
        chargeCost,
        fuelLitres,
        fuelCost,
        evCostPerKm,
        fuelCostPerKm,
        breakEvenElecPrice,
        breakEvenFuelPrice,
        fullChargeKwh,
        requiredSoc,
        currentElectricDistance,
        noChargeHybridDistance,
        noChargeFuelLitres,
        noChargeFuelCost,
        chargeScenarioCost,
        fullChargeCost: fullChargeKwh * elecPrice,
        batteryPercent: battery,
        fuelLitresPer100Km: consumption.fuelLitresPer100Km,
        evKwhPer100Km: consumption.evKwhPer100Km,
        stateOfCharge: consumption.stateOfCharge,
        electricRangeKm: consumption.electricRangeKm,
        fuelLevelPercent: consumption.fuelLevelPercent,
        fuelRangeKm: consumption.fuelRangeKm,
        consumptionSource: consumption.source,
        savings: noChargeFuelCost - chargeScenarioCost
    };
}

function render(r) {
    const enoughRange = r.noChargeHybridDistance === 0;
    const chargeIsBetter = r.deficitKwh > 0 && r.savings > 0;
    const fuelLevel = r.fuelLevelPercent === null ? "?" : num(r.fuelLevelPercent);
    const fuelRange = r.fuelRangeKm === null ? "?" : num(r.fuelRangeKm);
    const symbol = currencySymbol();

    targetSocInput.value = r.requiredSoc;
    limitHint.className = "hint";
    limitHint.textContent = t("limit_hint_calculated", { distance: num(r.distance), soc: r.requiredSoc });

    let verdict;
    let mode;
    if (enoughRange) {
        verdict = t("verdict_no_charge_enough");
        mode = "charge";
    } else if (chargeIsBetter) {
        verdict = t("verdict_charge_better", { savings: formatCurrency(r.savings) });
        mode = "charge";
    } else {
        verdict = t("verdict_fuel_better", { savings: formatCurrency(Math.abs(r.savings)) });
        mode = "fuel";
    }

    const consumptionSourceLabel = r.consumptionSource === "car" ? t("consumption_source_car") : t("consumption_source_settings");

    resultBox.hidden = false;
    resultBox.className = `result ${mode}`;
    resultBox.innerHTML = `
        <p class="verdict">${verdict}</p>
        <table>
            <tbody>
                <tr><th>${t("row_ev_range_now")}</th><td>${num(r.evRange)} km (${num(r.stored)} kWh)</td></tr>
                <tr><th>${t("row_distance")}</th><td>${num(r.distance)} km</td></tr>
                <tr><th>${t("row_required_soc")}</th><td>${r.requiredSoc}%</td></tr>
                <tr><th>${t("row_hybrid_no_charge")}</th><td>${num(r.noChargeHybridDistance)} km</td></tr>
                <tr><th>${t("row_hybrid_with_charge")}</th><td>${num(r.deficitKm)} km</td></tr>
                <tr><th>${t("row_charge_needed")}</th><td>${num(r.gridKwh)} kWh &rarr; <strong>${formatCurrency(r.chargeCost)}</strong></td></tr>
                <tr><th>${t("row_fuel_no_charge")}</th><td>${num(r.noChargeFuelLitres)} l &rarr; <strong>${formatCurrency(r.noChargeFuelCost)}</strong></td></tr>
                <tr><th>${t("row_cost_per_km_ev")}</th><td>${num(r.evCostPerKm)} ${symbol}/km</td></tr>
                <tr><th>${t("row_cost_per_km_fuel")}</th><td>${num(r.fuelCostPerKm)} ${symbol}/km</td></tr>
                <tr><th>${t("row_consumption_source")}</th><td>${consumptionSourceLabel}</td></tr>
                <tr><th>${t("row_ev_consumption")}</th><td>${num(r.evKwhPer100Km)} kWh/100 km</td></tr>
                <tr><th>${t("row_fuel_consumption")}</th><td>${num(r.fuelLitresPer100Km)} l/100 km</td></tr>
                ${r.consumptionSource === "car" ? `
                    <tr><th>${t("row_battery_for_calc")}</th><td>${num(r.batteryPercent)}%</td></tr>
                    <tr><th>${t("row_car_current_battery")}</th><td>${t("row_car_current_battery_value", { soc: num(r.stateOfCharge), range: num(r.electricRangeKm) })}</td></tr>
                    <tr><th>${t("row_fuel")}</th><td>${t("row_fuel_value", { level: fuelLevel, range: fuelRange })}</td></tr>
                ` : ""}
                <tr><th>${t("row_full_charge")}</th><td>${num(r.fullChargeKwh)} kWh &rarr; ${formatCurrency(r.fullChargeCost)}</td></tr>
            </tbody>
        </table>
        <p class="note">
            ${t("note_break_even", {
                elecPrice: `<strong>${formatCurrency(r.breakEvenElecPrice)}/kWh</strong>`,
                fuelPrice: `${formatCurrency(r.breakEvenFuelPrice)}/l`
            })}
        </p>
    `;
}
