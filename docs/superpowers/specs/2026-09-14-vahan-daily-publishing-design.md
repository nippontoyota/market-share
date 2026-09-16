# Vahan Daily Publishing Design

## Goal

Run the Vahan refresh once per day, publish only a complete and validated 86-RTO dataset, and let the existing Render service deploy the resulting repository commit.

## Architecture

The `performance-dashboard` repository remains the single project. A GitHub Actions workflow runs the existing Python/Playwright pipeline daily on Ubuntu, validates all 86 in-scope reports and generated dashboard data, then commits only the tracked derived data files. Render continues serving the Node application and auto-deploys commits from its linked branch.

Raw reports, logs, backups, and manifests remain ignored local/workflow artifacts. The repository's Git history provides rollback for the tracked dashboard data.

## Safety contract

- A run must parse exactly 86 in-scope RTO reports.
- Any download or parse failure must fail the workflow before dashboard files are replaced.
- Generated JSON must be valid and contain the expected dashboard structure.
- Only validated generated files may be committed.
- Concurrent daily runs are prohibited.
- Existing production data must remain unchanged when validation fails.

## Deployment contract

Render must be connected to `nippontoyota/market-share`, the intended deployment branch must be `master`, and Auto-Deploy must be set to `On Commit`. The workflow does not change Render settings or push code outside the repository.

## Operational contract

The workflow runs once daily at 03:30 India Standard Time using a timezone-aware GitHub schedule. It also supports manual dispatch for first-run verification. The first scheduled run must be manually triggered and observed before relying on the daily schedule.

## Testing contract

Local unit and integration tests must pass. The workflow must run the same tests before downloading live data. A successful live run must produce 86 reports, regenerate `rto_data.json`, and commit the derived files. A failed or incomplete run must produce no data commit.
