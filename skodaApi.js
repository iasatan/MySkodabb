const SKODA_STORAGE_KEY = "skoda-utility-settings";
const SKODA_DEFAULT_BASE_URL = "https://public.api.connect.skoda-auto.cz";

function loadSkodaSettings() {
    try {
        const raw = localStorage.getItem(SKODA_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            apiKey: parsed.apiKey || "",
            vin: parsed.vin || "",
            baseUrl: parsed.baseUrl || SKODA_DEFAULT_BASE_URL,
            keyInQuery: parsed.keyInQuery === true
        };
    } catch {
        return { apiKey: "", vin: "", baseUrl: SKODA_DEFAULT_BASE_URL, keyInQuery: false };
    }
}

function trimTrailingSlashes(value) {
    let end = value.length;
    while (end > 0 && value[end - 1] === "/") {
        end--;
    }
    return value.slice(0, end);
}

function saveSkodaSettings({ apiKey, vin, baseUrl, keyInQuery }) {
    localStorage.setItem(
        SKODA_STORAGE_KEY,
        JSON.stringify({
            apiKey: (apiKey || "").trim(),
            vin: (vin || "").trim().toUpperCase(),
            baseUrl: trimTrailingSlashes((baseUrl || "").trim()) || SKODA_DEFAULT_BASE_URL,
            keyInQuery: keyInQuery === true
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
