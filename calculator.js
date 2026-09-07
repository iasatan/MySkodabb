const BATTERY_KWH = 25.7;
const FUEL_L_PER_KM = 6 / 100;
const EV_KWH_PER_KM = 18 / 100;
const CHARGING_EFFICIENCY = 0.9;

const form = document.getElementById("calc-form");
const resultBox = document.getElementById("result");

const huf = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 });

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fuelPrice = Number(document.getElementById("fuelPrice").value);
    const elecPrice = Number(document.getElementById("elecPrice").value);
    const battery = Number(document.getElementById("battery").value);
    const distance = Number(document.getElementById("distance").value);

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

function calculate({ fuelPrice, elecPrice, battery, distance }) {
    const stored = BATTERY_KWH * (battery / 100);
    const evRange = stored / EV_KWH_PER_KM;
    const neededKwh = distance * EV_KWH_PER_KM;
    const deficitKwh = Math.max(0, neededKwh - stored);
    const deficitKm = deficitKwh / EV_KWH_PER_KM;

    // A töltéshez a hálózatból a veszteség miatt több energiát kell vennünk.
    const gridKwh = deficitKwh / CHARGING_EFFICIENCY;
    const chargeCost = gridKwh * elecPrice;
    const fuelLitres = deficitKm * FUEL_L_PER_KM;
    const fuelCost = fuelLitres * fuelPrice;

    const evCostPerKm = (EV_KWH_PER_KM / CHARGING_EFFICIENCY) * elecPrice;
    const fuelCostPerKm = FUEL_L_PER_KM * fuelPrice;
    const breakEvenElecPrice = fuelCostPerKm / (EV_KWH_PER_KM / CHARGING_EFFICIENCY);
    const breakEvenFuelPrice = evCostPerKm / FUEL_L_PER_KM;

    const fullChargeKwh = (BATTERY_KWH - stored) / CHARGING_EFFICIENCY;

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
        fullChargeCost: fullChargeKwh * elecPrice,
        savings: fuelCost - chargeCost
    };
}

function render(r) {
    const chargeIsBetter = r.evCostPerKm < r.fuelCostPerKm;
    const enoughRange = r.deficitKwh === 0;

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
