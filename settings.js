const settingsForm = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("apiKey");
const vinInput = document.getElementById("vin");
const homeAddressInput = document.getElementById("homeAddress");
const batteryKwhInput = document.getElementById("batteryKwh");
const fuelLitresPer100KmInput = document.getElementById("fuelLitresPer100Km");
const fuelTankLitresInput = document.getElementById("fuelTankLitres");
const evKwhPer100KmInput = document.getElementById("evKwhPer100Km");
const languageInput = document.getElementById("language");
const currencyInput = document.getElementById("currency");
const statusBox = document.getElementById("settings-status");

function populateSelect(select, options, selected) {
    select.textContent = "";
    for (const option of options) {
        const el = document.createElement("option");
        el.value = option.code;
        el.textContent = `${option.name} (${option.code})`;
        el.selected = option.code === selected;
        select.appendChild(el);
    }
}

const current = loadSkodaSettings();
apiKeyInput.value = current.apiKey;
vinInput.value = current.vin;
homeAddressInput.value = current.homeAddress;
batteryKwhInput.value = current.batteryKwh;
fuelLitresPer100KmInput.value = current.fuelLitresPer100Km;
fuelTankLitresInput.value = current.fuelTankLitres;
evKwhPer100KmInput.value = current.evKwhPer100Km;
populateSelect(languageInput, SUPPORTED_LANGUAGES, current.language);
populateSelect(currencyInput, SUPPORTED_CURRENCIES, current.currency);

function renderGoodToKnow() {
    document.getElementById("good-to-know-1").innerHTML =
        t("good_to_know_1", { link: '<a href="https://go.skoda.eu/api-keys">go.skoda.eu/api-keys</a>' });
    document.getElementById("good-to-know-2").innerHTML =
        t("good_to_know_2", { code: "<code>X-API-Key-Expires-At</code>" });
    document.getElementById("good-to-know-4").innerHTML =
        t("good_to_know_4", { code: "<code>skoda-api-proxy.satanadam.workers.dev</code>" });
    document.getElementById("docs-note").innerHTML =
        t("docs_note", { link: '<a href="https://public.api.connect.skoda-auto.cz/docs">MyŠkoda Public API</a>' });
}
renderGoodToKnow();

function showStatus(message, kind) {
    statusBox.hidden = false;
    statusBox.className = `result ${kind === "error" ? "fuel" : "charge"}`;
    statusBox.textContent = "";
    const p = document.createElement("p");
    p.className = kind === "error" ? "error" : "verdict";
    p.textContent = message;
    statusBox.appendChild(p);
}

function currentFormValues() {
    return {
        apiKey: apiKeyInput.value,
        vin: vinInput.value,
        homeAddress: homeAddressInput.value,
        batteryKwh: batteryKwhInput.value,
        fuelLitresPer100Km: fuelLitresPer100KmInput.value,
        fuelTankLitres: fuelTankLitresInput.value,
        evKwhPer100Km: evKwhPer100KmInput.value,
        language: languageInput.value,
        currency: currencyInput.value
    };
}

settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const vin = vinInput.value.trim().toUpperCase();
    if (vin && !isValidVin(vin)) {
        showStatus(t("vin_invalid"), "error");
        return;
    }
    const consumptionValues = [batteryKwhInput, fuelLitresPer100KmInput, fuelTankLitresInput, evKwhPer100KmInput];
    if (consumptionValues.some((input) => !Number.isFinite(Number(input.value)) || Number(input.value) <= 0)) {
        showStatus(t("consumption_values_invalid"), "error");
        return;
    }

    const languageChanged = current.language !== languageInput.value;
    saveSkodaSettings({ ...currentFormValues(), vin });
    vinInput.value = vin;

    // A nyelvváltás minden oldalon lévő fordítást csak újratöltéskor frissíti.
    if (languageChanged) {
        window.location.reload();
        return;
    }
    showStatus(t("settings_saved"), "ok");
});

document.getElementById("test-btn").addEventListener("click", async () => {
    saveSkodaSettings(currentFormValues());
    showStatus(t("test_in_progress"), "ok");
    try {
        const { stateOfCharge, keyExpiresAt } = await fetchBatteryPercentage({ forceRefresh: true });
        const expiry = keyExpiresAt ? t("test_key_expiry", { expiry: keyExpiresAt }) : "";
        showStatus(t("test_success", { soc: stateOfCharge, expiry }), "ok");
    } catch (error) {
        showStatus(error.message, "error");
    }
});

document.getElementById("clear-btn").addEventListener("click", () => {
    clearSkodaSettings();
    apiKeyInput.value = "";
    vinInput.value = "";
    homeAddressInput.value = "";
    showStatus(t("settings_cleared"), "ok");
});

const consumptionDataStatus = document.getElementById("consumption-data-status");
function renderConsumptionDataStatus() {
    try {
        const readings = loadConsumptionReadings();
        consumptionDataStatus.classList.remove("error");
        consumptionDataStatus.textContent = t(readings.length ? "consumption_history_count" : "consumption_history_empty", { count: readings.length });
    } catch {
        consumptionDataStatus.classList.add("error");
        consumptionDataStatus.textContent = t("consumption_load_failed");
    }
}
renderConsumptionDataStatus();

document.getElementById("export-consumption").addEventListener("click", () => {
    let url;
    try {
        const readings = loadConsumptionReadings();
        const savedTrips = localStorage.getItem("myskodabb.tripStatistics.v1");
        if (savedTrips !== null) TripStatistics.deserializeTrips(savedTrips);
        const data = { version: 1, exportedAt: new Date().toISOString(), readings,
            tripStatistics: savedTrips === null ? null : JSON.parse(savedTrips) };
        url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `myskodabb-consumption-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        showStatus(t("consumption_exported"), "ok");
    } catch {
        showStatus(t("consumption_export_failed"), "error");
    } finally {
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
});

document.getElementById("clear-consumption").addEventListener("click", () => {
    try {
        localStorage.removeItem(SKODA_CONSUMPTION_KEY);
        renderConsumptionDataStatus();
        showStatus(t("consumption_cleared"), "ok");
    } catch {
        showStatus(t("consumption_clear_failed"), "error");
    }
});
