const settingsForm = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("apiKey");
const vinInput = document.getElementById("vin");
const homeAddressInput = document.getElementById("homeAddress");
const batteryKwhInput = document.getElementById("batteryKwh");
const fuelLitresPer100KmInput = document.getElementById("fuelLitresPer100Km");
const fuelTankLitresInput = document.getElementById("fuelTankLitres");
const evKwhPer100KmInput = document.getElementById("evKwhPer100Km");
const statusBox = document.getElementById("settings-status");

const current = loadSkodaSettings();
apiKeyInput.value = current.apiKey;
vinInput.value = current.vin;
homeAddressInput.value = current.homeAddress;
batteryKwhInput.value = current.batteryKwh;
fuelLitresPer100KmInput.value = current.fuelLitresPer100Km;
fuelTankLitresInput.value = current.fuelTankLitres;
evKwhPer100KmInput.value = current.evKwhPer100Km;

function showStatus(message, kind) {
    statusBox.hidden = false;
    statusBox.className = `result ${kind === "error" ? "fuel" : "charge"}`;
    statusBox.textContent = "";
    const p = document.createElement("p");
    p.className = kind === "error" ? "error" : "verdict";
    p.textContent = message;
    statusBox.appendChild(p);
}

settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const vin = vinInput.value.trim().toUpperCase();
    if (vin && !isValidVin(vin)) {
        showStatus("A VIN 17 karakter hosszú lehet, I, O és Q betű nélkül.", "error");
        return;
    }
    const consumptionValues = [batteryKwhInput, fuelLitresPer100KmInput, fuelTankLitresInput, evKwhPer100KmInput];
    if (consumptionValues.some((input) => !Number.isFinite(Number(input.value)) || Number(input.value) <= 0)) {
        showStatus("Az akkumulátor kapacitása és a fogyasztási értékek legyenek nullánál nagyobbak.", "error");
        return;
    }

    saveSkodaSettings({
        apiKey: apiKeyInput.value,
        vin,
        homeAddress: homeAddressInput.value,
        batteryKwh: batteryKwhInput.value,
        fuelLitresPer100Km: fuelLitresPer100KmInput.value,
        fuelTankLitres: fuelTankLitresInput.value,
        evKwhPer100Km: evKwhPer100KmInput.value
    });
    vinInput.value = vin;
    showStatus("Beállítások elmentve ebben a böngészőben.", "ok");
});

document.getElementById("test-btn").addEventListener("click", async () => {
    saveSkodaSettings({
        apiKey: apiKeyInput.value,
        vin: vinInput.value,
        homeAddress: homeAddressInput.value,
        batteryKwh: batteryKwhInput.value,
        fuelLitresPer100Km: fuelLitresPer100KmInput.value,
        fuelTankLitres: fuelTankLitresInput.value,
        evKwhPer100Km: evKwhPer100KmInput.value
    });
    showStatus("Lekérés folyamatban…", "ok");
    try {
        const { stateOfCharge, keyExpiresAt } = await fetchBatteryPercentage({ forceRefresh: true });
        const expiry = keyExpiresAt ? ` A kulcs lejárata: ${keyExpiresAt}.` : "";
        showStatus(`Sikeres kapcsolat – az akkumulátor töltöttsége ${stateOfCharge}%.${expiry}`, "ok");
    } catch (error) {
        showStatus(error.message, "error");
    }
});

document.getElementById("clear-btn").addEventListener("click", () => {
    clearSkodaSettings();
    apiKeyInput.value = "";
    vinInput.value = "";
    homeAddressInput.value = "";
    showStatus("A tárolt adatok törölve.", "ok");
});
