const LOCALE_BY_LANGUAGE = { hu: "hu-HU", en: "en-GB" };

const TRANSLATIONS = {
    hu: {
        nav_home: "Kezdőlap",
        nav_calculator: "Töltés kalkulátor",
        nav_settings: "Beállítások",
        footer_disclaimer: "Nem hivatalos, rajongói segédoldal. Škoda Auto a.s. védjegyei a jogtulajdonosé.",
        loading: "Betöltés…",
        refresh: "Frissítés",

        home_title: "Az autóm",
        map_title: "Hol parkol",
        map_open_link: "Megnyitás nagy térképen",
        hero_eyebrow: "Škoda Utility",
        hero_title: "Megéri most tölteni?",
        hero_lead: "Kis eszközgyűjtemény plug-in hibrid Škoda tulajdonosoknak. Számold ki, hogy megéri-e tölteni, vagy olcsóbb hibrid módban menni.",
        hero_cta: "Töltés kalkulátor megnyitása",
        spec_battery_label: "Akkumulátor kapacitás",
        spec_fuel_label: "Fogyasztás hibrid módban",
        spec_ev_label: "Fogyasztás elektromos módban",
        source_car: "(autó)",
        source_settings: "(beállítás)",

        card_name: "Jármű",
        card_plate: "Rendszám",
        card_soc: "Töltöttség",
        card_ev_range: "Elektromos hatótáv",
        card_fuel_level: "Üzemanyagszint",
        card_fuel_range: "Benzines hatótáv",
        card_odometer: "Kilométeróra",
        card_doors: "Ajtók",
        card_charging_state: "Töltés állapota",
        card_charge_limit: "Töltési limit",
        lock_yes: "Zárva",
        lock_no: "Nyitva",
        charging_charging: "Töltés alatt",
        charging_connect_cable: "Kábel nincs csatlakoztatva",
        charging_ready_for_charging: "Töltésre kész",
        charging_conserving: "Töltöttség tartása",
        charging_error: "Hiba",
        source_cache: "gyorsítótárból",
        source_fresh: "friss",
        hint_data: "Adatok {source}, {time}.",
        hint_missing: " Nem elérhető adatok: {errors}.",

        calc_title: "Töltés kalkulátor",
        calc_lead: "Add meg az aktuális árakat és az utat, és megmondom, hogy a szükséges energiát tölteni vagy benzinből előállítani olcsóbb.",
        label_fuelPrice: "Üzemanyag ár ({unit})",
        label_elecPrice: "Áram ár ({unit})",
        label_battery: "Akkumulátor töltöttség (%)",
        label_distance: "Táv otthontól (km)",
        label_use_car_consumption: "Az autó által számolt fogyasztás használata",
        label_targetSoc: "Töltési limit hazaéréshez (%)",
        btn_refresh_data: "Adatok frissítése",
        btn_refresh_distance: "Távolság frissítése az autó helyzete alapján",
        btn_set_limit: "Beállítás az autóban (Még nem elérhető)",
        btn_calculate: "Számítás",
        consumption_hint_off: "Kikapcsolva: a Beállításokban megadott fogyasztási értékek használata.",
        limit_hint_default: "Számítás után frissül, de kézzel átírható.",
        limit_hint_calculated: "{distance} km teljesítéséhez {soc}% töltöttség szükséges – átírható.",
        assumptions_title: "Feltételezések",
        assumption_battery: "Akkumulátor: {value} kWh",
        assumption_hybrid: "Hibrid fogyasztás: {value} l/100 km",
        assumption_ev: "Elektromos fogyasztás: {value} kWh/100 km",
        assumption_loss: "Töltési veszteség: 10% (a hálózatból vett energia ennyivel több)",

        error_invalid_inputs: "Kérlek adj meg érvényes értékeket (a töltöttség 0 és 100% között).",
        limit_setting: "Beállítás folyamatban…",
        limit_set_done: "A töltési limit {target}%-ra állítva.",
        data_fetching: "Lekérés folyamatban…",
        battery_hint: "Töltöttség: {soc}% ({source}, {time}{quota})",
        quota_remaining: ", még {count} lekérés ebben az órában",
        consumption_using_cache: "Az elcachelt autóadatok használata…",
        consumption_missing_ev: "Az autó elektromos töltöttsége vagy hatótávja nem érhető el.",
        consumption_missing_tank: "A Beállításokban add meg a benzintartály kapacitását literben.",
        consumption_missing_fuel: "Az autó benzinszintje vagy benzines hatótávja nem érhető el.",
        consumption_summary: "Autó: akkumulátor {soc}%, elektromos hatótáv {evRange} km, fogyasztás {evConsumption} kWh/100 km; üzemanyag {fuelLevel}%, hatótáv {fuelRange} km, fogyasztás {fuelConsumption} l/100 km.",
        home_address_missing: "Előbb add meg az otthoni címet a Beállítások oldalon.",
        parking_position_missing: "Az autó aktuális parkolási helyzete nem érhető el.",
        geocode_failed: "A cím koordinátáinak lekérése sikertelen.",
        home_address_not_found: "A megadott otthoni cím nem található.",
        route_failed: "Az útvonal lekérése sikertelen.",
        route_not_found: "Nem található autós útvonal a jelenlegi hely és az otthon között.",
        route_fetching: "Az autó helyzete és az útvonal lekérése…",
        route_hint: "Útvonal távolsága: {distance} km.",

        verdict_no_charge_enough: "Ne tölts: a jelenlegi töltöttség elég az egész útra.",
        verdict_charge_better: "Tölts indulás előtt! Így {savings} olcsóbb, mint töltés nélkül.",
        verdict_fuel_better: "Ne tölts indulás előtt: a töltés {savings} drágább lenne.",
        row_ev_range_now: "Elektromos hatótáv most",
        row_ev_range_value: "{range} km ({stored} kWh)",
        row_distance: "Út hossza",
        row_required_soc: "Úthoz szükséges töltöttség",
        row_hybrid_no_charge: "Hibrid szakasz töltés nélkül",
        row_hybrid_with_charge: "Hibrid szakasz egyszeri töltéssel",
        row_charge_needed: "Ehhez szükséges töltés (hálózatból)",
        row_fuel_no_charge: "Hibrid szakasz fogyasztása töltés nélkül",
        row_cost_per_km_ev: "Költség / km elektromosan",
        row_cost_per_km_fuel: "Költség / km hibridben",
        row_consumption_source: "Számítási fogyasztás",
        row_ev_consumption: "Elektromos fogyasztás",
        row_fuel_consumption: "Hibrid fogyasztás",
        row_battery_for_calc: "Akkumulátor a számításhoz",
        row_car_current_battery: "Autó aktuális akkumulátora",
        row_car_current_battery_value: "{soc}% | {range} km maradék út",
        row_fuel: "Üzemanyag",
        row_fuel_value: "{level}% | {range} km maradék út",
        row_full_charge: "Teljes feltöltés ára (100%-ig)",
        consumption_source_car: "autó adatai",
        consumption_source_settings: "Beállítások",
        note_break_even: "Fordulópont: a töltés eddig az áramárig éri meg: {elecPrice} (illetve ettől az üzemanyagártól: {fuelPrice}).",

        settings_title: "Beállítások",
        settings_lead: "Az API kulcs és a VIN csak ebben a böngészőben, a localStorage-ban tárolódik – a lekérés a telepített Cloudflare proxyn keresztül jut el a Škoda API-hoz.",
        label_apiKey: "MyŠkoda Public API kulcs (X-API-Key)",
        label_vin: "VIN",
        label_homeAddress: "Otthoni cím",
        label_batteryKwh: "Akkumulátor kapacitás (kWh)",
        label_fuelLitresPer100Km: "Hibrid fogyasztás (l/100 km)",
        label_fuelTankLitres: "Benzintartály kapacitása (l)",
        label_evKwhPer100Km: "Elektromos fogyasztás (kWh/100 km)",
        label_language: "Nyelv",
        label_currency: "Pénznem",
        btn_save: "Mentés",
        btn_test: "Kapcsolat tesztelése",
        btn_clear: "Törlés",
        good_to_know_title: "Jó tudni",
        good_to_know_1: "A kulcsot a MyŠkoda mobilappban tudod létrehozni és kezelni: {link}.",
        good_to_know_2: "A kulcs csak a kiválasztáskor megadott járművekre érvényes és lejár; a lejárat a válasz {code} fejlécében jön.",
        good_to_know_3: "A lekérdezés VIN-enként óránként 20 kérésre korlátozott.",
        good_to_know_4: "A lekérés a {code} Cloudflare Workeren keresztül történik.",
        good_to_know_5: "A localStorage-ban tárolt kulcs XSS esetén kiolvasható; közös gépen inkább töröld használat után.",
        docs_note: "Dokumentáció: {link}",

        vin_invalid: "A VIN 17 karakter hosszú lehet, I, O és Q betű nélkül.",
        consumption_values_invalid: "Az akkumulátor kapacitása és a fogyasztási értékek legyenek nullánál nagyobbak.",
        settings_saved: "Beállítások elmentve ebben a böngészőben.",
        test_in_progress: "Lekérés folyamatban…",
        test_success: "Sikeres kapcsolat – az akkumulátor töltöttsége {soc}%.{expiry}",
        test_key_expiry: " A kulcs lejárata: {expiry}.",
        settings_cleared: "A tárolt adatok törölve."
    },
    en: {
        nav_home: "Home",
        nav_calculator: "Charging calculator",
        nav_settings: "Settings",
        footer_disclaimer: "Unofficial fan-made helper site. Škoda Auto a.s. trademarks belong to their owner.",
        loading: "Loading…",
        refresh: "Refresh",

        home_title: "My car",
        map_title: "Parking location",
        map_open_link: "Open in full map",
        hero_eyebrow: "Škoda Utility",
        hero_title: "Is it worth charging now?",
        hero_lead: "A small toolset for plug-in hybrid Škoda owners. Work out whether it's worth charging or cheaper to just drive in hybrid mode.",
        hero_cta: "Open charging calculator",
        spec_battery_label: "Battery capacity",
        spec_fuel_label: "Hybrid mode consumption",
        spec_ev_label: "Electric mode consumption",
        source_car: "(car)",
        source_settings: "(settings)",

        card_name: "Vehicle",
        card_plate: "License plate",
        card_soc: "Battery level",
        card_ev_range: "Electric range",
        card_fuel_level: "Fuel level",
        card_fuel_range: "Fuel range",
        card_odometer: "Odometer",
        card_doors: "Doors",
        card_charging_state: "Charging state",
        card_charge_limit: "Charge limit",
        lock_yes: "Locked",
        lock_no: "Unlocked",
        charging_charging: "Charging",
        charging_connect_cable: "Cable not connected",
        charging_ready_for_charging: "Ready to charge",
        charging_conserving: "Maintaining charge",
        charging_error: "Error",
        source_cache: "from cache",
        source_fresh: "fresh",
        hint_data: "Data {source}, {time}.",
        hint_missing: " Unavailable data: {errors}.",

        calc_title: "Charging calculator",
        calc_lead: "Enter current prices and the distance, and I'll tell you whether it's cheaper to charge the required energy or produce it from fuel.",
        label_fuelPrice: "Fuel price ({unit})",
        label_elecPrice: "Electricity price ({unit})",
        label_battery: "Battery level (%)",
        label_distance: "Distance from home (km)",
        label_use_car_consumption: "Use consumption calculated from the car",
        label_targetSoc: "Charge limit to get home (%)",
        btn_refresh_data: "Refresh data",
        btn_refresh_distance: "Refresh distance based on car position",
        btn_set_limit: "Set on the car (not yet available)",
        btn_calculate: "Calculate",
        consumption_hint_off: "Off: using the consumption values from Settings.",
        limit_hint_default: "Updates after calculation, but can be edited manually.",
        limit_hint_calculated: "Battery level of {soc}% is needed to cover {distance} km – can be edited manually.",
        assumptions_title: "Assumptions",
        assumption_battery: "Battery: {value} kWh",
        assumption_hybrid: "Hybrid consumption: {value} l/100 km",
        assumption_ev: "Electric consumption: {value} kWh/100 km",
        assumption_loss: "Charging loss: 10% (that much more energy is taken from the grid)",

        error_invalid_inputs: "Please enter valid values (battery level between 0 and 100%).",
        limit_setting: "Setting in progress…",
        limit_set_done: "Charge limit set to {target}%.",
        data_fetching: "Fetching…",
        battery_hint: "Battery level: {soc}% ({source}, {time}{quota})",
        quota_remaining: ", {count} requests left this hour",
        consumption_using_cache: "Using cached car data…",
        consumption_missing_ev: "The car's electric charge level or range is unavailable.",
        consumption_missing_tank: "Enter the fuel tank capacity in litres in Settings.",
        consumption_missing_fuel: "The car's fuel level or fuel range is unavailable.",
        consumption_summary: "Car: battery {soc}%, electric range {evRange} km, consumption {evConsumption} kWh/100 km; fuel {fuelLevel}%, range {fuelRange} km, consumption {fuelConsumption} l/100 km.",
        home_address_missing: "First enter your home address on the Settings page.",
        parking_position_missing: "The car's current parking position is unavailable.",
        geocode_failed: "Failed to look up the address coordinates.",
        home_address_not_found: "The given home address could not be found.",
        route_failed: "Failed to fetch the route.",
        route_not_found: "No driving route found between the current location and home.",
        route_fetching: "Fetching car position and route…",
        route_hint: "Route distance: {distance} km.",

        verdict_no_charge_enough: "Don't charge: the current charge level is enough for the whole trip.",
        verdict_charge_better: "Charge before you leave! That's {savings} cheaper than not charging.",
        verdict_fuel_better: "Don't charge before you leave: charging would be {savings} more expensive.",
        row_ev_range_now: "Electric range now",
        row_ev_range_value: "{range} km ({stored} kWh)",
        row_distance: "Trip distance",
        row_required_soc: "Battery level needed for the trip",
        row_hybrid_no_charge: "Hybrid stretch without charging",
        row_hybrid_with_charge: "Hybrid stretch with a single charge",
        row_charge_needed: "Charge needed for this (from the grid)",
        row_fuel_no_charge: "Hybrid stretch consumption without charging",
        row_cost_per_km_ev: "Cost / km electric",
        row_cost_per_km_fuel: "Cost / km hybrid",
        row_consumption_source: "Consumption used for calculation",
        row_ev_consumption: "Electric consumption",
        row_fuel_consumption: "Hybrid consumption",
        row_battery_for_calc: "Battery used for calculation",
        row_car_current_battery: "Car's current battery",
        row_car_current_battery_value: "{soc}% | {range} km remaining range",
        row_fuel: "Fuel",
        row_fuel_value: "{level}% | {range} km remaining range",
        row_full_charge: "Cost of a full charge (to 100%)",
        consumption_source_car: "car data",
        consumption_source_settings: "Settings",
        note_break_even: "Break-even: charging is worth it up to this electricity price: {elecPrice} (or from this fuel price: {fuelPrice}).",

        settings_title: "Settings",
        settings_lead: "The API key and VIN are only stored in this browser's localStorage – requests reach the Škoda API through the installed Cloudflare proxy.",
        label_apiKey: "MyŠkoda Public API key (X-API-Key)",
        label_vin: "VIN",
        label_homeAddress: "Home address",
        label_batteryKwh: "Battery capacity (kWh)",
        label_fuelLitresPer100Km: "Hybrid consumption (l/100 km)",
        label_fuelTankLitres: "Fuel tank capacity (l)",
        label_evKwhPer100Km: "Electric consumption (kWh/100 km)",
        label_language: "Language",
        label_currency: "Currency",
        btn_save: "Save",
        btn_test: "Test connection",
        btn_clear: "Clear",
        good_to_know_title: "Good to know",
        good_to_know_1: "You can create and manage the key in the MyŠkoda mobile app: {link}.",
        good_to_know_2: "The key is only valid for the vehicles selected when it was created and it expires; the expiry comes in the response's {code} header.",
        good_to_know_3: "Requests are limited to 20 per hour per VIN.",
        good_to_know_4: "Requests go through the {code} Cloudflare Worker.",
        good_to_know_5: "A key stored in localStorage can be read out via XSS; on a shared computer, delete it after use.",
        docs_note: "Documentation: {link}",

        vin_invalid: "The VIN must be 17 characters long, without the letters I, O or Q.",
        consumption_values_invalid: "The battery capacity and consumption values must be greater than zero.",
        settings_saved: "Settings saved in this browser.",
        test_in_progress: "Fetching…",
        test_success: "Connection successful – battery level is {soc}%.{expiry}",
        test_key_expiry: " Key expiry: {expiry}.",
        settings_cleared: "Stored data cleared."
    }
};

const CURRENCY_UNITS = {
    HUF: { fuel: "Ft/l", elec: "Ft/kWh" },
    EUR: { fuel: "€/l", elec: "€/kWh" },
    PLN: { fuel: "zł/l", elec: "zł/kWh" },
    CZK: { fuel: "Kč/l", elec: "Kč/kWh" },
    RON: { fuel: "lei/l", elec: "lei/kWh" },
    BGN: { fuel: "лв/l", elec: "лв/kWh" },
    SEK: { fuel: "kr/l", elec: "kr/kWh" },
    CHF: { fuel: "CHF/l", elec: "CHF/kWh" },
    GBP: { fuel: "£/l", elec: "£/kWh" }
};

function currentLanguage() {
    return loadSkodaSettings().language;
}

function currentCurrency() {
    return loadSkodaSettings().currency;
}

function t(key, vars) {
    const lang = currentLanguage();
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.hu;
    let text = dict[key] ?? TRANSLATIONS.hu[key] ?? key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, value);
        }
    }
    return text;
}

function getLocale() {
    return LOCALE_BY_LANGUAGE[currentLanguage()] || LOCALE_BY_LANGUAGE.hu;
}

function getCurrencyUnit(kind) {
    return (CURRENCY_UNITS[currentCurrency()] || CURRENCY_UNITS.HUF)[kind];
}

function formatCurrency(value, options) {
    return new Intl.NumberFormat(getLocale(), {
        style: "currency",
        currency: currentCurrency(),
        maximumFractionDigits: 0,
        ...options
    }).format(value);
}

function formatNumber(value, options) {
    return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1, ...options }).format(value);
}

function currencySymbol() {
    const parts = new Intl.NumberFormat(getLocale(), {
        style: "currency",
        currency: currentCurrency(),
        currencyDisplay: "narrowSymbol"
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value || currentCurrency();
}

function applyStaticTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    document.documentElement.lang = currentLanguage();
}

document.addEventListener("DOMContentLoaded", () => applyStaticTranslations());
