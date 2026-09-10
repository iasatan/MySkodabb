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

function timeFormat() {
    return new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit" });
}
function numberFormat() {
    return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 });
}
function decimalFormat() {
    return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 });
}

const LOCK_LABELS = { YES: "lock_yes", NO: "lock_no" };
const CHARGING_LABELS = {
    CHARGING: "charging_charging",
    CONNECT_CABLE: "charging_connect_cable",
    READY_FOR_CHARGING: "charging_ready_for_charging",
    CONSERVING: "charging_conserving",
    ERROR: "charging_error"
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
    const decimal = decimalFormat();

    specBattery.textContent = `${decimal.format(settings.batteryKwh)} kWh`;

    let evKwhPer100Km = null;
    if (summary.stateOfCharge !== null && summary.electricRangeKm) {
        evKwhPer100Km = settings.batteryKwh * (summary.stateOfCharge / 100) / summary.electricRangeKm * 100;
    }
    if (evKwhPer100Km !== null && Number.isFinite(evKwhPer100Km)) {
        specEv.textContent = `${decimal.format(evKwhPer100Km)} kWh/100 km`;
        specEvSource.textContent = t("source_car");
    } else {
        specEv.textContent = `${decimal.format(settings.evKwhPer100Km)} kWh/100 km`;
        specEvSource.textContent = t("source_settings");
    }

    let fuelLitresPer100Km = null;
    if (summary.fuelLevelPercent !== null && summary.fuelRangeKm) {
        fuelLitresPer100Km = settings.fuelTankLitres * (summary.fuelLevelPercent / 100) / summary.fuelRangeKm * 100;
    }
    if (fuelLitresPer100Km !== null && Number.isFinite(fuelLitresPer100Km)) {
        specFuel.textContent = `${decimal.format(fuelLitresPer100Km)} l/100 km`;
        specFuelSource.textContent = t("source_car");
    } else {
        specFuel.textContent = `${decimal.format(settings.fuelLitresPer100Km)} l/100 km`;
        specFuelSource.textContent = t("source_settings");
    }
}

function render(summary, meta) {
    vehicleCards.textContent = "";
    mapPanel.hidden = true;
    const number = numberFormat();

    addCard(t("card_name"), summary.name);
    addCard(t("card_plate"), summary.licensePlate);
    addCard(t("card_soc"), summary.stateOfCharge === null ? null : `${summary.stateOfCharge}%`);
    addCard(t("card_ev_range"), summary.electricRangeKm === null ? null : `${number.format(summary.electricRangeKm)} km`);
    addCard(t("card_fuel_level"), summary.fuelLevelPercent === null ? null : `${summary.fuelLevelPercent}%`);
    addCard(t("card_fuel_range"), summary.fuelRangeKm === null ? null : `${number.format(summary.fuelRangeKm)} km`);
    addCard(t("card_odometer"), summary.odometerKm === null ? null : `${number.format(summary.odometerKm)} km`);
    addCard(t("card_doors"), LOCK_LABELS[summary.doorsLocked] ? t(LOCK_LABELS[summary.doorsLocked]) : summary.doorsLocked);
    addCard(t("card_charging_state"), CHARGING_LABELS[summary.chargingState] ? t(CHARGING_LABELS[summary.chargingState]) : summary.chargingState);
    addCard(t("card_charge_limit"), summary.targetSoc === null ? null : `${summary.targetSoc}%`);

    if (summary.parkingPosition) {
        renderMap(summary.parkingPosition);
    }

    renderSpecs(summary);

    const source = meta.fromCache ? t("source_cache") : t("source_fresh");
    const missing = summary.errors ? t("hint_missing", { errors: summary.errors }) : "";
    vehicleHint.className = "hint";
    vehicleHint.textContent = t("hint_data", { source, time: timeFormat().format(meta.fetchedAt) }) + missing;
}

async function loadVehicle(forceRefresh) {
    refreshVehicleBtn.disabled = true;
    vehicleHint.className = "hint";
    vehicleHint.textContent = t("loading");
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
