// Minimal read-only API worker: serves the eligible-scope registration
// records from Supabase (Postgres) in the same shape the dashboard used to
// get from the ~3MB `rawRecords` array baked into index.html.
//
// Deploy separately from whatever currently serves the static dashboard
// files, so this can't break static serving. index.html just needs to
// `fetch()` this worker's /records endpoint instead of embedding the array.

const PAGE_SIZE = 1000;
const CACHE_TTL_SECONDS = 300; // data only changes on daily Vahan refresh

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

async function fetchAllRecords(env) {
    const baseUrl = `${env.SUPABASE_URL}/rest/v1/registrations`
        + '?select=year,year_label,month,mapped_location,maker,nos'
        + '&check_eligible=eq.Required'
        + '&order=id.asc';

    const headers = {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    };

    const first = await fetch(baseUrl, {
        headers: { ...headers, Range: `0-${PAGE_SIZE - 1}`, Prefer: 'count=exact' },
    });
    if (!first.ok) {
        throw new Error(`Supabase request failed: ${first.status} ${await first.text()}`);
    }
    const firstBatch = await first.json();

    const contentRange = first.headers.get('content-range'); // "0-999/22650"
    const total = contentRange ? parseInt(contentRange.split('/')[1], 10) : firstBatch.length;

    const pageStarts = [];
    for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
        pageStarts.push(start);
    }

    const restBatches = await Promise.all(pageStarts.map(async (start) => {
        const end = Math.min(start + PAGE_SIZE - 1, total - 1);
        const res = await fetch(baseUrl, { headers: { ...headers, Range: `${start}-${end}` } });
        if (!res.ok) {
            throw new Error(`Supabase request failed: ${res.status} ${await res.text()}`);
        }
        return res.json();
    }));

    const rows = [firstBatch, ...restBatches].flat();

    // Map to the exact keys index.html's rawRecords entries used.
    return rows.map((r) => ({
        Year: r.year,
        Year_Label: r.year_label,
        Month: r.month,
        Mapped_Location: r.mapped_location,
        Maker: r.maker,
        Nos: r.nos,
    }));
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        if (url.pathname === '/health') {
            return new Response('ok', { headers: CORS_HEADERS });
        }

        if (url.pathname !== '/records') {
            return new Response('Not found', { status: 404, headers: CORS_HEADERS });
        }

        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(JSON.stringify({ error: 'Server not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        const cache = caches.default;
        const cacheKey = new Request(url.toString(), request);
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        try {
            const records = await fetchAllRecords(env);
            const response = new Response(JSON.stringify(records), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
                    ...CORS_HEADERS,
                },
            });
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
            return response;
        } catch (err) {
            return new Response(JSON.stringify({ error: String(err) }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }
    },
};
