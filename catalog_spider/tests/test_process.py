import json
from pathlib import Path
from catalog_spider.process import count_modules_and_courses, build_index_row

FIX = Path(__file__).parent / "fixtures" / "program_3413.json"


def test_count_modules_and_courses():
    raw = json.loads(FIX.read_text(encoding="utf-8"))
    m, c = count_modules_and_courses(raw)
    assert m >= 6  # moduleTree 顶层 6 个根
    assert c > 0  # 3413 实际有几十门课


def test_build_index_row_has_required_fields():
    raw = json.loads(FIX.read_text(encoding="utf-8"))
    row = build_index_row(3413, raw)
    assert row["id"] == 3413
    assert row["grade"] == "2026"
    assert row["trainType"] == "主修"
    assert row["department"] == "少年班学院"
    assert row["major"] == "自动化"
    assert row["awardDegree"] is True
    assert "moduleCount" in row and "courseCount" in row


def test_build_index_row_handles_missing_subfields():
    """education/studentType/department 等可能为 null"""
    raw = {"moduleTree": [], "grade": "2020", "trainType": "主修"}
    row = build_index_row(99, raw)
    assert row["id"] == 99
    assert row["department"] is None
    assert row["major"] is None
    assert row["moduleCount"] == 0
    assert row["courseCount"] == 0