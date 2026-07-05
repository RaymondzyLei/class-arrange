import json
from pathlib import Path
from catalog_spider.process import build_index_row, build_programs_index, count_modules_and_courses, group_by_term

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


def test_group_by_term_uses_module_path():
    raw = json.loads(FIX.read_text(encoding="utf-8"))
    out = group_by_term(raw)
    assert isinstance(out, dict)
    # 至少有一个学期 key
    assert any(k.startswith("1") for k in out)
    # 每条记录包含用户确认的必填字段
    for courses in out.values():
        for co in courses:
            assert "code" in co and "name" in co and "credits" in co
            assert "compulsory" in co and "modulePath" in co


def test_group_by_term_module_path_nested():
    """通修课程 > 计算机通修 应出现在 modulePath（3413 含 CS1003）"""
    raw = json.loads(FIX.read_text(encoding="utf-8"))
    out = group_by_term(raw)
    cs1003 = next((c for cs in out.values() for c in cs if c["code"] == "CS1003"), None)
    assert cs1003 is not None
    assert "通修课程" in cs1003["modulePath"]


def test_group_by_term_handles_null_terms():
    """部分课程 terms 为 null，应归到 '未指定学期'"""
    raw = {
        "moduleTree": [
            {
                "self": {"type": "X", "courses": [{"terms": None, "compulsory": False, "course": {"code": "TEST", "nameZh": "测试", "credits": 2}}]},
                "children": [],
            }
        ]
    }
    out = group_by_term(raw)
    assert "未指定学期" in out
    assert out["未指定学期"][0]["code"] == "TEST"