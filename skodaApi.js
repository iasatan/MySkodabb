const SKODA_STORAGE_KEY = "skoda-utility-settings";
const SKODA_CACHE_KEY = "skoda-utility-vehicle-cache";
const SKODA_DEMO_CACHE_KEY = "skoda-utility-demo-cache";
const SKODA_CONSUMPTION_KEY = "myskodabb.consumption.v1";
// Egy órán belül minden oldal és funkció ugyanazt a járműadat-cache-t használja.
const SKODA_CACHE_TTL_MS = 60 * 60 * 1000;
const SKODA_WORKER_BASE_URL = "https://skoda-api-proxy.satanadam.workers.dev";
const DEFAULT_BATTERY_KWH = 25.7;
const DEFAULT_FUEL_L_PER_100_KM = 6;
const DEFAULT_FUEL_TANK_LITRES = 45;
const DEFAULT_EV_KWH_PER_100_KM = 18;
const DEFAULT_LANGUAGE = "en";
const DEFAULT_CURRENCY = "HUF";

const SUPPORTED_LANGUAGES = [
    { code: "hu", name: "Magyar" },
    { code: "en", name: "English" }
];

const SUPPORTED_CURRENCIES = [
    { code: "HUF", name: "Forint" },
    { code: "EUR", name: "Euró" },
    { code: "PLN", name: "Zloty" },
    { code: "CZK", name: "Cseh korona" },
    { code: "RON", name: "Román lej" },
    { code: "BGN", name: "Bolgár leva" },
    { code: "SEK", name: "Svéd korona" },
    { code: "CHF", name: "Svájci frank" },
    { code: "GBP", name: "Font sterling" }
];

function positiveNumberOrDefault(value, defaultValue) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : defaultValue;
}

function supportedOrDefault(value, list, defaultValue) {
    return list.some((item) => item.code === value) ? value : defaultValue;
}

function loadSkodaSettings() {
    try {
        const raw = localStorage.getItem(SKODA_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            apiKey: parsed.apiKey || "",
            vin: parsed.vin || "",
            homeAddress: parsed.homeAddress || "",
            baseUrl: SKODA_WORKER_BASE_URL,
            keyInQuery: true,
            batteryKwh: positiveNumberOrDefault(parsed.batteryKwh, DEFAULT_BATTERY_KWH),
            fuelLitresPer100Km: positiveNumberOrDefault(parsed.fuelLitresPer100Km, DEFAULT_FUEL_L_PER_100_KM),
            fuelTankLitres: positiveNumberOrDefault(parsed.fuelTankLitres, DEFAULT_FUEL_TANK_LITRES),
            evKwhPer100Km: positiveNumberOrDefault(parsed.evKwhPer100Km, DEFAULT_EV_KWH_PER_100_KM),
            language: supportedOrDefault(parsed.language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE),
            currency: supportedOrDefault(parsed.currency, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY)
        };
    } catch {
        return {
            apiKey: "",
            vin: "",
            homeAddress: "",
            baseUrl: SKODA_WORKER_BASE_URL,
            keyInQuery: true,
            batteryKwh: DEFAULT_BATTERY_KWH,
            fuelLitresPer100Km: DEFAULT_FUEL_L_PER_100_KM,
            fuelTankLitres: DEFAULT_FUEL_TANK_LITRES,
            evKwhPer100Km: DEFAULT_EV_KWH_PER_100_KM,
            language: DEFAULT_LANGUAGE,
            currency: DEFAULT_CURRENCY
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

function saveSkodaSettings({ apiKey, vin, homeAddress, batteryKwh, fuelLitresPer100Km, fuelTankLitres, evKwhPer100Km, language, currency }) {
    localStorage.setItem(
        SKODA_STORAGE_KEY,
        JSON.stringify({
            apiKey: (apiKey || "").trim(),
            vin: (vin || "").trim().toUpperCase(),
            homeAddress: (homeAddress || "").trim(),
            baseUrl: SKODA_WORKER_BASE_URL,
            keyInQuery: true,
            batteryKwh: positiveNumberOrDefault(batteryKwh, DEFAULT_BATTERY_KWH),
            fuelLitresPer100Km: positiveNumberOrDefault(fuelLitresPer100Km, DEFAULT_FUEL_L_PER_100_KM),
            fuelTankLitres: positiveNumberOrDefault(fuelTankLitres, DEFAULT_FUEL_TANK_LITRES),
            evKwhPer100Km: positiveNumberOrDefault(evKwhPer100Km, DEFAULT_EV_KWH_PER_100_KM),
            language: supportedOrDefault(language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE),
            currency: supportedOrDefault(currency, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY)
        })
    );
}

function clearSkodaSettings() {
    localStorage.removeItem(SKODA_STORAGE_KEY);
    localStorage.removeItem(SKODA_CACHE_KEY);
    localStorage.removeItem(SKODA_DEMO_CACHE_KEY);
}

function readCachedVehicle(vin, cacheKey = SKODA_CACHE_KEY) {
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (!cached || cached.vin !== vin) {
            return null;
        }
        return Date.now() - cached.fetchedAt < SKODA_CACHE_TTL_MS ? cached : null;
    } catch {
        return null;
    }
}

function writeCachedVehicle(vin, data, cacheKey = SKODA_CACHE_KEY) {
    const entry = { vin, data, fetchedAt: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    return entry;
}

function loadConsumptionReadings() {
    const raw = localStorage.getItem(SKODA_CONSUMPTION_KEY);
    if (raw === null) return [];
    const saved = JSON.parse(raw);
    const validNumber = value => value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
    if (saved?.version !== 1 || !Array.isArray(saved.readings) || saved.readings.some(reading =>
        !reading || !isValidVin(reading.vin) || !Number.isFinite(reading.fetchedAt) ||
        reading.fetchedAt <= 0 || !Number.isFinite(new Date(reading.fetchedAt).getTime()) ||
        !["electric", "fuel", "odometerKm", "stateOfCharge", "electricRangeKm", "fuelLevelPercent", "fuelRangeKm", "batteryKwh", "fuelTankLitres"].every(key => validNumber(reading[key])) ||
        (reading.electric === null && reading.fuel === null))) {
        throw new Error("Invalid consumption history");
    }
    return saved.readings;
}

function saveConsumptionReading(entry, settings) {
    const vehicle = summarizeVehicle(entry.data);
    const percent = value => value !== null && value >= 0 && value <= 100;
    const electric = percent(vehicle.stateOfCharge) && vehicle.electricRangeKm > 0
        ? settings.batteryKwh * vehicle.stateOfCharge / vehicle.electricRangeKm : null;
    const fuel = percent(vehicle.fuelLevelPercent) && vehicle.fuelRangeKm > 0
        ? settings.fuelTankLitres * vehicle.fuelLevelPercent / vehicle.fuelRangeKm : null;
    if (electric === null && fuel === null) return;
    const readings = loadConsumptionReadings();
    if (readings.some(reading => reading.vin === settings.vin && reading.fetchedAt === entry.fetchedAt)) return;
    readings.push({ vin: settings.vin, fetchedAt: entry.fetchedAt, electric, fuel,
        odometerKm: vehicle.odometerKm, stateOfCharge: vehicle.stateOfCharge,
        electricRangeKm: vehicle.electricRangeKm, fuelLevelPercent: vehicle.fuelLevelPercent,
        fuelRangeKm: vehicle.fuelRangeKm, batteryKwh: settings.batteryKwh, fuelTankLitres: settings.fuelTankLitres });
    readings.sort((first, second) => second.fetchedAt - first.fetchedAt);
    localStorage.setItem(SKODA_CONSUMPTION_KEY, JSON.stringify({ version: 1, readings }));
}

function recordConsumption(entry, settings) {
    try {
        saveConsumptionReading(entry, settings);
        return null;
    } catch {
        return "consumption_save_failed";
    }
}

function isDemoMode(settings = loadSkodaSettings()) {
    return !settings.apiKey || !settings.vin;
}

function fetchDemoVehicle({ forceRefresh = false } = {}) {
    const cached = readCachedVehicle("DEMO", SKODA_DEMO_CACHE_KEY);
    if (cached && !forceRefresh) {
        return { ...cached, fromCache: true, demo: true };
    }

    const settings = loadSkodaSettings();
    const randomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const stateOfCharge = randomInteger(20, 90);
    const fuelLevel = randomInteger(25, 95);
    const data = {
        vehicle: {
            name: "Škoda Superb iV (Demo)",
            licensePlate: "DEMO-001",
            vin: "DEMO",
            status: { overall: { doorsLocked: "YES", lights: "OFF" } },
            odometer: { odometerInKm: randomInteger(10000, 80000) },
            fuelStatus: {
                primaryEngineRange: {
                    currentFuelLevelInPercent: fuelLevel,
                    remainingRangeInKm: Math.round(settings.fuelTankLitres * fuelLevel / settings.fuelLitresPer100Km)
                }
            },
            charging: {
                status: {
                    state: "READY_FOR_CHARGING",
                    battery: {
                        stateOfChargeInPercent: stateOfCharge,
                        remainingCruisingRangeInKm: Math.round(settings.batteryKwh * stateOfCharge / settings.evKwhPer100Km)
                    }
                },
                settings: { targetStateOfChargeInPercent: 80 }
            },
            airConditioning: { state: "OFF" },
            parkingPosition: {
                latitude: 47.4979 + randomInteger(-20, 20) / 10000,
                longitude: 19.0402 + randomInteger(-20, 20) / 10000,
                carCapturedTimestamp: new Date().toISOString()
            }
        }
    };
    const entry = writeCachedVehicle("DEMO", data, SKODA_DEMO_CACHE_KEY);
    return { ...entry, fromCache: false, demo: true };
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

async function fetchVehicle({ forceRefresh = false, cachedOnly = false } = {}) {
    const settings = loadSkodaSettings();

    if (isDemoMode(settings)) {
        return fetchDemoVehicle({ forceRefresh: forceRefresh && !cachedOnly });
    }
    if (!isValidVin(settings.vin)) {
        throw new Error("A VIN formátuma érvénytelen (17 karakter).");
    }

    const cached = readCachedVehicle(settings.vin);
    if (cached) {
        return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true,
            consumptionStorageError: recordConsumption(cached, settings) };
    }

    if (cachedOnly) {
        throw new Error("Nincs érvényes, elcachelt autóadat. Előbb kérj le friss adatot.");
    }

    const response = await requestVehicle(settings);
    if (!response.ok) {
        throw await toApiError(response);
    }

    const data = await response.json();
    const entry = writeCachedVehicle(settings.vin, data);

    return {
        data,
        fetchedAt: entry.fetchedAt,
        fromCache: false,
        consumptionStorageError: recordConsumption(entry, settings),
        keyExpiresAt: response.headers.get("X-API-Key-Expires-At"),
        remainingRequests: response.headers.get("RateLimit-Remaining")
    };
}

function firstNumber(...candidates) {
    const value = candidates.find((v) => typeof v === "number" && Number.isFinite(v));
    return value === undefined ? null : value;
}

function summarizeVehicle(data) {
    const vehicle = data?.vehicle ?? data;
    const position = vehicle?.parkingPosition;
    const latitude = firstNumber(position?.latitude, position?.lat, position?.gpsCoordinates?.latitude);
    const longitude = firstNumber(position?.longitude, position?.lng, position?.gpsCoordinates?.longitude);

    return {
        name: vehicle?.name || null,
        licensePlate: vehicle?.licensePlate || null,
        vin: vehicle?.vin || null,
        doorsLocked: vehicle?.status?.overall?.doorsLocked || null,
        lights: vehicle?.status?.overall?.lights || null,
        odometerKm: firstNumber(vehicle?.odometer?.odometerInKm, vehicle?.odometer?.mileageInKm),
        fuelLevelPercent: firstNumber(
            vehicle?.fuelStatus?.primaryEngineRange?.currentFuelLevelInPercent,
            vehicle?.fuelStatus?.primaryEngineRange?.currentSoCInPercent,
            vehicle?.fuelStatus?.currentFuelLevelInPercent
        ),
        fuelRangeKm: firstNumber(
            vehicle?.fuelStatus?.primaryEngineRange?.remainingRangeInKm,
            vehicle?.fuelStatus?.totalRangeInKm
        ),
        stateOfCharge: extractStateOfCharge(data),
        electricRangeKm: firstNumber(
            vehicle?.charging?.status?.battery?.remainingCruisingRangeInMeters / 1000,
            vehicle?.charging?.status?.battery?.remainingCruisingRangeInKm
        ),
        chargingState: vehicle?.charging?.status?.state || null,
        targetSoc: firstNumber(vehicle?.charging?.settings?.targetStateOfChargeInPercent),
        parkingPosition: latitude !== null && longitude !== null ? { latitude, longitude } : null,
        parkedAt: position?.carCapturedTimestamp || null,
        errors: describeVehicleErrors(data)
    };
}

async function fetchBatteryPercentage(options) {
    const result = await fetchVehicle(options);
    const soc = extractStateOfCharge(result.data);
    if (soc === null) {
        const reason = describeVehicleErrors(result.data);
        throw new Error(
            reason
                ? `A töltöttség most nem érhető el (${reason}).`
                : "A válaszban nem található töltöttségi érték."
        );
    }
    return { ...result, stateOfCharge: soc };
}

async function setChargingLimit(targetPercent) {
    const settings = loadSkodaSettings();

    if (!isDemoMode(settings) && !isValidVin(settings.vin)) {
        throw new Error("A VIN formátuma érvénytelen (17 karakter).");
    }

    const target = Math.round(targetPercent);
    if (!Number.isFinite(target) || target < 0 || target > 100) {
        throw new Error("A cél töltöttség 0 és 100% között lehet.");
    }

    if (isDemoMode(settings)) {
        const { data } = fetchDemoVehicle();
        data.vehicle.charging.settings.targetStateOfChargeInPercent = target;
        writeCachedVehicle("DEMO", data, SKODA_DEMO_CACHE_KEY);
        return target;
    }

    const url = new URL(`${settings.baseUrl}/api/v1/vehicles/${encodeURIComponent(settings.vin)}/charging/limit`);
    url.searchParams.set("apiKey", settings.apiKey);

    const response = await fetch(url.toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStateOfChargeInPercent: target })
    });

    if (!response.ok) {
        throw await toApiError(response);
    }
    return target;
}

async function setAirConditioning(action, configuration) {
    const settings = loadSkodaSettings();

    if (!isDemoMode(settings) && !isValidVin(settings.vin)) {
        throw new Error("A VIN formátuma érvénytelen (17 karakter).");
    }
    if (action !== "start" && action !== "stop") {
        throw new Error("Érvénytelen klímavezérlési művelet.");
    }

    const request = { method: "POST" };

    if (action === "start") {
        const temperature = Number(configuration?.targetTemperature?.value);
        if (!Number.isFinite(temperature)) {
            throw new Error("Adj meg érvényes célhőmérsékletet.");
        }
        request.headers = { "Content-Type": "application/json" };
        request.body = JSON.stringify({
            targetTemperature: { value: temperature, unit: "CELSIUS" },
            airConditioningWithoutExternalPower: Boolean(configuration.airConditioningWithoutExternalPower)
        });
    }

    if (isDemoMode(settings)) {
        const { data } = fetchDemoVehicle();
        data.vehicle.airConditioning = {
            state: action === "start" ? "ON" : "OFF",
            ...(action === "start" ? JSON.parse(request.body) : {})
        };
        writeCachedVehicle("DEMO", data, SKODA_DEMO_CACHE_KEY);
        return;
    }

    const url = new URL(`${settings.baseUrl}/api/v1/vehicles/${encodeURIComponent(settings.vin)}/air-conditioning/${action}`);
    url.searchParams.set("apiKey", settings.apiKey);
    const response = await fetch(url.toString(), request);
    if (!response.ok) {
        throw await toApiError(response);
    }
}
