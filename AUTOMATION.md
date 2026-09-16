# Vahan automation

The Vahan downloader now lives inside this dashboard repo.

## Setup

```bash
pip install -r automation/requirements.txt
python -m playwright install chromium
npm install
```

## Run the dashboard

```bash
npm start
```

## Refresh Vahan data

Run the full workflow:

```bash
npm run refresh:vahan
```

This downloads the Vahan RTO reports, stores the raw files under `reports/YYYY-MM-DD/`, updates the dashboard data files, and regenerates `rto_data.json`.

## Local button updater

The production dashboard can trigger a refresh through a local helper on the operator's computer. This is the zero-recurring-cost path that works when hosted services cannot reach the Vahan portal.

One-time setup on the operator machine:

```bash
git clone https://github.com/nippontoyota/market-share.git
cd market-share
Start_Updater.bat
```

Daily/manual use:

1. Run `Start_Updater.bat`.
2. Open `https://performance-dashboard-kvj8.onrender.com/`.
3. Click `Update data`, then `Start update`.
4. Keep the updater terminal open until the dashboard says the data was published.

The helper listens only on `127.0.0.1:4786`. It accepts browser calls from the production dashboard, runs the existing Python/Playwright Vahan pipeline locally, validates all 86 RTOs, commits the refreshed data files, and pushes `master` so Render can auto-deploy. This does not run any paid server, database, queue, or scheduler.

Use the latest existing report folder without downloading again:

```bash
npm run refresh:vahan:existing
```

Use a specific report folder:

```bash
python automation/run_full_pipeline.py --skip-download --reports-dir reports/YYYY-MM-DD
```

## Daily GitHub Actions refresh

The repository includes `.github/workflows/vahan-daily.yml`, which runs daily at 09:00 India Standard Time and can also be started manually from the GitHub Actions tab. On scheduled/manual runs, it first checks whether the Vahan portal is reachable from the free GitHub-hosted runner. If it is reachable, it installs the automation dependencies, runs the test suite, downloads all 86 in-scope RTO reports, validates the generated dashboard data, and commits only the tracked derived data files when they change. The job timeout is capped at 45 minutes so an upstream Vahan outage cannot run indefinitely.

On normal pushes, the same workflow skips the live Vahan scrape and Playwright browser install, then validates the committed production dashboard snapshot. This keeps push validation inexpensive while the daily refresh remains automatic.

If the Vahan portal is not reachable from GitHub's free hosted runner, the workflow skips dependency installation, browser installation, and the expensive scrape, then validates the last committed production snapshot instead. Production stays on the last known-good data and the workflow avoids burning the full timeout.

For the automatic Render deployment to follow these refresh commits, the Render service must use `https://github.com/nippontoyota/market-share.git` on the `master` branch with Auto-Deploy set to `On Commit`. The workflow does not need a Render API key.

Configure Render's health check path as `/health`. It returns HTTP 200 without requiring dashboard credentials.

The refresh remains fail-closed: a missing RTO, failed download, parse error, invalid workbook, invalid JSON, or failed push stops before production receives a new dashboard data commit. The existing dashboard data remains the last known-good version.

## Files updated by the automation

- `VAHAN_KERALA_MASTER1.xlsm`
- `MASTER_DATA_2026.xlsm`
- `RTO_2025_2026_Combined.csv`
- `rto_data.json`

Existing versions are backed up first under `backups/vahan_auto/`.

Raw downloaded files are copied to `vahan_uploads/YYYY-MM-DD/`.

## Tests

```bash
npm run test:automation
```

The integration test uses a temporary copy of the dashboard, not the real project files.
