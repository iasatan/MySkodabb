const CHARGING_EFFICIENCY = 0.9;

const form = document.getElementById("calc-form");
const resultBox = document.getElementById("result");
const distanceInput = document.getElementById("distance");
const routeDistanceBtn = document.getElementById("route-distance");
const routeHint = document.getElementById("route-hint");

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

    render(calculate({ fuelPrice, elecPrice, battery, distance }));
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

function calculate({ fuelPrice, elecPrice, battery, distance }) {
    const settings = loadSkodaSettings();
    const batteryKwh = settings.batteryKwh;
    const fuelLitresPerKm = settings.fuelLitresPer100Km / 100;
    const evKwhPerKm = settings.evKwhPer100Km / 100;
    const stored = batteryKwh * (battery / 100);
    const evRange = stored / evKwhPerKm;
    const neededKwh = distance * evKwhPerKm;
    const deficitKwh = Math.max(0, neededKwh - stored);
    const deficitKm = deficitKwh / evKwhPerKm;

    // A töltéshez a hálózatból a veszteség miatt több energiát kell vennünk.
    const gridKwh = deficitKwh / CHARGING_EFFICIENCY;
    const chargeCost = gridKwh * elecPrice;
    const fuelLitres = deficitKm * fuelLitresPerKm;
    const fuelCost = fuelLitres * fuelPrice;

    const evCostPerKm = (evKwhPerKm / CHARGING_EFFICIENCY) * elecPrice;
    const fuelCostPerKm = fuelLitresPerKm * fuelPrice;
    const breakEvenElecPrice = fuelCostPerKm / (evKwhPerKm / CHARGING_EFFICIENCY);
    const breakEvenFuelPrice = evCostPerKm / fuelLitresPerKm;

    const fullChargeKwh = (batteryKwh - stored) / CHARGING_EFFICIENCY;
    const requiredSoc = Math.min(100, Math.ceil((neededKwh / batteryKwh) * 100));

    return {
        distance,
        stored,
        evRange,
        neededKwh,
        deficitKwh,
        deficitKm,
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
        savings: fuelCost - chargeCost
    };
}

function render(r) {
    const chargeIsBetter = r.evCostPerKm < r.fuelCostPerKm;
    const enoughRange = r.deficitKwh === 0;

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
                <tr><th>Teljes feltöltés ára (100%-ig)</th><td>${num.format(r.fullChargeKwh)} kWh &rarr; ${huf.format(r.fullChargeCost)} Ft</td></tr>
            </tbody>
        </table>
        <p class="note">
            Fordulópont: a töltés eddig az áramárig éri meg: <strong>${num.format(r.breakEvenElecPrice)} Ft/kWh</strong>
            (illetve ettől az üzemanyagártól: ${num.format(r.breakEvenFuelPrice)} Ft/l).
        </p>
    `;
}
