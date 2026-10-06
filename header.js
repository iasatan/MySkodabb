const navToggle = document.querySelector(".nav-toggle");
const primaryNav = document.querySelector("#primary-nav");

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
