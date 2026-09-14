# Vahan Daily Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Vahan refresh daily and publish only a complete, validated 86-RTO dashboard dataset to the branch Render deploys.

**Architecture:** GitHub Actions runs the existing Python/Playwright downloader and integration code on Ubuntu once per day. The pipeline validates the complete result before replacing dashboard data; the workflow commits only tracked derived files, allowing Render's existing linked-branch auto-deploy to publish them.

**Tech Stack:** Python 3.11, pytest, pandas, openpyxl, Playwright Chromium, Node.js 20, GitHub Actions, Render Node web service.

## Global Constraints

- Keep all automation code inside `performance-dashboard`.
- Run the scheduled refresh once daily at 03:30 Asia/Kolkata.
- Require exactly 86 in-scope RTOs before publishing.
- Preserve existing dashboard files when download, parse, generation, or validation fails.
- Do not commit raw reports, logs, backups, or browser artifacts.
- Do not push code or modify Render settings from the local implementation.

---

### Task 1: Make integration fail closed before changing data

**Files:**
- Modify: `automation/dashboard_integration.py`
- Modify: `tests/test_dashboard_integration.py`

**Interfaces:**
- `load_reports(reports_dir, name_map)` continues returning `(raw_rows, used_report_files)`.
- `integrate(...)` raises `RuntimeError` when the usable report count or parsed RTO count is not exactly 86, before calling `backup_files`, `copy_raw_reports`, or any writer.

- [ ] **Step 1: Add a test with 85 valid report files and one out-of-scope file; assert integration raises before writing outputs.**
- [ ] **Step 2: Run the focused test and confirm it fails because the current code only prints a warning.**
- [ ] **Step 3: Replace the warning branch with explicit checks for `len(report_files) != config.EXPECTED_RTO_COUNT` and `rto_count != config.EXPECTED_RTO_COUNT`, raising `RuntimeError` before backup/write operations.**
- [ ] **Step 4: Run the focused test and the existing integration tests; confirm they pass.**

### Task 2: Add generated-data validation

**Files:**
- Modify: `automation/dashboard_integration.py`
- Modify: `tests/test_dashboard_integration.py`

**Interfaces:**
- Add `validate_generated_dashboard(dashboard_dir, expected_rto_count=86)` which loads `rto_data.json` and raises `RuntimeError` unless it is a JSON object containing at least one dashboard cluster and each generated source file exists.
- `integrate(...)` calls validation after `run_dashboard_generator` and before reporting success.

- [ ] **Step 1: Add tests for valid JSON and malformed/missing JSON.**
- [ ] **Step 2: Run the focused tests and confirm the missing validator fails.**
- [ ] **Step 3: Implement the validator using `json.loads`, required-file checks, and a non-empty object check; call it after generation.**
- [ ] **Step 4: Run all automation tests and confirm they pass.**

### Task 3: Add the daily GitHub Actions workflow

**Files:**
- Create: `.github/workflows/vahan-daily.yml`
- Modify: `AUTOMATION.md`

**Interfaces:**
- Workflow triggers: `workflow_dispatch` and a daily schedule at `30 22 * * *` UTC, which is 03:30 the following day in India Standard Time.
- Workflow steps: checkout `master`, install Node 20 and Python 3.11, install npm dependencies, install Python requirements, install Chromium, run tests, run `python automation/run_full_pipeline.py`, verify the manifest, and commit tracked derived files if changed.

- [ ] **Step 1: Create the workflow with `concurrency.cancel-in-progress: false`, a 45-minute timeout, and `permissions: contents: write`.**
- [ ] **Step 2: Use `actions/checkout@v4`, `actions/setup-node@v4` with Node 20, and `actions/setup-python@v5` with Python 3.11.**
- [ ] **Step 3: Install `npm ci`, `pip install -r automation/requirements.txt`, and `python -m playwright install --with-deps chromium`.**
- [ ] **Step 4: Run `npm run test:automation`, then `python automation/run_full_pipeline.py`.**
- [ ] **Step 5: Read `vahan_uploads/latest_manifest.json` and fail unless `report_file_count` and `rto_count` both equal 86.**
- [ ] **Step 6: Configure git identity and commit only `VAHAN_KERALA_MASTER1.xlsm`, `MASTER_DATA_2026.xlsm`, `RTO_2025_2026_Combined.csv`, and `rto_data.json`; do not add ignored raw files.**
- [ ] **Step 7: Update `AUTOMATION.md` with manual dispatch, daily timing, quota precautions, and the Render branch requirement.**

### Task 4: Verify locally and prepare the handoff

**Files:**
- Inspect: `.gitignore`, `package.json`, `AUTOMATION.md`, `.github/workflows/vahan-daily.yml`

**Interfaces:**
- Local checks must pass without altering tracked production data.

- [ ] **Step 1: Run `npm run test:automation`.**
- [ ] **Step 2: Run `python -m py_compile automation/config.py automation/download_reports.py automation/dashboard_integration.py automation/run_full_pipeline.py`.**
- [ ] **Step 3: Run `node --check generate_rto_data.js`.**
- [ ] **Step 4: Validate the workflow YAML structure and inspect `git diff --check`.**
- [ ] **Step 5: Confirm the tracked data-file hashes are unchanged by local fixture tests.**
- [ ] **Step 6: Report the exact remaining user actions: commit/push to `master`, confirm Render Auto-Deploy, manually dispatch the workflow once, and verify the Render deploy commit.**
