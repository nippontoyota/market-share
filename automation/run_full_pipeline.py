import argparse
from pathlib import Path
import subprocess
import sys

import config
from dashboard_integration import integrate


def run_download():
    script_path = Path(__file__).resolve().with_name("download_reports.py")
    subprocess.run([sys.executable, "-u", str(script_path)], check=True)


def main():
    parser = argparse.ArgumentParser(description="Download Vahan reports and refresh the performance dashboard.")
    parser.add_argument("--skip-download", action="store_true", help="Use the latest existing reports folder.")
    parser.add_argument("--reports-dir", help="Use a specific reports folder for dashboard integration.")
    parser.add_argument("--dashboard-dir", default=config.PERFORMANCE_DASHBOARD_DIR, help="Performance dashboard project folder.")
    parser.add_argument("--skip-generator", action="store_true", help="Update dashboard source files without regenerating JSON.")
    args = parser.parse_args()

    if not args.skip_download:
        run_download()

    integrate(
        reports_dir=args.reports_dir,
        dashboard_dir=args.dashboard_dir,
        run_generator=not args.skip_generator,
    )


if __name__ == "__main__":
    main()
