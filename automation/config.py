import os
from pathlib import Path

# Target URL
TARGET_URL = "https://vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml"

# Fixed Filter Values
FILTERS = {
    "State": "Kerala(87)",
    "Y-Axis": "Maker",
    "X-Axis": "Month Wise",
    "Year Type": "Calendar Year",
    "Year": "2026"
}

# Selectors mapped to fixed filters
SELECTORS = {
    "state_label": "label#j_idt36_label",
    "state_items": "li[data-label='{}']",

    "rto_label": "label#selectedRto_label",
    "rto_items": "ul#selectedRto_items li",
    "rto_item_specific": "ul#selectedRto_items li[data-label='{}']",

    "yaxis_label": "label#yaxisVar_label",
    "yaxis_item": "ul#yaxisVar_items li[data-label='{}']",

    "xaxis_label": "label#xaxisVar_label",
    "xaxis_item": "ul#xaxisVar_items li[data-label='{}']",

    "yeartype_label": "label#selectedYearType_label",
    "yeartype_item": "ul#selectedYearType_items li[data-label='{}']",

    "year_label": "label#selectedYear_label",
    "year_item": "ul#selectedYear_items li[data-label='{}']",

    "refresh_btn": "button:has-text('Refresh')",
    "export_btn": "a:has(img[src*='csv.png'])",
    "table_row": "tbody.ui-datatable-data tr"
}

# Output Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
REPORTS_DIR = str(PROJECT_DIR / "reports")
LOGS_DIR = str(PROJECT_DIR / "logs")
PERFORMANCE_DASHBOARD_DIR = os.environ.get(
    "PERFORMANCE_DASHBOARD_DIR",
    str(PROJECT_DIR)
)
EXPECTED_RTO_COUNT = 86

# Timeouts & Delays
TIMEOUTS = {
    "global_timeout": 90000,
    "table_load": 45000,
    "between_iterations": 2, # polite delay in seconds
}
