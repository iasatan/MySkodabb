const CHARGING_EFFICIENCY = 0.9;

const form = document.getElementById("calc-form");
const resultBox = document.getElementById("result");
const distanceInput = document.getElementById("distance");
const routeDistanceBtn = document.getElementById("route-distance");
const routeHint = document.getElementById("route-hint");
const useCarConsumptionInput = document.getElementById("use-car-consumption");
const consumptionHint = document.getElementById("consumption-hint");

const huf = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 });

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fuelPrice = Number(document.getElementById("fuelPrice").value);
    const elecPrice = Number(document.getElementById("elecPrice").value);
    const battery = Number(document.getElementById("battery").value);
    const distance = Number(distanceInput.value);

    const valid =
        [fuelPrice, elecPrice, battery, distance].every((v) => Number.isFinite(v) && v >= 0) &&
        battery <= 100;

    if (!valid) {
        resultBox.hidden = false;
        resultBox.className = "result";
        resultBox.innerHTML = '<p class="error">Kérlek adj meg érvényes értékeket (a töltöttség 0 és 100% között).</p>';
        return;
    }

    render(calculate({ fuelPrice, elecPrice, battery, distance, consumption: getConsumption() }));
});

const targetSocInput = document.getElementById("targetSoc");
const setLimitBtn = document.getElementById("set-limit");
const limitHint = document.getElementById("limit-hint");

setLimitBtn.addEventListener("click", async () => {
    setLimitBtn.disabled = true;
    limitHint.className = "hint";
    limitHint.textContent = "Beállítás folyamatban…";
    try {
        const target = await setChargingLimit(Number(targetSocInput.value));
        limitHint.textContent = `A töltési limit ${target}%-ra állítva.`;
    } catch (error) {
        limitHint.className = "hint error";
        limitHint.textContent = error.message;
    } finally {
        setLimitBtn.disabled = false;
    }
});

const fetchBatteryBtn = document.getElementById("fetch-battery");
const refreshBatteryBtn = document.getElementById("refresh-battery");
const batteryHint = document.getElementById("battery-hint");
const time = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" });

async function loadBattery(forceRefresh) {
    fetchBatteryBtn.disabled = true;
    refreshBatteryBtn.disabled = true;
    batteryHint.className = "hint";
    batteryHint.textContent = "Lekérés folyamatban…";
    try {
        const { stateOfCharge, fetchedAt, fromCache, remainingRequests } = await fetchBatteryPercentage({ forceRefresh });
        document.getElementById("battery").value = Math.round(stateOfCharge);
        const source = fromCache ? "gyorsítótárból" : "friss";
        const quota = remainingRequests ? `, még ${remainingRequests} lekérés ebben az órában` : "";
        batteryHint.textContent = `Töltöttség: ${stateOfCharge}% (${source}, ${time.format(fetchedAt)}${quota})`;
    } catch (error) {
        batteryHint.className = "hint error";
        batteryHint.textContent = error.message;
    } finally {
        fetchBatteryBtn.disabled = false;
        refreshBatteryBtn.disabled = false;
    }
}

fetchBatteryBtn.addEventListener("click", () => loadBattery(false));
refreshBatteryBtn.addEventListener("click", () => loadBattery(true));
window.addEventListener("DOMContentLoaded", () => loadBattery(false));

let carConsumption = null;

function getConsumption() {
    const settings = loadSkodaSettings();
    return useCarConsumptionInput.checked && carConsumption
        ? carConsumption
        : {
            fuelLitresPer100Km: settings.fuelLitresPer100Km,
            evKwhPer100Km: settings.evKwhPer100Km,
            source: "beállítások"
        };
}

async function loadCarConsumption() {
    useCarConsumptionInput.disabled = true;
    consumptionHint.className = "hint";
    consumptionHint.textContent = "Az autó adatainak lekérése…";
    try {
        const result = await fetchVehicle({ forceRefresh: true });
        const vehicle = summarizeVehicle(result.data);
        if (!vehicle.stateOfCharge || !vehicle.electricRangeKm || vehicle.electricRangeKm <= 0) {
            throw new Error("Az autó elektromos töltöttsége vagy hatótávja nem érhető el.");
        }

        const settings = loadSkodaSettings();
        const evKwhPer100Km = settings.batteryKwh * (vehicle.stateOfCharge / 100) /
            vehicle.electricRangeKm * 100;
        const fuelRangeAvailable = vehicle.fuelRangeKm !== null && vehicle.fuelRangeKm > 0;
        const fuelLevelAvailable = vehicle.fuelLevelPercent !== null && vehicle.fuelLevelPercent >= 0;
        if (!fuelRangeAvailable || !fuelLevelAvailable) {
            throw new Error("Az autó benzinszintje vagy benzines hatótávja nem érhető el.");
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
            source: "autó"
        };
        consumptionHint.textContent =
            `Autó: akkumulátor ${num.format(vehicle.stateOfCharge)}%, ` +
            `elektromos hatótáv ${num.format(vehicle.electricRangeKm)} km, ` +
            `fogyasztás ${num.format(evKwhPer100Km)} kWh/100 km; ` +
            `üzemanyag ${vehicle.fuelLevelPercent === null ? "?" : num.format(vehicle.fuelLevelPercent)}%, ` +
            `hatótáv ${vehicle.fuelRangeKm === null ? "?" : num.format(vehicle.fuelRangeKm)} km, ` +
            `fogyasztás ${num.format(fuelLitresPer100Km)} l/100 km.`;
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
        consumptionHint.textContent = "Kikapcsolva: a Beállításokban megadott fogyasztási értékek használata.";
    }
});

async function fetchRouteDistance() {
    const { homeAddress } = loadSkodaSettings();
    if (!homeAddress) {
        throw new Error("Előbb add meg az otthoni címet a Beállítások oldalon.");
    }

    const vehicleResult = await fetchVehicle({ forceRefresh: true });
    const parkingPosition = summarizeVehicle(vehicleResult.data).parkingPosition;
    if (!parkingPosition) {
        throw new Error("Az autó aktuális parkolási helyzete nem érhető el.");
    }

    const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
    geocodeUrl.searchParams.set("q", homeAddress);
    geocodeUrl.searchParams.set("format", "jsonv2");
    geocodeUrl.searchParams.set("limit", "1");
    const geocodeResponse = await fetch(geocodeUrl);
    if (!geocodeResponse.ok) {
        throw new Error("A cím koordinátáinak lekérése sikertelen.");
    }
    const locations = await geocodeResponse.json();
    if (!locations.length) {
        throw new Error("A megadott otthoni cím nem található.");
    }

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${parkingPosition.longitude},${parkingPosition.latitude};${locations[0].lon},${locations[0].lat}`;
    const routeResponse = await fetch(`${routeUrl}?overview=false&alternatives=true`);
    if (!routeResponse.ok) {
        throw new Error("Az útvonal lekérése sikertelen.");
    }
    const route = await routeResponse.json();
    if (route.code !== "Ok" || !route.routes?.length) {
        throw new Error("Nem található autós útvonal a jelenlegi hely és az otthon között.");
    }
    const shortestRoute = route.routes.reduce((shortest, current) =>
        current.distance < shortest.distance ? current : shortest
    );
    return shortestRoute.distance / 1000;
}

async function loadRouteDistance() {
    routeDistanceBtn.disabled = true;
    routeHint.className = "hint";
    routeHint.textContent = "Az autó helyzete és az útvonal lekérése…";
    try {
        const distance = await fetchRouteDistance();
        distanceInput.value = distance.toFixed(1);
        routeHint.textContent = `Útvonal távolsága: ${num.format(distance)} km.`;
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
    const chargeTargetKwh = Math.min(neededKwh, batteryKwh);
    const chargeKwh = Math.max(0, chargeTargetKwh - stored);
    const hybridDistance = Math.max(0, distance - batteryKwh / evKwhPerKm);

    // A töltéshez a hálózatból a veszteség miatt több energiát kell vennünk.
    const gridKwh = chargeKwh / CHARGING_EFFICIENCY;
    const chargeCost = gridKwh * elecPrice;
    const fuelLitres = hybridDistance * fuelLitresPerKm;
    const fuelCost = fuelLitres * fuelPrice;

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
        fullChargeCost: fullChargeKwh * elecPrice,
        fuelLitresPer100Km: consumption.fuelLitresPer100Km,
        evKwhPer100Km: consumption.evKwhPer100Km,
        stateOfCharge: consumption.stateOfCharge,
        electricRangeKm: consumption.electricRangeKm,
        fuelLevelPercent: consumption.fuelLevelPercent,
        fuelRangeKm: consumption.fuelRangeKm,
        consumptionSource: consumption.source,
        savings: fuelCost - chargeCost
    };
}

function render(r) {
    const chargeIsBetter = r.evCostPerKm < r.fuelCostPerKm;
    const enoughRange = r.deficitKwh === 0;
    const fuelLevel = r.fuelLevelPercent === null ? "?" : num.format(r.fuelLevelPercent);
    const fuelRange = r.fuelRangeKm === null ? "?" : num.format(r.fuelRangeKm);

    targetSocInput.value = r.requiredSoc;
    limitHint.className = "hint";
    limitHint.textContent = `${num.format(r.distance)} km-hez ${r.requiredSoc}% kell – átírható, majd átküldhető az autóba.`;

    let verdict;
    let mode;
    if (enoughRange) {
        verdict = "Nem kell tölteni: a jelenlegi töltöttség elég erre az útra.";
        mode = "charge";
    } else if (chargeIsBetter) {
        verdict = `Töltsd fel! Így ${huf.format(r.savings)} Ft-ot spórolsz ezen az úton.`;
        mode = "charge";
    } else {
        verdict = `Menj hibridben! A töltés ${huf.format(-r.savings)} Ft-tal drágább lenne.`;
        mode = "fuel";
    }

    resultBox.hidden = false;
    resultBox.className = `result ${mode}`;
    resultBox.innerHTML = `
        <p class="verdict">${verdict}</p>
        <table>
            <tbody>
                <tr><th>Elektromos hatótáv most</th><td>${num.format(r.evRange)} km (${num.format(r.stored)} kWh)</td></tr>
                <tr><th>Út hossza</th><td>${num.format(r.distance)} km</td></tr>
                <tr><th>Ehhez szükséges töltöttség</th><td>${r.requiredSoc}%</td></tr>
                <tr><th>Árammal nem fedezett szakasz</th><td>${num.format(r.deficitKm)} km</td></tr>
                <tr><th>Ehhez szükséges töltés (hálózatból)</th><td>${num.format(r.gridKwh)} kWh &rarr; <strong>${huf.format(r.chargeCost)} Ft</strong></td></tr>
                <tr><th>Ugyanez benzinnel</th><td>${num.format(r.fuelLitres)} l &rarr; <strong>${huf.format(r.fuelCost)} Ft</strong></td></tr>
                <tr><th>Költség / km elektromosan</th><td>${num.format(r.evCostPerKm)} Ft/km</td></tr>
                <tr><th>Költség / km hibridben</th><td>${num.format(r.fuelCostPerKm)} Ft/km</td></tr>
                <tr><th>Számítási fogyasztás</th><td>${r.consumptionSource === "autó" ? "autó adatai" : "Beállítások"}</td></tr>
                <tr><th>Elektromos fogyasztás</th><td>${num.format(r.evKwhPer100Km)} kWh/100 km</td></tr>
                <tr><th>Hibrid fogyasztás</th><td>${num.format(r.fuelLitresPer100Km)} l/100 km</td></tr>
                ${r.consumptionSource === "autó" ? `
                    <tr><th>Akkumulátor</th><td>${num.format(r.stateOfCharge)}% | ${num.format(r.electricRangeKm)} km maradék út</td></tr>
                    <tr><th>Üzemanyag</th><td>${fuelLevel}% | ${fuelRange} km maradék út</td></tr>
                ` : ""}
                <tr><th>Teljes feltöltés ára (100%-ig)</th><td>${num.format(r.fullChargeKwh)} kWh &rarr; ${huf.format(r.fullChargeCost)} Ft</td></tr>
            </tbody>
        </table>
        <p class="note">
            Fordulópont: a töltés eddig az áramárig éri meg: <strong>${num.format(r.breakEvenElecPrice)} Ft/kWh</strong>
            (illetve ettől az üzemanyagártól: ${num.format(r.breakEvenFuelPrice)} Ft/l).
        </p>
    `;
}
