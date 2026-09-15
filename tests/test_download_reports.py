import asyncio
import sys
from pathlib import Path
from unittest.mock import Mock

PROJECT_DIR = Path(__file__).resolve().parents[1]
AUTOMATION_DIR = PROJECT_DIR / "automation"
sys.path.insert(0, str(AUTOMATION_DIR))

import download_reports
import check_vahan_connectivity


class FlakyPage:
    def __init__(self):
        self.calls = 0

    async def goto(self, url, wait_until, timeout=None):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("connection reset")
        response = Mock()
        response.ok = True
        return response

    async def wait_for_load_state(self, state, timeout=None):
        return None


def test_goto_with_retries_recovers_after_transient_failure(monkeypatch):
    page = FlakyPage()
    logger = Mock()

    async def no_sleep(_):
        return None

    monkeypatch.setattr(download_reports.asyncio, "sleep", no_sleep)

    asyncio.run(download_reports.goto_with_retries(page, "https://example.test", logger, attempts=2))

    assert page.calls == 2
    logger.warning.assert_called_once()


def test_rto_scope_excludes_kl99():
    assert download_reports.is_in_scope_rto("TRIVANDRUM RTO - KL1( 21-FEB-2019 )")
    assert download_reports.is_in_scope_rto("PAYYANNUR SRTO - KL86( 28-SEP-2020 )")
    assert not download_reports.is_in_scope_rto("TC OFFICE - STA OFFICE - KL99( 14-MAR-2019 )")
    assert download_reports.extract_rto_code("ALUVA SRTO - KL41( 23-MAR-2019 )") == "KL41"


def test_validate_rto_list_requires_every_in_scope_rto_once():
    complete = [f"RTO - KL{number}" for number in range(1, 87)]
    missing = complete[:-1]
    duplicate = complete[:-1] + [complete[0]]

    assert download_reports.validate_rto_list(complete)
    assert not download_reports.validate_rto_list(missing)
    assert not download_reports.validate_rto_list(duplicate)


def test_check_vahan_connectivity_reports_unreachable(monkeypatch):
    def raise_timeout(*args, **kwargs):
        raise TimeoutError("timed out")

    monkeypatch.setattr(check_vahan_connectivity.request, "urlopen", raise_timeout)
    monkeypatch.setattr(check_vahan_connectivity.time, "sleep", lambda _: None)

    result = check_vahan_connectivity.check_url(attempts=2, timeout=1)

    assert result["reachable"] is False
    assert result["attempt"] == 2
    assert len(result["errors"]) == 2
