from pathlib import Path
from catalog_spider.tree import extract_programs, program_ids, filter_by_min_grade

FIX = Path(__file__).parent / "fixtures" / "program_tree_mini.json"


def test_extract_programs_returns_flat_list():
    progs = extract_programs(FIX)
    # fixture: 3 (数学) + 1 (信计) + 2 (计科) = 6
    assert len(progs) == 6
    assert all("id" in p and "nameZh" in p and "grade" in p and "trainType" in p for p in progs)


def test_extract_programs_includes_dept_major_context():
    progs = extract_programs(FIX)
    cs = [p for p in progs if p["id"] == 3413][0]
    assert cs["department"] == "信息科学技术学院"
    assert cs["major"] == "计算机科学与技术"


def test_program_ids_extracts_int_ids_sorted_unique():
    progs = extract_programs(FIX)
    ids = program_ids(progs)
    assert all(isinstance(i, int) for i in ids)
    assert ids == sorted(set(ids))
    assert 3413 in ids and 41 in ids


def test_filter_by_min_grade_keeps_only_recent():
    """仅保留 grade >= 2020 的 program（用户明确：避免 JSON 过大）"""
    progs = [
        {"id": 1, "grade": "2018"}, {"id": 2, "grade": "2020"},
        {"id": 3, "grade": "2025"}, {"id": 4, "grade": None},
        {"id": 5}, {"id": 6, "grade": "abc"},  # grade 异常
    ]
    out = filter_by_min_grade(progs, 2020)
    assert [p["id"] for p in out] == [2, 3]


def test_filter_by_min_grade_uses_real_fixture():
    """fixture: grade 2017-2026，min=2020 应过滤掉 2017-2019，留 2020/2024/2026"""
    progs = extract_programs(FIX)
    out = filter_by_min_grade(progs, 2020)
    grades = sorted(p["grade"] for p in out)
    assert grades == ["2020", "2024", "2026"]