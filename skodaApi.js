const SKODA_STORAGE_KEY = "skoda-utility-settings";
const SKODA_WORKER_BASE_URL = "https://skoda-api-proxy.satanadam.workers.dev";
const DEFAULT_BATTERY_KWH = 25.7;
const DEFAULT_FUEL_L_PER_100_KM = 6;
const DEFAULT_EV_KWH_PER_100_KM = 18;

function positiveNumberOrDefault(value, defaultValue) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : defaultValue;
}

function loadSkodaSettings() {
    try {
        const raw = localStorage.getItem(SKODA_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            apiKey: parsed.apiKey || "",
            vin: parsed.vin || "",
            baseUrl: SKODA_WORKER_BASE_URL,
            keyInQuery: true,
            batteryKwh: positiveNumberOrDefault(parsed.batteryKwh, DEFAULT_BATTERY_KWH),
            fuelLitresPer100Km: positiveNumberOrDefault(parsed.fuelLitresPer100Km, DEFAULT_FUEL_L_PER_100_KM),
            evKwhPer100Km: positiveNumberOrDefault(parsed.evKwhPer100Km, DEFAULT_EV_KWH_PER_100_KM)
        };
    } catch {
        return {
            apiKey: "",
            vin: "",
            baseUrl: SKODA_WORKER_BASE_URL,
            keyInQuery: true,
            batteryKwh: DEFAULT_BATTERY_KWH,
            fuelLitresPer100Km: DEFAULT_FUEL_L_PER_100_KM,
            evKwhPer100Km: DEFAULT_EV_KWH_PER_100_KM
        };
    }
}

function trimTrailingSlashes(value) {
    let end = value.length;
    while (end > 0 && value[end - 1] === "/") {
        end--;
    }
    return value.slice(0, end);
}

function saveSkodaSettings({ apiKey, vin, batteryKwh, fuelLitresPer100Km, evKwhPer100Km }) {
    localStorage.setItem(
        SKODA_STORAGE_KEY,
        JSON.stringify({
            apiKey: (apiKey || "").trim(),
            vin: (vin || "").trim().toUpperCase(),
            baseUrl: SKODA_WORKER_BASE_URL,
            keyInQuery: true,
            batteryKwh: positiveNumberOrDefault(batteryKwh, DEFAULT_BATTERY_KWH),
            fuelLitresPer100Km: positiveNumberOrDefault(fuelLitresPer100Km, DEFAULT_FUEL_L_PER_100_KM),
            evKwhPer100Km: positiveNumberOrDefault(evKwhPer100Km, DEFAULT_EV_KWH_PER_100_KM)
        })
    );
}

function clearSkodaSettings() {
    localStorage.removeItem(SKODA_STORAGE_KEY);
}

function isValidVin(vin) {
    return /^[A-HJ-NPR-Z0-9]{17}$/.test((vin || "").trim().toUpperCase());
}

function extractStateOfCharge(data) {
    const vehicle = data?.vehicle ?? data;
    const candidates = [
        vehicle?.charging?.status?.battery?.stateOfChargeInPercent,
        vehicle?.charging?.status?.battery?.stateOfCharge,
        vehicle?.charging?.battery?.stateOfChargeInPercent
    ];
    const value = candidates.find((v) => typeof v === "number" && Number.isFinite(v));
    return value === undefined ? null : value;
}

// A 200-as válasz is tartalmazhat hibalistát, ha egy adatrész nem érhető el.
function describeVehicleErrors(data) {
    const errors = data?.errors;
    if (!Array.isArray(errors) || errors.length === 0) {
        return "";
    }
    return errors.map((e) => e?.type || e?.description).filter(Boolean).join(", ");
}

async function readProblemMessage(response) {
    try {
        const problem = await response.json();
        return problem?.detail || problem?.title || problem?.type || "";
    } catch {
        return "";
    }
}

async function toApiError(response) {
    const detail = await readProblemMessage(response);
    const suffix = detail ? ` – ${detail}` : "";
    const messages = {
        401: `Az API kulcs lejárt vagy érvénytelen${suffix}`,
        403: `Ez a kulcs nem jogosult erre a járműre${suffix}`,
        404: `Ez a VIN nem található${suffix}`
    };
    if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const wait = retryAfter ? ` Próbáld újra ${retryAfter} másodperc múlva.` : "";
        return new Error(`Túllépted a limitet (20 kérés/óra VIN-enként).${wait}`);
    }
    return new Error(messages[response.status] || `Az API hibát adott vissza (HTTP ${response.status})${suffix}`);
}

// A kulcs query paraméterben nem vált ki CORS preflightot; a preflight OPTIONS
// ugyanis soha nem viszi magával az X-API-Key fejlécet, ezért 401-gyel bukna el.
async function requestVehicle({ apiKey, vin, baseUrl, keyInQuery }) {
    const url = new URL(`${baseUrl}/api/v1/vehicles/${encodeURIComponent(vin)}`);
    url.searchParams.set("include", "charging");

    if (keyInQuery) {
        url.searchParams.set("apiKey", apiKey);
        return await fetch(url.toString());
    }

    return await fetch(url.toString(), {
        headers: {
            "X-API-Key": apiKey
        }
    });
}

async function fetchBatteryPercentage() {
    const settings = loadSkodaSettings();

    if (!settings.apiKey || !settings.vin) {
        throw new Error("Hiányzik az API kulcs vagy a VIN. Töltsd ki a Beállítások oldalon.");
    }
    if (!isValidVin(settings.vin)) {
        throw new Error("A VIN formátuma érvénytelen (17 karakter).");
    }

    const response = await requestVehicle(settings);
    if (!response.ok) {
        throw await toApiError(response);
    }

    const data = await response.json();
    const soc = extractStateOfCharge(data);
    if (soc === null) {
        const reason = describeVehicleErrors(data);
        throw new Error(
            reason
                ? `A töltöttség most nem érhető el (${reason}).`
                : "A válaszban nem található töltöttségi érték."
        );
    }

    return {
        stateOfCharge: soc,
        keyExpiresAt: response.headers.get("X-API-Key-Expires-At"),
        remainingRequests: response.headers.get("RateLimit-Remaining")
    };
}

async function setChargingLimit(targetPercent) {
    const settings = loadSkodaSettings();

    if (!settings.apiKey || !settings.vin) {
        throw new Error("Hiányzik az API kulcs vagy a VIN. Töltsd ki a Beállítások oldalon.");
    }
    if (!isValidVin(settings.vin)) {
        throw new Error("A VIN formátuma érvénytelen (17 karakter).");
    }

    const target = Math.round(targetPercent);
    if (!Number.isFinite(target) || target < 0 || target > 100) {
        throw new Error("A cél töltöttség 0 és 100% között lehet.");
    }

    const url = new URL(`${settings.baseUrl}/api/v1/vehicles/${encodeURIComponent(settings.vin)}/charging/limit`);
    url.searchParams.set("apiKey", settings.apiKey);

    const response = await fetch(url.toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSOCInPercent: target })
    });

    if (!response.ok) {
        throw await toApiError(response);
    }
    return target;
}
