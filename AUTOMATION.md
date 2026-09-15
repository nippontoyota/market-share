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

Use the latest existing report folder without downloading again:

```bash
npm run refresh:vahan:existing
```

Use a specific report folder:

```bash
python automation/run_full_pipeline.py --skip-download --reports-dir reports/YYYY-MM-DD
```

## Optional local schedule

GitHub Actions is the production schedule. These Windows scripts are only a local fallback for manual/internal use and are not required for the daily production refresh.

On Windows, run this once to create monthly scheduled tasks for the 10th and 25th at 09:00:

```bat
Schedule_10_25.bat
```

## Daily GitHub Actions refresh

The repository includes `.github/workflows/vahan-daily.yml`, which runs daily at 09:00 India Standard Time and can also be started manually from the GitHub Actions tab. It installs the automation dependencies, runs the test suite, downloads all 86 in-scope RTO reports, validates the generated dashboard data, and commits only the tracked derived data files when they change. The job timeout is capped at 45 minutes so an upstream Vahan outage cannot run indefinitely.

On normal pushes, the same workflow skips the live Vahan scrape and Playwright browser install, then validates the committed production dashboard snapshot. This keeps push validation inexpensive while the daily refresh remains automatic.

For the automatic Render deployment to follow these refresh commits, the Render service must use this repository's `master` branch with Auto-Deploy set to `On Commit`. The workflow does not need a Render API key.

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
