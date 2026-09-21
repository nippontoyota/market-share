-- RTO Analytics Dashboard: raw registrations fact table (Supabase / Postgres)
--
-- Grain: one row per (year, month, rto_clean, maker), matching
-- RTO_2025_2026_Combined.csv exactly. Everything the dashboard shows today
-- (rawRecords in index.html, rto_data.json) is derivable by aggregating this
-- table, so it is the single source of truth going forward.

create table if not exists registrations (
    id bigint generated always as identity primary key,
    year integer not null,
    year_label text not null,
    month text not null,
    month_num smallint not null,
    rto text not null,
    rto_clean text not null,
    mapped_location text not null,
    maker text not null,
    cluster text not null,
    check_eligible text not null,
    nos integer not null,
    updated_at timestamptz not null default now(),
    constraint registrations_grain_uidx unique (year, month_num, rto_clean, maker)
);

create index if not exists idx_registrations_year_month on registrations (year, month_num);
create index if not exists idx_registrations_location on registrations (mapped_location);
create index if not exists idx_registrations_maker on registrations (maker);
create index if not exists idx_registrations_rto_clean on registrations (rto_clean);
create index if not exists idx_registrations_eligible on registrations (check_eligible);
