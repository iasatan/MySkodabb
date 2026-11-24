const tbody = document.querySelector("#storage-table tbody");
const statusEl = document.getElementById("storage-status");

function setStatus(msg) {
    statusEl.textContent = msg;
}

function render() {
    tbody.textContent = "";
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.sort();
    if (!keys.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 3;
        td.textContent = t("storage_empty");
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    for (const key of keys) {
        const tr = document.createElement("tr");
        const keyTd = document.createElement("td");
        keyTd.textContent = key;
        const valTd = document.createElement("td");
        const area = document.createElement("textarea");
        area.rows = 3;
        area.style.width = "100%";
        area.value = localStorage.getItem(key);
        valTd.appendChild(area);
        const actTd = document.createElement("td");
        const save = document.createElement("button");
        save.type = "button";
        save.className = "btn";
        save.textContent = t("storage_save");
        save.addEventListener("click", () => {
            localStorage.setItem(key, area.value);
            setStatus(t("storage_saved"));
        });
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn ghost danger";
        del.textContent = t("storage_delete");
        del.addEventListener("click", () => {
            if (!confirm(t("storage_confirm", { key }))) return;
            localStorage.removeItem(key);
            render();
            setStatus(t("storage_deleted"));
        });
        actTd.append(save, del);
        tr.append(keyTd, valTd, actTd);
        tbody.appendChild(tr);
    }
}

document.getElementById("storage-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = document.getElementById("new-key").value.trim();
    if (!key) {
        setStatus(t("storage_key_required"));
        return;
    }
    localStorage.setItem(key, document.getElementById("new-value").value);
    document.getElementById("new-key").value = "";
    document.getElementById("new-value").value = "";
    render();
    setStatus(t("storage_saved"));
});

render();
