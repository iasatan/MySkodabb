const settingsForm = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("apiKey");
const vinInput = document.getElementById("vin");
const baseUrlInput = document.getElementById("baseUrl");
const keyInQueryInput = document.getElementById("keyInQuery");
const statusBox = document.getElementById("settings-status");

const current = loadSkodaSettings();
apiKeyInput.value = current.apiKey;
vinInput.value = current.vin;
baseUrlInput.value = current.baseUrl;
keyInQueryInput.checked = current.keyInQuery;

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

    saveSkodaSettings({
        apiKey: apiKeyInput.value,
        vin,
        baseUrl: baseUrlInput.value,
        keyInQuery: keyInQueryInput.checked
    });
    vinInput.value = vin;
    showStatus("Beállítások elmentve ebben a böngészőben.", "ok");
});

document.getElementById("test-btn").addEventListener("click", async () => {
    saveSkodaSettings({
        apiKey: apiKeyInput.value,
        vin: vinInput.value,
        baseUrl: baseUrlInput.value,
        keyInQuery: keyInQueryInput.checked
    });
    showStatus("Lekérés folyamatban…", "ok");
    try {
        const { stateOfCharge, keyExpiresAt } = await fetchBatteryPercentage();
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
    baseUrlInput.value = "";
    keyInQueryInput.checked = false;
    showStatus("A tárolt adatok törölve.", "ok");
});
