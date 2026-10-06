"""Tests for server.eval_harness — oracle mode must score 100%.

This proves the harness mechanics AND exercises every Agent Core execution
path (find/confirm-yes/confirm-no/email/text/clarify) end to end.
"""
import json

import pytest

from server.eval_harness import CASES_PATH, _make_oracle_core, run_eval


@pytest.fixture
def _restore_network_tools():
    """The oracle fakes permanently replace module attributes; restore the
    real tools afterwards so later tests aren't silently faked."""
    yield
    from server import eval_harness
    eval_harness._uninstall_oracle_fakes()


def test_oracle_mode_scores_100_percent(_restore_network_tools):
    cases = json.loads(CASES_PATH.read_text())
    assert len(cases) == 60
    report = run_eval(_make_oracle_core, cases, verbose=False)
    assert report["failures"] == [], f"oracle failures: {report['failures']}"
    assert report["accuracy"] == 100.0
