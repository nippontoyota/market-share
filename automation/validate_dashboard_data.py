import argparse
import csv
import json
import re
from pathlib import Path

import config


REQUIRED_PRODUCTION_FILES = [
    "MASTER_DATA_2026.xlsm",
    "RTO_2025_2026_Combined.csv",
    "RTO_MASTER.xlsm",
    "rto_data.json",
]


def expected_rto_codes(expected_rto_count=config.EXPECTED_RTO_COUNT):
    return {f"KL{number}" for number in range(1, expected_rto_count + 1)}


def normalize_rto_code(value):
    text = str(value or "").upper().strip()
    match = re.search(r"\bKL\s*0*(\d{1,2})\b", text)
    if match:
        return f"KL{int(match.group(1))}"
    return re.sub(r"\s+", "", text)


def collect_json_rto_codes(data):
    codes = set()
    if not isinstance(data, dict) or not data:
        raise RuntimeError("rto_data.json must contain at least one dashboard cluster.")

    for cluster_name, cluster in data.items():
        if not isinstance(cluster, dict):
            raise RuntimeError(f"Cluster {cluster_name!r} is not a JSON object.")
        sub_rtos = cluster.get("subRtoCodes")
        if not isinstance(sub_rtos, list):
            raise RuntimeError(f"Cluster {cluster_name!r} is missing subRtoCodes.")
        codes.update(normalize_rto_code(code) for code in sub_rtos)

    return codes


def collect_csv_rto_codes(csv_path):
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        codes = {
            normalize_rto_code(row.get("RTO_clean") or row.get("RTO"))
            for row in reader
            if row.get("Year") == "2026"
        }
    return {code for code in codes if code}


def validate_dashboard_snapshot(
    dashboard_dir=None,
    expected_rto_count=config.EXPECTED_RTO_COUNT,
    require_vahan_workbook=False,
):
    dashboard_dir = Path(dashboard_dir or config.PERFORMANCE_DASHBOARD_DIR)
    required_files = list(REQUIRED_PRODUCTION_FILES)
    if require_vahan_workbook:
        required_files.append("VAHAN_KERALA_MASTER1.xlsm")

    missing = [name for name in required_files if not (dashboard_dir / name).is_file()]
    if missing:
        raise RuntimeError(f"Missing required dashboard files: {', '.join(missing)}")

    data_path = dashboard_dir / "rto_data.json"
    try:
        data = json.loads(data_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"rto_data.json is not valid JSON: {exc}") from exc

    expected_codes = expected_rto_codes(expected_rto_count)
    json_codes = collect_json_rto_codes(data)
    if json_codes != expected_codes:
        missing_codes = sorted(expected_codes - json_codes)
        extra_codes = sorted(json_codes - expected_codes)
        raise RuntimeError(
            "rto_data.json RTO coverage mismatch. "
            f"Missing: {missing_codes}. Extra: {extra_codes}."
        )

    csv_codes = collect_csv_rto_codes(dashboard_dir / "RTO_2025_2026_Combined.csv")
    if csv_codes != expected_codes:
        missing_codes = sorted(expected_codes - csv_codes)
        extra_codes = sorted(csv_codes - expected_codes)
        raise RuntimeError(
            "RTO_2025_2026_Combined.csv RTO coverage mismatch. "
            f"Missing: {missing_codes}. Extra: {extra_codes}."
        )

    return {
        "dashboard_dir": str(dashboard_dir.resolve()),
        "rto_count": len(expected_codes),
        "cluster_count": len(data),
    }


def main():
    parser = argparse.ArgumentParser(description="Validate production dashboard data files.")
    parser.add_argument("--dashboard-dir", default=config.PERFORMANCE_DASHBOARD_DIR)
    parser.add_argument("--require-vahan-workbook", action="store_true")
    args = parser.parse_args()

    summary = validate_dashboard_snapshot(
        dashboard_dir=args.dashboard_dir,
        require_vahan_workbook=args.require_vahan_workbook,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
