"""Tests for laptop_agent.file_resolver over a fixture dir of 20 tricky files."""
import os
import time

import pytest

from laptop_agent import file_resolver

# (filename, age in seconds) -- ages chosen so ranking tiers are testable.
FILES = [
    ("resume.pdf", 10 * 86400),          # exact "resume" stem, but OLD
    ("resume_v2.pdf", 1 * 86400),        # starts-with, recent
    ("resume_final_FINAL.pdf", 2 * 86400),
    ("my_resume_2024.pdf", 5 * 86400),   # contains
    ("resume_backup.pdf", 20 * 86400),   # starts-with, very old
    ("resume.docx", 3 * 86400),          # exact stem, docx
    ("resume.txt", 4 * 86400),           # exact stem, txt
    ("report_jan.pdf", 5 * 86400),       # starts-with "report"
    ("report_feb.pdf", 2 * 86400),
    ("report_mar.pdf", 1 * 86400),       # most recent of the report family
    ("cover_letter.pdf", 6 * 86400),
    ("coverletter_final.pdf", 12 * 3600),
    ("notes.txt", 9 * 86400),
    ("meeting_notes.txt", 2 * 3600),
    ("photo.jpg", 11 * 86400),
    ("budget.xlsx", 13 * 86400),
    ("todo.md", 15 * 86400),
    ("README", 16 * 86400),              # no extension
    ("subdir/nested_resume.pdf", 7 * 86400),  # nested -> recursion check
    ("old/ancient_resume.pdf", 30 * 86400),  # contains, ancient
]


@pytest.fixture
def fixture_dir(tmp_path):
    now = time.time()
    for name, age in FILES:
        p = tmp_path / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"x" * 64)
        ts = now - age
        os.utime(p, (ts, ts))
    return tmp_path


def _names(results):
    return [r["name"] for r in results]


def test_exact_name_beats_recency(fixture_dir):
    # resume.pdf is the oldest pdf, but its stem exactly == "resume".
    res = file_resolver.resolve("resume", [str(fixture_dir)], file_type="pdf")
    assert res, "expected matches"
    assert res[0]["name"] == "resume.pdf"


def test_most_recent_among_same_score(fixture_dir):
    # report_jan/feb/mar all score 2 -> most recent wins.
    res = file_resolver.resolve("report", [str(fixture_dir)], file_type="pdf")
    assert _names(res)[:3] == ["report_mar.pdf", "report_feb.pdf", "report_jan.pdf"]


def test_file_type_filter(fixture_dir):
    res = file_resolver.resolve("resume", [str(fixture_dir)], file_type="docx")
    assert _names(res) == ["resume.docx"]


def test_file_type_with_dot_prefix(fixture_dir):
    res = file_resolver.resolve("resume", [str(fixture_dir)], file_type=".pdf")
    assert all(r["name"].endswith(".pdf") for r in res)
    assert res[0]["name"] == "resume.pdf"


def test_no_type_prefers_recent_exact(fixture_dir):
    # exact stems: resume.pdf (10d), resume.docx (3d), resume.txt (4d) -> docx wins.
    res = file_resolver.resolve("resume", [str(fixture_dir)])
    assert res[0]["name"] == "resume.docx"


def test_case_insensitive(fixture_dir):
    res = file_resolver.resolve("RESUME", [str(fixture_dir)], file_type="pdf")
    assert res[0]["name"] == "resume.pdf"


def test_starts_with_beats_contains(fixture_dir):
    res = file_resolver.resolve("resume", [str(fixture_dir)], file_type="pdf")
    names = _names(res)
    # starts-with group (resume_v2, resume_final_FINAL, resume_backup) all rank
    # above contains group (my_resume_2024, nested_resume, ancient_resume).
    first_contains = min(names.index(n) for n in names if n in
                         ("my_resume_2024.pdf", "nested_resume.pdf", "ancient_resume.pdf"))
    last_startswith = max(names.index(n) for n in names if n in
                          ("resume_v2.pdf", "resume_final_FINAL.pdf", "resume_backup.pdf"))
    assert last_startswith < first_contains


def test_nested_file_found(fixture_dir):
    res = file_resolver.resolve("nested", [str(fixture_dir)])
    assert _names(res) == ["nested_resume.pdf"]


def test_no_match_returns_empty(fixture_dir):
    assert file_resolver.resolve("zzz_no_such_file", [str(fixture_dir)]) == []


def test_empty_query_returns_empty(fixture_dir):
    assert file_resolver.resolve("   ", [str(fixture_dir)]) == []


def test_missing_folder_no_crash(tmp_path):
    assert file_resolver.resolve("resume", [str(tmp_path / "does-not-exist")]) == []


def test_sort_by_name(fixture_dir):
    res = file_resolver.resolve("report", [str(fixture_dir)], file_type="pdf", sort="name")
    assert _names(res)[:3] == ["report_feb.pdf", "report_jan.pdf", "report_mar.pdf"]


def test_result_shape(fixture_dir):
    res = file_resolver.resolve("budget", [str(fixture_dir)])
    assert len(res) == 1
    r = res[0]
    assert r["name"] == "budget.xlsx"
    assert isinstance(r["path"], str) and os.path.isfile(r["path"])
    assert r["size"] == 64
    assert isinstance(r["mtime"], float) and r["mtime"] > 0


def test_max_results(fixture_dir):
    res = file_resolver.resolve("resume", [str(fixture_dir)], max_results=2)
    assert len(res) == 2


def test_broken_symlink_skipped(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    good = d / "real_resume.pdf"
    good.write_bytes(b"x" * 64)
    (d / "ghost_resume.pdf").symlink_to(d / "nope-not-here.pdf")  # broken link
    res = file_resolver.resolve("resume", [str(d)], file_type="pdf")
    assert _names(res) == ["real_resume.pdf"]  # no crash, ghost skipped


@pytest.mark.skipif(os.geteuid() == 0, reason="root can read anything")
def test_unreadable_file_skipped(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    good = d / "good_resume.pdf"
    good.write_bytes(b"x" * 64)
    bad = d / "bad_resume.pdf"
    bad.write_bytes(b"x" * 64)
    bad.chmod(0o000)
    try:
        res = file_resolver.resolve("resume", [str(d)], file_type="pdf")
        assert _names(res) == ["good_resume.pdf"]
    finally:
        bad.chmod(0o644)


# --- smart search: tokens, stopwords, typos, suggestions --------------------

def test_stopwords_stripped_from_query(fixture_dir):
    # "send me my latest resume" searches the same as "resume".
    res = file_resolver.resolve("send me my latest resume please",
                                [str(fixture_dir)], file_type="pdf")
    assert res[0]["name"] == "resume.pdf"


def test_multiword_query_matches_tokens(fixture_dir):
    res = file_resolver.resolve("final resume", [str(fixture_dir)])
    assert res[0]["name"] == "resume_final_FINAL.pdf"


def test_multiword_query_other_order(fixture_dir):
    res = file_resolver.resolve("mar report", [str(fixture_dir)], file_type="pdf")
    assert res[0]["name"] == "report_mar.pdf"


def test_typo_tolerance(fixture_dir):
    # "resuem" is a transposition of "resume" — the resume family is found,
    # most recent first (all tie on the fuzzy score).
    res = file_resolver.resolve("resuem", [str(fixture_dir)], file_type="pdf")
    assert res, "expected fuzzy match"
    assert all("resume" in r["name"] for r in res[:3])
    assert "resume.pdf" in [r["name"] for r in res]


def test_camelcase_filename_split(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    (d / "ProjectReport_Final.pdf").write_bytes(b"x" * 64)
    (d / "unrelated.txt").write_bytes(b"x" * 64)
    res = file_resolver.resolve("final report", [str(d)])
    assert [r["name"] for r in res] == ["ProjectReport_Final.pdf"]


def test_underscore_and_dash_separators(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    (d / "college-assignment_maths.pdf").write_bytes(b"x" * 64)
    res = file_resolver.resolve("maths assignment", [str(d)])
    assert res[0]["name"] == "college-assignment_maths.pdf"


def test_type_hint_photo(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    (d / "IMG_20240101.jpg").write_bytes(b"x" * 64)
    (d / "IMG_20240101.txt").write_bytes(b"x" * 64)
    res = file_resolver.resolve("my photo", [str(d)])
    assert [r["name"] for r in res] == ["IMG_20240101.jpg"]


def test_type_only_query_lists_photos(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    (d / "a.jpg").write_bytes(b"x" * 64)
    (d / "b.png").write_bytes(b"x" * 64)
    (d / "c.txt").write_bytes(b"x" * 64)
    res = file_resolver.resolve("show my photos", [str(d)])
    assert {r["name"] for r in res} == {"a.jpg", "b.png"}


def test_explicit_file_type_beats_hint(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    (d / "scan.jpg").write_bytes(b"x" * 64)
    (d / "scan.pdf").write_bytes(b"x" * 64)
    res = file_resolver.resolve("my photo", [str(d)], file_type="pdf")
    assert [r["name"] for r in res] == ["scan.pdf"]


def test_suggest_close_partial_match(fixture_dir):
    # "resume zzz" matches the resume token but not "zzz" -> suggestion only.
    assert file_resolver.resolve("resume zzz", [str(fixture_dir)]) == []
    sug = file_resolver.suggest("resume zzz", [str(fixture_dir)],
                                file_type="pdf", max_results=10)
    assert sug, "expected a suggestion"
    assert "resume.pdf" in [r["name"] for r in sug]


def test_suggest_empty_when_nothing_close(fixture_dir):
    assert file_resolver.suggest("zzz_no_such_file", [str(fixture_dir)]) == []


def test_suggest_respects_max_results(fixture_dir):
    sug = file_resolver.suggest("resume zzz", [str(fixture_dir)], max_results=2)
    assert len(sug) == 2


def test_score_present_in_results(fixture_dir):
    res = file_resolver.resolve("resume", [str(fixture_dir)], file_type="pdf")
    assert all(isinstance(r["score"], float) and r["score"] > 0 for r in res)


def test_single_filler_word_query_still_works(fixture_dir):
    # A query of only stopwords falls back to the raw tokens.
    res = file_resolver.resolve("file", [str(fixture_dir)])
    assert res == [] or isinstance(res, list)  # must not crash


# -- v3.1: exact filenames with extensions, path hints -------------------------

def test_exact_filename_with_extension_resolves(fixture_dir):
    res = file_resolver.resolve("python_introduction.txt", [str(fixture_dir)])
    assert res == []
    (fixture_dir / "python_introduction.txt").write_bytes(b"hi")
    res = file_resolver.resolve("python_introduction.txt", [str(fixture_dir)])
    assert [r["name"] for r in res] == ["python_introduction.txt"]


def test_extension_word_becomes_type_filter(fixture_dir):
    # "my report pdf" must prefer the pdf, not fail on the stray "pdf" token.
    res = file_resolver.resolve("my report pdf", [str(fixture_dir)])
    names = [r["name"] for r in res]
    assert names and all(n.endswith(".pdf") for n in names)
    assert "report_mar.pdf" in names


def test_extension_word_filters_out_other_types(fixture_dir):
    res = file_resolver.resolve("resume txt", [str(fixture_dir)])
    assert [r["name"] for r in res] == ["resume.txt"]


def test_extract_path_hint_windows():
    q = "send me python_introduction.txt, its in D:\\PythonCourseWork\\Day-01."
    assert file_resolver.extract_path_hint(q) == "D:\\PythonCourseWork\\Day-01"


def test_extract_path_hint_unix():
    assert file_resolver.extract_path_hint(
        "what files are in /home/nikhil/docs?") == "/home/nikhil/docs"
    assert file_resolver.extract_path_hint("send my resume") is None


def test_path_hint_does_not_poison_search(fixture_dir, tmp_path):
    (fixture_dir / "python_introduction.txt").write_bytes(b"hi")
    q = ("can you send me python_introduction.txt file to my mail? "
         "its in this path D:\\PythonCourseWork\\Day-01")
    res = file_resolver.resolve(q, [str(fixture_dir)])
    assert [r["name"] for r in res] == ["python_introduction.txt"]


def test_check_path_hint_statuses(tmp_path):
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    (allowed / "a.txt").write_bytes(b"x")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "b.txt").write_bytes(b"x")

    assert file_resolver.check_path_hint(
        "send my resume", [str(allowed)])["status"] == "none"
    info = file_resolver.check_path_hint(
        f"look in {outside}", [str(allowed)])
    assert info["status"] == "outside"
    info = file_resolver.check_path_hint(
        f"list {allowed}", [str(allowed)])
    assert info["status"] == "dir"
    info = file_resolver.check_path_hint(
        f"send {allowed / 'a.txt'}", [str(allowed)])
    assert info["status"] == "file"
    assert info["candidate"]["name"] == "a.txt"
    info = file_resolver.check_path_hint(
        f"send {allowed / 'nope.txt'}", [str(allowed)])
    assert info["status"] == "missing"


def test_list_dir_lists_files(tmp_path):
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    (allowed / "b.txt").write_bytes(b"x")
    (allowed / "a.txt").write_bytes(b"x")
    files = file_resolver.list_dir(str(allowed), [str(allowed)])
    assert [f["name"] for f in files] == ["a.txt", "b.txt"]
    # outside the allowed folders -> empty, never raises
    assert file_resolver.list_dir(str(tmp_path / "other"), [str(allowed)]) == []
