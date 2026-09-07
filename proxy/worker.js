// Cloudflare Worker: CORS proxy a MyŠkoda Public API elé.
// A böngésző az X-API-Key fejléc miatt preflightot küldene, az OPTIONS viszont
// nem viszi magával a kulcsot -> 401. Itt a kulcs query paraméterben érkezik,
// így nincs preflight, és a fejlécet a worker teszi rá.

const UPSTREAM = "https://public.api.connect.skoda-auto.cz";
const ALLOWED_ORIGIN = "https://iasatan.github.io";
const VEHICLE_PATH = /^\/api\/v1\/vehicles\/[A-HJ-NPR-Z0-9]{17}$/;

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Expose-Headers": "X-API-Key-Expires-At, RateLimit-Remaining, RateLimit-Limit, RateLimit-Reset, Retry-After",
        "Vary": "Origin"
    };
}

export default {
    async fetch(request) {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }
        if (request.method !== "GET") {
            return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
        }

        const url = new URL(request.url);
        if (!VEHICLE_PATH.test(url.pathname)) {
            return new Response("Not found", { status: 404, headers: corsHeaders() });
        }

        const apiKey = url.searchParams.get("apiKey");
        if (!apiKey) {
            return new Response("Missing apiKey", { status: 400, headers: corsHeaders() });
        }

        const target = new URL(UPSTREAM + url.pathname);
        const include = url.searchParams.get("include");
        if (include) {
            target.searchParams.set("include", include);
        }

        const upstream = await fetch(target.toString(), {
            headers: { "X-API-Key": apiKey }
        });

        const headers = new Headers(upstream.headers);
        for (const [key, value] of Object.entries(corsHeaders())) {
            headers.set(key, value);
        }
        return new Response(upstream.body, { status: upstream.status, headers });
    }
};
