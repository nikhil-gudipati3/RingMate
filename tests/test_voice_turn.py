"""Run the node unit tests for web/voice_turn.js (turn-taking decisions).

The turn-taking logic is pure JS with no DOM dependencies, so it is tested
directly with node's built-in test runner. This pytest wrapper keeps it part
of the strict suite: any voice_turn.js regression fails the whole build.
"""
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def test_voice_turn_js_suite():
    node = shutil.which("node")
    if node is None:
        import pytest
        pytest.skip("node not installed; cannot run voice_turn.js tests")
    proc = subprocess.run(
        [node, str(REPO / "tests" / "voice_turn.test.js")],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode == 0, (
        "voice_turn.test.js failed:\n" + proc.stdout + "\n" + proc.stderr
    )
