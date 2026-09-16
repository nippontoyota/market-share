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

# Vahan's maker/month report defaults to every vehicle type a maker
# registers (taxis/"Motor Cab", buses, goods carriers, etc.), not just
# private cars. Ticking Vehicle Category=LIGHT MOTOR VEHICLE and Vehicle
# Class=MOTOR CAR restricts it to cars only, matching what the dealer
# checks manually on Vahan's own site. Verified end-to-end (checkbox
# state -> submitted request -> exported file) against a live Vahan
# session: Kerala-wide Toyota Sep 2026 = 654 (matches Vahan's own UI)
# vs 739 unfiltered.
VEHICLE_FILTER_LABELS = ["LIGHT MOTOR VEHICLE", "MOTOR CAR"]

# Selectors mapped to fixed filters
SELECTORS = {
    # VAHAN doesn't give the State dropdown a stable id (it's JSF-auto-numbered
    # and shifts whenever the portal is redeployed), so anchor on the visible
    # "State:" text instead of a hardcoded j_idtNN id.
    "state_label": "xpath=//label[normalize-space()='State:']/following-sibling::div[contains(@class,'ui-selectonemenu')]//label",
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

    # The left filter sidebar (Vehicle Category/Class checkboxes) is a
    # collapsible pane that loads closed (display:none) until this is clicked.
    "sidebar_toggler": "#filterLayout-toggler",

    # Vehicle Category/Class checkbox ids (VhCatg:N, VhClass:N) are NOT
    # stable -- they re-index every time the RTO selection changes -- so
    # always anchor on the visible label text, never cache the id/for.
    "vehicle_filter_label": "xpath=//label[@for and normalize-space()='{}']",

    # This report has TWO independent "Refresh" buttons and they are not
    # interchangeable. The top one (near State/Y-Axis/X-Axis) rebuilds the
    # Maker x Month table from scratch but silently discards the Vehicle
    # Category/Class selection. The bottom one, inside the filter sidebar
    # below the Norms list, updates that same table in place using the
    # currently-checked category/class filters WITHOUT resetting them.
    # Verified sequence: click top once to build the table, THEN check the
    # vehicle filters, THEN use the bottom one (here and on every
    # subsequent RTO change) to actually apply them.
    "sidebar_refresh_btn": "xpath=//div[@id='filterLayout']//button[normalize-space()='Refresh']",

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
    "navigation": 60000,
    "network_idle_after_navigation": 15000,
    "table_load": 45000,
    "between_iterations": 2, # polite delay in seconds
}
