"use strict";

Object.assign(TRANSLATIONS.en, {
    stats_clear_saved: "Clear saved data", stats_saved: "Saved on this device.",
    stats_restored: "{name} · {count} trips restored from this device · {skipped} invalid rows skipped on import.",
    stats_save_failed: "Could not save this upload on this device. It is available for this session only; any previously saved data remains unchanged.",
    stats_restore_failed: "Saved trip data could not be loaded. Upload a CSV to replace it, or clear the saved data.",
    stats_clear_failed: "Could not clear saved trip data. Your data remains unchanged.",
    stats_factors: "Consumption by factor", stats_factor: "Factor", stats_end_hour: "Trip-end time of day",
    stats_fuel_use: "Fuel use", stats_all_trips: "All trips", stats_no_fuel: "No fuel used", stats_with_fuel: "Fuel used",
    stats_electric_coverage: "km with electric data", stats_fuel_coverage: "km with fuel data",
    stats_factor_status: "{count} trips · {distance} km", stats_factor_empty: "No matching trips in this date range.",
    stats_factor_method: "Averages are distance-weighted within each group. Empty groups or missing measurements have no consumption value. Speed is the exported trip average; time of day is the recorded trip-end time. No-fuel/fuel-used groups require recorded fuel consumption. These are observed patterns, not isolated effects of a single factor.",
    stats_title: "Trip statistics", stats_upload: "Upload trip CSV", stats_empty: "No file selected.",
    stats_from: "From", stats_to: "To", stats_reset: "All dates", stats_trips: "Trips", stats_distance: "Distance",
    stats_time: "Driving time", stats_speed: "Average speed", stats_electric: "Electric consumption", stats_fuel: "Fuel consumption",
    stats_active_days: "Active days", stats_electric_only: "Distance without fuel", stats_monthly_distance: "Monthly distance",
    stats_monthly_consumption: "Monthly consumption", stats_lengths: "Trip lengths", stats_costs: "Costs",
    stats_monthly: "Monthly overview", stats_month: "Month", stats_cost: "Cost", stats_trip_details: "Trip details",
    stats_search: "Search trips", stats_sort: "Sort by", stats_newest: "Newest first", stats_longest: "Longest first", stats_duration: "Longest duration",
    stats_trip_end: "End of trip", stats_previous: "Previous page", stats_next: "Next page", stats_page: "{start}–{end} of {count}",
    stats_loaded: "{name} · {count} trips · {skipped} invalid rows skipped. File processed locally, not uploaded to a server.",
    stats_filtered: "{count} trips · {from} – {to}", stats_no_trips: "No trips in this date range.", stats_invalid_range: "The start date must not be after the end date.",
    stats_reading: "Reading CSV…", stats_error_columns: "Missing required columns: End of trip, Mileage in km, Travel time in minutes.",
    stats_error_malformed: "The CSV is malformed. Please upload an original trip export.", stats_error_empty: "No valid trips found in this file.",
    stats_error_file: "Could not read the file. Please select a CSV file up to 10 MB.", stats_total: "Total", stats_per_km: "Cost per km",
    stats_missing_costs: "{count} trips have no recorded cost.", stats_unknown: "Not recorded", stats_no_costs: "No recorded costs.",
    stats_method: "Consumption averages are distance-weighted. Energy and fuel totals are estimated from rounded trip distance and consumption. Negative electric consumption is retained. Cost per km includes only trips with recorded costs; currencies are kept separate. Distance without fuel includes only trips with recorded zero fuel consumption. All exported trips are included, even if odometer ranges overlap.",
    stats_longest_note: "Longest: {value} km", stats_average_note: "Average: {value} km/trip", stats_energy_note: "{value} kWh estimated",
    stats_fuel_note: "{value} l estimated", stats_days_note: "{value} km/active day", stats_known_distance: "Of distance with recorded fuel use"
});
Object.assign(TRANSLATIONS.hu, {
    stats_clear_saved: "Mentett adatok törlése", stats_saved: "Mentve ezen az eszközön.",
    stats_restored: "{name} · {count} utazás visszaállítva erről az eszközről · {skipped} hibás sor kihagyva az importáláskor.",
    stats_save_failed: "A feltöltés nem menthető ezen az eszközön. Csak ebben a munkamenetben érhető el; a korábban mentett adatok változatlanok.",
    stats_restore_failed: "A mentett utazási adatok nem tölthetők be. Tölts fel CSV-t a cseréhez, vagy töröld a mentett adatokat.",
    stats_clear_failed: "A mentett adatok nem törölhetők. Az adatok változatlanok.",
    stats_factors: "Fogyasztás tényezők szerint", stats_factor: "Tényező", stats_end_hour: "Utazás végének napszaka",
    stats_fuel_use: "Benzinhasználat", stats_all_trips: "Összes utazás", stats_no_fuel: "Benzin nélkül", stats_with_fuel: "Benzinhasználattal",
    stats_electric_coverage: "km elektromos adattal", stats_fuel_coverage: "km üzemanyag-adattal",
    stats_factor_status: "{count} utazás · {distance} km", stats_factor_empty: "Nincs megfelelő utazás ebben az időszakban.",
    stats_factor_method: "Az átlagok csoportonként távolsággal súlyozottak. Üres csoportoknál vagy hiányzó mérésnél nincs fogyasztási érték. A sebesség az exportált utazási átlag; a napszak a rögzített befejezési időből származik. A benzines és benzin nélküli csoportokhoz rögzített üzemanyag-fogyasztás szükséges. Ezek megfigyelt összefüggések, nem egyetlen tényező elkülönített hatásai.",
    stats_title: "Utazási statisztikák", stats_upload: "Utazási CSV feltöltése", stats_empty: "Nincs kiválasztott fájl.",
    stats_from: "Ettől", stats_to: "Eddig", stats_reset: "Összes dátum", stats_trips: "Utazások", stats_distance: "Távolság",
    stats_time: "Menetidő", stats_speed: "Átlagsebesség", stats_electric: "Elektromos fogyasztás", stats_fuel: "Üzemanyag-fogyasztás",
    stats_active_days: "Aktív napok", stats_electric_only: "Benzin nélküli távolság", stats_monthly_distance: "Havi távolság",
    stats_monthly_consumption: "Havi fogyasztás", stats_lengths: "Utazások hossza", stats_costs: "Költségek",
    stats_monthly: "Havi összesítő", stats_month: "Hónap", stats_cost: "Költség", stats_trip_details: "Utazások részletei",
    stats_search: "Utazások keresése", stats_sort: "Rendezés", stats_newest: "Legújabb elöl", stats_longest: "Leghosszabb elöl", stats_duration: "Leghosszabb menetidő",
    stats_trip_end: "Utazás vége", stats_previous: "Előző oldal", stats_next: "Következő oldal", stats_page: "{start}–{end} / {count}",
    stats_loaded: "{name} · {count} utazás · {skipped} hibás sor kihagyva. Helyi feldolgozás, a fájl nem kerül szerverre.",
    stats_filtered: "{count} utazás · {from} – {to}", stats_no_trips: "Nincs utazás ebben az időszakban.", stats_invalid_range: "A kezdő dátum nem lehet későbbi a záró dátumnál.",
    stats_reading: "CSV beolvasása…", stats_error_columns: "Hiányzó kötelező oszlopok: End of trip, Mileage in km, Travel time in minutes.",
    stats_error_malformed: "Hibás CSV. Töltsd fel az eredeti utazási exportot.", stats_error_empty: "A fájlban nincs érvényes utazás.",
    stats_error_file: "A fájl nem olvasható. Válassz legfeljebb 10 MB méretű CSV fájlt.", stats_total: "Összesen", stats_per_km: "Költség kilométerenként",
    stats_missing_costs: "{count} utazás költsége nincs rögzítve.", stats_unknown: "Nincs adat", stats_no_costs: "Nincs rögzített költség.",
    stats_method: "A fogyasztási átlagok távolsággal súlyozottak. Az energia- és üzemanyag-mennyiség a kerekített távolságból és fogyasztásból becsült érték. A negatív elektromos fogyasztás megmarad. A km-költség csak a rögzített költségű utakra vonatkozik; a pénznemek külön szerepelnek. A benzin nélküli távolság csak a rögzített nulla üzemanyag-fogyasztású utakat tartalmazza. Minden exportált út szerepel, akkor is, ha a kilométeróra-tartományok átfedik egymást.",
    stats_longest_note: "Leghosszabb: {value} km", stats_average_note: "Átlag: {value} km/utazás", stats_energy_note: "{value} kWh becsült",
    stats_fuel_note: "{value} l becsült", stats_days_note: "{value} km/aktív nap", stats_known_distance: "A rögzített üzemanyag-fogyasztású távolságból"
});

function factorLabel(group, factor) {
    if (group.lower === null) return t("stats_unknown");
    if (factor === "time") return `${String(group.lower).padStart(2, "0")}:00 - ${String(group.upper).padStart(2, "0")}:00`;
    if (!Number.isFinite(group.upper)) return `${group.lower}+ ${group.unit}`;
    if (group.lower === 0) return `< ${group.upper} ${group.unit}`;
    return `${group.lower} - <${group.upper} ${group.unit}`;
}

document.addEventListener("DOMContentLoaded", () => {
    applyStaticTranslations();
    document.title = `${t("stats_title")} | MySkodabb`;
    document.querySelectorAll("[data-i18n-aria]").forEach(element => element.setAttribute("aria-label", t(element.dataset.i18nAria)));
    const find = id => document.getElementById(id);
    const input = find("csv-file");
    const from = find("date-from");
    const to = find("date-to");
    const status = find("upload-status");
    const storageStatus = find("storage-status");
    const clearSaved = find("clear-saved-trips");
    const storageKey = "myskodabb.tripStatistics.v1";
    delete status.dataset.i18n;
    let trips = [];
    let filtered = [];
    let matchingCount = 0;
    let page = 0;
    let charts = [];
    let factorChart = null;
    const pageSize = 25;
    const number = value => value === null || !Number.isFinite(value) ? "—" : formatNumber(value);
    const date = value => value.toLocaleDateString(getLocale());
    const money = (value, currency) => {
        try { return new Intl.NumberFormat(getLocale(), { style: "currency", currency, maximumFractionDigits: 1 }).format(value); }
        catch { return `${number(value)} ${currency}`; }
    };
    const costs = summary => Object.entries(summary.costs).map(([currency, value]) => money(value.total, currency)).join(" + ") || "—";

    function row(parent, values) {
        const element = document.createElement("tr");
        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            element.append(cell);
        }
        parent.append(element);
    }

    function metric(key, value, note) {
        const element = document.createElement("dl");
        element.className = "statistics-metric";
        const label = document.createElement("dt");
        label.textContent = t(key);
        const content = document.createElement("dd");
        content.textContent = value;
        if (note) {
            const detail = document.createElement("small");
            detail.textContent = note;
            content.append(detail);
        }
        element.append(label, content);
        find("summary-metrics").append(element);
    }

    function chart(id, type, labels, datasets, axes = {}) {
        const canvas = find(id);
        const instance = new Chart(canvas, {
            type, data: { labels, datasets }, options: {
                responsive: true, maintainAspectRatio: false, animation: false, locale: getLocale(),
                plugins: { legend: { display: datasets.length > 1 }, tooltip: { mode: "index", intersect: false } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true }, ...axes }
            }
        });
        const descriptions = labels.map((label, index) => {
            const values = datasets.map(dataset => `${dataset.label} ${number(dataset.data[index])}`).join(", ");
            return `${label}: ${values}`;
        }).join("; ");
        canvas.setAttribute("aria-label", `${canvas.getAttribute("aria-label")}: ${descriptions}`);
        charts.push(instance);
        return instance;
    }

    function renderFactors() {
        const factor = find("consumption-factor").value;
        const groups = TripStatistics.consumptionByFactor(filtered, factor, find("consumption-mode").value);
        const labels = groups.map(group => factorLabel(group, factor));
        const count = groups.reduce((total, group) => total + group.count, 0);
        const distance = groups.reduce((total, group) => total + group.distance, 0);
        find("factor-status").textContent = count ? t("stats_factor_status", { count: number(count), distance: number(distance) }) : t("stats_factor_empty");
        find("factor-column").textContent = find("consumption-factor").selectedOptions[0].textContent;
        find("factor-rows").replaceChildren();
        groups.forEach((group, index) => row(find("factor-rows"), [labels[index], number(group.count), number(group.distance), number(group.electricAverage), number(group.fuelAverage), number(group.electricDistance), number(group.fuelDistance)]));
        if (factorChart) {
            factorChart.destroy();
            charts = charts.filter(instance => instance !== factorChart);
        }
        find("factor-chart").setAttribute("aria-label", t("stats_factors"));
        factorChart = chart("factor-chart", "bar", labels, [
            { label: "kWh/100 km", data: groups.map(group => group.electricAverage), backgroundColor: "#138158", yAxisID: "y", borderRadius: 3 },
            { label: "l/100 km", data: groups.map(group => group.fuelAverage), backgroundColor: "#c16c22", yAxisID: "fuel", borderRadius: 3 }
        ], { y: { beginAtZero: true, title: { display: true, text: "kWh/100 km" } }, fuel: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "l/100 km" } } });
    }

    function renderTrips() {
        const sort = find("trip-sort").value;
        const query = find("trip-search").value.trim().toLocaleLowerCase(getLocale());
        const sorted = filtered.filter(trip => [trip.day, trip.date.toLocaleString(getLocale(), { dateStyle: "short", timeStyle: "short" }), number(trip.distance), number(trip.minutes), number(trip.electric), number(trip.fuel), trip.cost === null ? "" : money(trip.cost, trip.currency)].join(" ").toLocaleLowerCase(getLocale()).includes(query)).sort((first, second) => second[sort] - first[sort]);
        matchingCount = sorted.length;
        find("trip-rows").replaceChildren();
        for (const trip of sorted.slice(page * pageSize, (page + 1) * pageSize)) {
            row(find("trip-rows"), [trip.date.toLocaleString(getLocale(), { dateStyle: "short", timeStyle: "short" }), number(trip.distance), number(trip.minutes), number(trip.electric), number(trip.fuel), trip.cost === null ? "—" : money(trip.cost, trip.currency)]);
        }
        find("page-status").textContent = t("stats_page", { start: matchingCount ? page * pageSize + 1 : 0, end: Math.min((page + 1) * pageSize, matchingCount), count: matchingCount });
        find("previous-page").disabled = page === 0;
        find("next-page").disabled = (page + 1) * pageSize >= matchingCount;
    }

    function renderMetrics(summary) {
        find("summary-metrics").replaceChildren();
        metric("stats_trips", number(summary.count), t("stats_longest_note", { value: number(summary.longest?.distance ?? null) }));
        metric("stats_distance", `${number(summary.distance)} km`, t("stats_average_note", { value: number(summary.count ? summary.distance / summary.count : null) }));
        metric("stats_time", `${number(summary.minutes / 60)} h`);
        metric("stats_speed", `${number(summary.averageSpeed)} km/h`);
        metric("stats_electric", `${number(summary.electricAverage)} kWh/100 km`, t("stats_energy_note", { value: number(summary.electricDistance ? summary.electricEnergy : null) }));
        metric("stats_fuel", `${number(summary.fuelAverage)} l/100 km`, t("stats_fuel_note", { value: number(summary.fuelDistance ? summary.fuelLitres : null) }));
        metric("stats_active_days", number(summary.activeDays.size), t("stats_days_note", { value: number(summary.activeDays.size ? summary.distance / summary.activeDays.size : null) }));
        metric("stats_electric_only", `${number(summary.knownFuelDistance ? summary.electricOnlyDistance / summary.knownFuelDistance * 100 : null)}%`, t("stats_known_distance"));
    }

    function render() {
        page = 0;
        const invalid = from.value && to.value && from.value > to.value;
        filtered = invalid ? [] : trips.filter(trip => (!from.value || trip.day >= from.value) && (!to.value || trip.day <= to.value));
        const filterStatus = find("filter-status");
        filterStatus.classList.toggle("error", Boolean(invalid));
        if (invalid) filterStatus.textContent = t("stats_invalid_range");
        else if (filtered.length) filterStatus.textContent = t("stats_filtered", { count: filtered.length, from: date(filtered.at(-1).date), to: date(filtered[0].date) });
        else filterStatus.textContent = t("stats_no_trips");
        const summary = TripStatistics.summarize(filtered);
        renderMetrics(summary);
        const months = TripStatistics.monthly(filtered);
        find("monthly-rows").replaceChildren();
        for (const month of months) row(find("monthly-rows"), [month.month, number(month.count), number(month.distance), number(month.electricAverage), number(month.fuelAverage), costs(month)]);
        charts.forEach(instance => instance.destroy());
        charts = [];
        factorChart = null;
        document.querySelectorAll("canvas[data-i18n-aria]").forEach(element => element.setAttribute("aria-label", t(element.dataset.i18nAria)));
        chart("distance-chart", "bar", months.map(month => month.month), [{ label: "km", data: months.map(month => month.distance), backgroundColor: "#0e3a2f", borderRadius: 3 }]);
        chart("consumption-chart", "line", months.map(month => month.month), [
            { label: "kWh/100 km", data: months.map(month => month.electricAverage), borderColor: "#138158", backgroundColor: "#138158", yAxisID: "y" },
            { label: "l/100 km", data: months.map(month => month.fuelAverage), borderColor: "#c16c22", backgroundColor: "#c16c22", yAxisID: "fuel" }
        ], { y: { beginAtZero: true, title: { display: true, text: "kWh/100 km" } }, fuel: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "l/100 km" } } });
        chart("length-chart", "bar", ["< 5 km", "5–20 km", "20–50 km", "50–100 km", "100+ km"], [{ label: t("stats_trips"), data: [0, 5, 20, 50, 100].map((limit, index, limits) => filtered.filter(trip => trip.distance >= limit && trip.distance < (limits[index + 1] ?? Infinity)).length), backgroundColor: "#5683a5", borderRadius: 3 }], { y: { beginAtZero: true, ticks: { precision: 0 } } });
        renderFactors();
        find("cost-summary").replaceChildren();
        for (const [currency, value] of Object.entries(summary.costs)) {
            for (const [label, amount] of [[`${t("stats_total")} (${currency})`, money(value.total, currency)], [t("stats_per_km"), value.distance ? `${money(value.total / value.distance, currency)}/km` : "—"]]) {
                const line = document.createElement("div");
                line.className = "cost-line";
                const title = document.createElement("span");
                title.textContent = label;
                const total = document.createElement("strong");
                total.textContent = amount;
                line.append(title, total);
                find("cost-summary").append(line);
            }
        }
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = Object.keys(summary.costs).length ? t("stats_missing_costs", { count: summary.missingCosts }) : t("stats_no_costs");
        find("cost-summary").append(note);
        renderTrips();
    }

    function showDataset(dataset, restored = false) {
        trips = dataset.trips;
        from.value = trips.at(-1).day;
        to.value = trips[0].day;
        status.classList.remove("error");
        status.textContent = t(restored ? "stats_restored" : "stats_loaded", { name: dataset.name, count: trips.length, skipped: dataset.skipped });
        find("statistics-results").hidden = false;
        clearSaved.hidden = false;
        render();
    }

    function saveDataset(dataset) {
        storageStatus.classList.remove("error");
        try {
            localStorage.setItem(storageKey, TripStatistics.serializeTrips(dataset.name, dataset));
            storageStatus.textContent = t("stats_saved");
        } catch {
            storageStatus.classList.add("error");
            storageStatus.textContent = t("stats_save_failed");
        }
    }

    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        status.classList.remove("error");
        status.textContent = t("stats_reading");
        find("statistics-results").hidden = true;
        input.disabled = true;
        try {
            if (file.size > 10 * 1024 * 1024 || !/\.csv$/i.test(file.name)) throw new Error("file");
            const parsed = TripStatistics.readTrips(await file.text(), Papa);
            const dataset = { name: file.name, ...parsed };
            showDataset(dataset);
            saveDataset(dataset);
        } catch (error) {
            status.classList.add("error");
            status.textContent = t(`stats_error_${["columns", "malformed", "empty"].includes(error.message) ? error.message : "file"}`);
            find("statistics-results").hidden = !trips.length;
        } finally {
            input.disabled = false;
            input.value = "";
        }
    });
    from.addEventListener("change", render);
    to.addEventListener("change", render);
    find("reset-dates").addEventListener("click", () => { from.value = ""; to.value = ""; render(); });
    find("trip-sort").addEventListener("change", () => { page = 0; renderTrips(); });
    find("trip-search").addEventListener("input", () => { page = 0; renderTrips(); });
    find("consumption-factor").addEventListener("change", renderFactors);
    find("consumption-mode").addEventListener("change", renderFactors);
    find("previous-page").setAttribute("aria-label", t("stats_previous"));
    find("next-page").setAttribute("aria-label", t("stats_next"));
    find("previous-page").addEventListener("click", () => { if (page > 0) { page--; renderTrips(); } });
    find("next-page").addEventListener("click", () => { if ((page + 1) * pageSize < matchingCount) { page++; renderTrips(); } });
    clearSaved.addEventListener("click", () => {
        try {
            localStorage.removeItem(storageKey);
        } catch {
            storageStatus.classList.add("error");
            storageStatus.textContent = t("stats_clear_failed");
            return;
        }
        trips = [];
        filtered = [];
        charts.forEach(instance => instance.destroy());
        charts = [];
        factorChart = null;
        find("statistics-results").hidden = true;
        clearSaved.hidden = true;
        status.classList.remove("error");
        status.textContent = t("stats_empty");
        storageStatus.classList.remove("error");
        storageStatus.textContent = "";
        from.value = "";
        to.value = "";
    });
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
            showDataset(TripStatistics.deserializeTrips(saved), true);
            storageStatus.textContent = t("stats_saved");
        }
    } catch {
        storageStatus.classList.add("error");
        storageStatus.textContent = t("stats_restore_failed");
        clearSaved.hidden = false;
    }
});