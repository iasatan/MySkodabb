const navToggle = document.querySelector(".nav-toggle");
const primaryNav = document.querySelector("#primary-nav");

if (primaryNav && !primaryNav.querySelector('a[href="nearby-chargers.html"]')) {
    const chargersLink = document.createElement("a");
    chargersLink.href = "nearby-chargers.html";
    chargersLink.dataset.i18n = "nav_chargers";
    chargersLink.textContent = t("nav_chargers");
    primaryNav.insertBefore(chargersLink, primaryNav.querySelector('a[href="statistics.html"]'));
}

if (isDemoMode()) {
    const notice = document.createElement("p");
    notice.className = "hint demo-notice";
    notice.setAttribute("role", "status");
    const settingsLink = document.createElement("a");
    settingsLink.href = "settings.html";
    settingsLink.textContent = t("credentials_missing");
    notice.append(t("demo_notice") + " ", settingsLink);
    (document.querySelector("main .page") || document.querySelector("main"))?.prepend(notice);
}

if (navToggle && primaryNav) {
    navToggle.addEventListener("click", () => {
        const isOpen = primaryNav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    primaryNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            primaryNav.classList.remove("is-open");
            navToggle.setAttribute("aria-expanded", "false");
        }
    });
}
