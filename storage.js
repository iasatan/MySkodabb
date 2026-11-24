const list = document.getElementById("storage-list");
const statusEl = document.getElementById("storage-status");

function setStatus(msg) {
    statusEl.textContent = msg;
}

function formatSize(n) {
    return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

function parseJson(raw) {
    try {
        const v = JSON.parse(raw);
        return v !== null && typeof v === "object" ? v : undefined;
    } catch {
        return undefined;
    }
}

function render() {
    list.textContent = "";
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.sort();
    if (!keys.length) {
        const p = document.createElement("p");
        p.className = "note";
        p.textContent = t("storage_empty");
        list.appendChild(p);
        return;
    }
    for (const key of keys) {
        const raw = localStorage.getItem(key);
        const details = document.createElement("details");
        details.className = "storage-item";
        const summary = document.createElement("summary");
        const k = document.createElement("span");
        k.className = "k";
        k.textContent = key;
        const meta = document.createElement("span");
        meta.className = "meta";
        meta.textContent = formatSize(raw.length);
        summary.append(k, meta);
        details.appendChild(summary);

        // Heavy formatting happens only when the item is opened.
        details.addEventListener("toggle", () => {
            if (!details.open || details.dataset.ready) return;
            details.dataset.ready = "1";
            const parsed = parseJson(raw);
            const isJson = parsed !== undefined;
            const area = document.createElement("textarea");
            area.spellcheck = false;
            area.value = isJson ? JSON.stringify(parsed, null, 2) : raw;
            const save = document.createElement("button");
            save.type = "button";
            save.className = "btn";
            save.textContent = t("storage_save");
            save.addEventListener("click", () => {
                let value = area.value;
                if (isJson) {
                    const again = parseJson(value);
                    if (again === undefined) {
                        setStatus(t("storage_invalid_json"));
                        return;
                    }
                    value = JSON.stringify(again);
                }
                localStorage.setItem(key, value);
                meta.textContent = formatSize(value.length);
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
            const actions = document.createElement("div");
            actions.className = "actions";
            actions.append(save, del);
            details.append(area, actions);
        });
        list.appendChild(details);
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
