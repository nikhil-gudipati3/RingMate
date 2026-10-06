"""Tests for laptop_agent.safety: path confinement, size limits, read-only API."""
import inspect

import pytest

from laptop_agent import safety
from laptop_agent.safety import SafetyError, check_size, resolve_inside


def test_inside_allowed(tmp_path):
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    target = allowed / "sub" / "file.pdf"
    got = resolve_inside(str(target), [str(allowed)])
    assert got.is_absolute()
    assert got == target.resolve()


def test_dotdot_escape_blocked(tmp_path):
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    evil = allowed / ".." / "outside" / "secret.txt"
    with pytest.raises(SafetyError):
        resolve_inside(str(evil), [str(allowed)])


def test_absolute_path_outside_blocked(tmp_path):
    inside = tmp_path / "inside"
    inside.mkdir()
    outside = tmp_path / "outside" / "x.pdf"
    with pytest.raises(SafetyError):
        resolve_inside(str(outside), [str(inside)])


def test_sibling_prefix_not_enough(tmp_path):
    # /tmp/x/allowed2 must NOT pass as inside /tmp/x/allowed
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    sibling = tmp_path / "allowed2"
    sibling.mkdir()
    with pytest.raises(SafetyError):
        resolve_inside(str(sibling / "f.pdf"), [str(allowed)])


def test_symlink_escape_blocked(tmp_path):
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("top secret")
    link = allowed / "innocent_link.txt"
    link.symlink_to(secret)
    with pytest.raises(SafetyError):
        resolve_inside(str(link), [str(allowed)])


def test_no_allowed_folders_blocked(tmp_path):
    with pytest.raises(SafetyError):
        resolve_inside(str(tmp_path / "f.pdf"), [])


def test_multiple_allowed_folders(tmp_path):
    a = tmp_path / "a"
    b = tmp_path / "b"
    a.mkdir()
    b.mkdir()
    assert resolve_inside(str(b / "f.pdf"), [str(a), str(b)]) == (b / "f.pdf").resolve()


def test_check_size_ok(tmp_path):
    p = tmp_path / "small.pdf"
    p.write_bytes(b"x" * 1500)
    check_size(p, 1)  # 1500 bytes < 1 MB -> no raise


def test_check_size_blocked(tmp_path):
    p = tmp_path / "big.pdf"
    p.write_bytes(b"x" * 1500)
    with pytest.raises(SafetyError):
        check_size(p, 0)  # 1500 bytes > 0 MB


def test_check_size_missing_file(tmp_path):
    with pytest.raises(SafetyError):
        check_size(tmp_path / "nope.pdf", 5)


def test_no_write_or_delete_api():
    """safety.py must stay read-only: no function may be named like a writer."""
    forbidden = ("write", "delete", "unlink", "remove")
    funcs = [name for name, _ in inspect.getmembers(safety, inspect.isfunction)]
    bad = [n for n in funcs if any(w in n.lower() for w in forbidden)]
    assert not bad, f"safety.py must not expose write/delete functions, found: {bad}"
    assert funcs, "safety.py should expose at least one function"
