const climateForm = document.getElementById("climate-form");
const targetTemperatureInput = document.getElementById("target-temperature");
const withoutExternalPowerInput = document.getElementById("without-external-power");
const startClimateButton = document.getElementById("start-climate");
const stopClimateButton = document.getElementById("stop-climate");
const climateStatus = document.getElementById("climate-status");

function setControlsDisabled(disabled) {
    startClimateButton.disabled = disabled;
    stopClimateButton.disabled = disabled;
    targetTemperatureInput.disabled = disabled;
    withoutExternalPowerInput.disabled = disabled;
}

async function runClimateAction(action) {
    setControlsDisabled(true);
    climateStatus.className = "climate-status hint";
    climateStatus.textContent = t("climate_requesting");

    try {
        const configuration = action === "start" ? {
            targetTemperature: { value: targetTemperatureInput.value },
            airConditioningWithoutExternalPower: withoutExternalPowerInput.checked
        } : undefined;
        await setAirConditioning(action, configuration);
        climateStatus.className = "climate-status success";
        climateStatus.textContent = t(action === "start" ? "climate_started" : "climate_stopped");
    } catch (error) {
        climateStatus.className = "climate-status error";
        climateStatus.textContent = error.message;
    } finally {
        setControlsDisabled(false);
    }
}

climateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runClimateAction("start");
});

stopClimateButton.addEventListener("click", () => runClimateAction("stop"));