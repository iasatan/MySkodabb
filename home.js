const vehicleHint = document.getElementById("vehicle-hint");
const vehicleCards = document.getElementById("vehicle-cards");
const refreshVehicleBtn = document.getElementById("refresh-vehicle");
const mapPanel = document.getElementById("map-panel");
const mapFrame = document.getElementById("map-frame");
const mapLink = document.getElementById("map-link");

const specBattery = document.getElementById("spec-battery");
const specFuel = document.getElementById("spec-fuel");
const specFuelSource = document.getElementById("spec-fuel-source");
const specEv = document.getElementById("spec-ev");
const specEvSource = document.getElementById("spec-ev-source");

const timeFormat = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" });
const numberFormat = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 });

const LOCK_LABELS = { YES: "Zárva", NO: "Nyitva" };
const CHARGING_LABELS = {
    CHARGING: "Töltés alatt",
    CONNECT_CABLE: "Kábel nincs csatlakoztatva",
    READY_FOR_CHARGING: "Töltésre kész",
    CONSERVING: "Töltöttség tartása",
    ERROR: "Hiba"
};

function addCard(title, value) {
    if (value === null || value === undefined || value === "") {
        return;
    }
    const card = document.createElement("article");
    card.className = "card";
    const heading = document.createElement("h2");
    heading.textContent = value;
    const label = document.createElement("p");
    label.textContent = title;
    card.append(heading, label);
    vehicleCards.appendChild(card);
}

function renderMap({ latitude, longitude }) {
    const delta = 0.003;
    const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join("%2C");
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
    mapLink.href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
    mapPanel.hidden = false;
}

function renderSpecs(summary) {
    const settings = loadSkodaSettings();

    specBattery.textContent = `${decimalFormat.format(settings.batteryKwh)} kWh`;

    let evKwhPer100Km = null;
    if (summary.stateOfCharge !== null && summary.electricRangeKm) {
        evKwhPer100Km = settings.batteryKwh * (summary.stateOfCharge / 100) / summary.electricRangeKm * 100;
    }
    if (evKwhPer100Km !== null && Number.isFinite(evKwhPer100Km)) {
        specEv.textContent = `${decimalFormat.format(evKwhPer100Km)} kWh/100 km`;
        specEvSource.textContent = "(autó)";
    } else {
        specEv.textContent = `${decimalFormat.format(settings.evKwhPer100Km)} kWh/100 km`;
        specEvSource.textContent = "(beállítás)";
    }

    let fuelLitresPer100Km = null;
    if (summary.fuelLevelPercent !== null && summary.fuelRangeKm) {
        fuelLitresPer100Km = settings.fuelTankLitres * (summary.fuelLevelPercent / 100) / summary.fuelRangeKm * 100;
    }
    if (fuelLitresPer100Km !== null && Number.isFinite(fuelLitresPer100Km)) {
        specFuel.textContent = `${decimalFormat.format(fuelLitresPer100Km)} l/100 km`;
        specFuelSource.textContent = "(autó)";
    } else {
        specFuel.textContent = `${decimalFormat.format(settings.fuelLitresPer100Km)} l/100 km`;
        specFuelSource.textContent = "(beállítás)";
    }
}

function render(summary, meta) {
    vehicleCards.textContent = "";
    mapPanel.hidden = true;

    addCard("Jármű", summary.name);
    addCard("Rendszám", summary.licensePlate);
    addCard("Töltöttség", summary.stateOfCharge === null ? null : `${summary.stateOfCharge}%`);
    addCard("Elektromos hatótáv", summary.electricRangeKm === null ? null : `${numberFormat.format(summary.electricRangeKm)} km`);
    addCard("Üzemanyagszint", summary.fuelLevelPercent === null ? null : `${summary.fuelLevelPercent}%`);
    addCard("Benzines hatótáv", summary.fuelRangeKm === null ? null : `${numberFormat.format(summary.fuelRangeKm)} km`);
    addCard("Kilométeróra", summary.odometerKm === null ? null : `${numberFormat.format(summary.odometerKm)} km`);
    addCard("Ajtók", LOCK_LABELS[summary.doorsLocked] ?? summary.doorsLocked);
    addCard("Töltés állapota", CHARGING_LABELS[summary.chargingState] ?? summary.chargingState);
    addCard("Töltési limit", summary.targetSoc === null ? null : `${summary.targetSoc}%`);

    if (summary.parkingPosition) {
        renderMap(summary.parkingPosition);
    }

    renderSpecs(summary);

    const source = meta.fromCache ? "gyorsítótárból" : "friss";
    const missing = summary.errors ? ` Nem elérhető adatok: ${summary.errors}.` : "";
    vehicleHint.className = "hint";
    vehicleHint.textContent = `Adatok ${source}, ${timeFormat.format(meta.fetchedAt)}.${missing}`;
}

async function loadVehicle(forceRefresh) {
    refreshVehicleBtn.disabled = true;
    vehicleHint.className = "hint";
    vehicleHint.textContent = "Betöltés…";
    try {
        const result = await fetchVehicle({ forceRefresh });
        render(summarizeVehicle(result.data), result);
    } catch (error) {
        vehicleCards.textContent = "";
        mapPanel.hidden = true;
        renderSpecs({ stateOfCharge: null, electricRangeKm: null, fuelLevelPercent: null, fuelRangeKm: null });
        vehicleHint.className = "hint error";
        vehicleHint.textContent = error.message;
    } finally {
        refreshVehicleBtn.disabled = false;
    }
}

refreshVehicleBtn.addEventListener("click", () => loadVehicle(true));
window.addEventListener("DOMContentLoaded", () => {
    renderSpecs({ stateOfCharge: null, electricRangeKm: null, fuelLevelPercent: null, fuelRangeKm: null });
    loadVehicle(false);
});
