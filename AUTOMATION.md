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

## Schedule

On Windows, run this once to create monthly scheduled tasks for the 10th and 25th at 09:00:

```bat
Schedule_10_25.bat
```

## Daily GitHub Actions refresh

The repository includes `.github/workflows/vahan-daily.yml`, which runs daily at 09:00 India Standard Time and can also be started manually from the GitHub Actions tab. It installs the automation dependencies, runs the test suite, downloads all 86 in-scope RTO reports, validates the generated dashboard data, and commits only the four tracked derived data files when they change.

For the automatic Render deployment to follow these refresh commits, the Render service must use this repository's `master` branch with Auto-Deploy set to `On Commit`. The workflow does not need a Render API key.

Configure Render's health check path as `/health`. It returns HTTP 200 without requiring dashboard credentials.

The workflow is intentionally fail-closed: a missing RTO, failed download, parse error, invalid workbook, or invalid JSON stops the job before dashboard data is published. The existing dashboard data remains the last known-good version.

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
