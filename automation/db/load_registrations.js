// Loads RTO_2025_2026_Combined.csv into the Supabase `registrations` table.
//
// Usage:
//   node automation/db/load_registrations.js [path/to/csv]
//
// Requires SUPABASE_DB_URL in .env (server-side only; never expose this to
// the frontend or a Cloudflare Worker script).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CSV_PATH = process.argv[2] || path.join(__dirname, '..', '..', 'RTO_2025_2026_Combined.csv');
const BATCH_SIZE = 1000;

function parseCsv(filePath) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    const header = lines[0].split(',').map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const row = {};
        header.forEach((key, idx) => {
            row[key] = (cols[idx] ?? '').trim();
        });
        rows.push({
            year: parseInt(row.Year, 10),
            year_label: row.Year_Label,
            month: row.Month,
            month_num: parseInt(row.Month_Num, 10),
            rto: row.RTO,
            rto_clean: row.RTO_clean,
            mapped_location: row.Mapped_Location,
            maker: row.Maker,
            cluster: row.Cluster,
            check_eligible: row.Check_Eligible,
            nos: parseInt(row.Nos, 10),
        });
    }
    return rows;
}

async function upsertBatch(client, batch) {
    const cols = [
        'year', 'year_label', 'month', 'month_num', 'rto', 'rto_clean',
        'mapped_location', 'maker', 'cluster', 'check_eligible', 'nos',
    ];
    const values = [];
    const placeholders = batch.map((row, i) => {
        const base = i * cols.length;
        cols.forEach((c) => values.push(row[c]));
        return `(${cols.map((_, j) => `$${base + j + 1}`).join(', ')})`;
    }).join(', ');

    const sql = `
        insert into registrations (${cols.join(', ')})
        values ${placeholders}
        on conflict (year, month_num, rto_clean, maker)
        do update set
            year_label = excluded.year_label,
            month = excluded.month,
            rto = excluded.rto,
            mapped_location = excluded.mapped_location,
            cluster = excluded.cluster,
            check_eligible = excluded.check_eligible,
            nos = excluded.nos,
            updated_at = now()
    `;
    await client.query(sql, values);
}

async function main() {
    if (!process.env.SUPABASE_DB_URL) {
        console.error('Missing SUPABASE_DB_URL in .env');
        process.exit(1);
    }
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV not found at ${CSV_PATH}`);
        process.exit(1);
    }

    const rows = parseCsv(CSV_PATH);
    console.log(`Parsed ${rows.length} rows from ${path.basename(CSV_PATH)}`);

    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
    await client.connect();

    try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schemaSql);
        console.log('Schema ensured (registrations table + indexes).');

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            await upsertBatch(client, batch);
            process.stdout.write(`\rUpserted ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
        }
        console.log('\nDone.');

        const { rows: countRows } = await client.query('select count(*)::int as n from registrations');
        console.log(`Total rows now in registrations table: ${countRows[0].n}`);

        // Fail closed: confirm the database actually reflects this CSV,
        // not just that the upsert calls returned without throwing.
        const csvNosSum = rows.reduce((sum, r) => sum + r.nos, 0);
        const { rows: sumRows } = await client.query('select coalesce(sum(nos), 0)::bigint as n from registrations');
        const dbNosSum = Number(sumRows[0].n);
        if (dbNosSum !== csvNosSum) {
            throw new Error(
                `Post-load verification failed: registrations table sum(nos)=${dbNosSum} `
                + `does not match CSV sum(nos)=${csvNosSum}.`
            );
        }
        console.log(`Verified: registrations table sum(nos) matches CSV (${dbNosSum}).`);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Load failed:', err);
    process.exit(1);
});
