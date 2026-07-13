import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from catalog_spider.lesson_transform import (
    build_semester_catalog,
    semester_key,
    validate_semester_catalog,
)
from catalog_spider.semester_calendar import CALENDAR_OVERRIDES, build_term_calendar


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures() -> SimpleNamespace:
    lessons = json.loads((FIXTURES / "lesson_list_mini.json").read_text(encoding="utf-8"))
    details = json.loads((FIXTURES / "lesson_details_mini.json").read_text(encoding="utf-8"))
    return SimpleNamespace(
        semester={
            "id": 461,
            "nameZh": "2026年秋季学期",
            "start": "2026-08-31",
            "end": "2027-01-17",
        },
        lessons=lessons,
        details_by_code={detail["code"]: detail for detail in details},
    )


def test_semester_key_supports_three_ustc_terms():
    assert semester_key("2026年秋季学期") == "2026-fall"
    assert semester_key("2026年夏季学期") == "2026-summer"
    assert semester_key("2027年春季学期") == "2027-spring"
    assert semester_key("  2027年春季学期  ") == "2027-spring"


def test_semester_key_rejects_unsupported_labels():
    with pytest.raises(ValueError, match="unsupported semester name"):
        semester_key("2026年冬季学期")
    with pytest.raises(ValueError, match="unsupported semester name"):
        semester_key("当前：2026年秋季学期")


def test_build_catalog_keeps_complete_details(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    assert catalog["courses"][0]["grading"] == "百分制"
    detail = catalog["detailsBySection"]["001108.01"]
    assert detail == {
        "code": "001108.01",
        "name": {"cn": "数学实验", "en": "Mathematical Experiment"},
        "dept": "数学科学学院",
        "credit": 2.5,
        "hour": 40,
        "sem": "2026年秋季学期",
        "grading": "百分制",
        "examType": "考试",
        "discipline": "数学",
        "lang": "中文",
        "prerequisite": "Linear algebra",
        "legacyTextbook": "Legacy textbook text",
        "textbooks": [
            {
                "nameZh": "数学实验教程",
                "edition": "第3版",
                "author": "示例作者",
                "publishingHouse": "示例出版社",
                "dates": "2025年8月",
                "isbn": "9780000000001",
                "publish": True,
            }
        ],
        "materials": [
            {
                "nameZh": "课程讲义",
                "edition": "",
                "author": "课程组",
                "publishingHouse": "",
                "dates": "",
                "isbn": "",
                "publish": False,
            }
        ],
        "referenceBooks": "Reference text",
        "description": {"cn": "中文简介", "en": "English description"},
        "syllabus": {
            "periods": 40,
            "documents": {
                "language-zh": {
                    "paragraphs": [{"indexNo": 1, "content": "教学大纲"}]
                }
            },
        },
    }


def test_build_catalog_normalizes_course_fields_and_schedule(fixtures):
    reversed_details = dict(reversed(list(fixtures.details_by_code.items())))
    catalog = build_semester_catalog(
        fixtures.semester,
        list(reversed(fixtures.lessons)),
        reversed_details,
        calendar_overrides={},
    )

    assert [course["id"] for course in catalog["courses"]] == ["001108.01", "001109.02"]
    assert list(catalog["detailsBySection"]) == ["001108.01", "001109.02"]
    assert catalog["courses"][0] == {
        "id": "001108.01",
        "courseName": "数学实验",
        "department": {"code": "001", "name": "数学科学学院"},
        "teacher": "张老师,李老师",
        "credits": 2.5,
        "hours": 40,
        "level": "本科",
        "sectionType": "教学班",
        "category": "专业核心",
        "courseType": "专业基础课",
        "language": "中文",
        "examType": "考试",
        "grading": "百分制",
        "undergradShared": True,
        "enrolled": 48,
        "capacity": 60,
        "classes": ["数学23级"],
        "rawSchedule": "1~16周 5201: 1(1,2); 5301: 3(3,4)",
        "schedule": [
            {"weeks": [1, 16], "room": "5201", "day": 1, "periods": [1, 2]},
            {"weeks": [1, 16], "room": "5301", "day": 3, "periods": [3, 4]},
        ],
    }
    assert catalog["courses"][1]["undergradShared"] is False
    assert catalog["courses"][1]["schedule"] == [
        {"weeks": [2, 2], "room": "5401", "day": 5, "periods": [6, 7]},
        {"weeks": [4, 6, 8, 10], "room": "5401", "day": 5, "periods": [6, 7]},
    ]


def test_schedule_uses_person_text_when_compact_text_omits_weeks(fixtures):
    lesson = {
        **fixtures.lessons[0],
        "code": "001101.01",
        "dateTimePlaceText": "5401: 1(8,9);5401: 3(6,7);5401: 5(3,4)",
        "dateTimePlacePersonText": {
            "cn": (
                "1~9周 5401 :1(8,9) 章俊彦\n"
                "1~9周 5401 :3(6,7) 章俊彦\n"
                "1~9周 5401 :5(3,4) 章俊彦"
            )
        },
    }
    detail = {**fixtures.details_by_code[fixtures.lessons[0]["code"]], "code": lesson["code"]}

    catalog = build_semester_catalog(
        fixtures.semester,
        [lesson],
        {lesson["code"]: detail},
        calendar_overrides={},
    )

    assert catalog["courses"][0]["rawSchedule"] == lesson["dateTimePlaceText"]
    assert catalog["courses"][0]["schedule"] == [
        {"weeks": [1, 9], "room": "5401", "day": 1, "periods": [8, 9]},
        {"weeks": [1, 9], "room": "5401", "day": 3, "periods": [6, 7]},
        {"weeks": [1, 9], "room": "5401", "day": 5, "periods": [3, 4]},
    ]


def test_schedule_deduplicates_person_lines_for_multiple_teachers(fixtures):
    lesson = {
        **fixtures.lessons[0],
        "dateTimePlaceText": "5201: 1(1,2)",
        "dateTimePlacePersonText": {
            "cn": "1~4周 5201 :1(1,2) 张老师\n1~4周 5201 :1(1,2) 李老师"
        },
    }

    catalog = build_semester_catalog(
        fixtures.semester,
        [lesson],
        {lesson["code"]: fixtures.details_by_code[lesson["code"]]},
        calendar_overrides={},
    )

    assert catalog["courses"][0]["schedule"] == [
        {"weeks": [1, 4], "room": "5201", "day": 1, "periods": [1, 2]},
    ]


def test_schedule_keeps_semicolons_inside_person_text_assignment(fixtures):
    lesson = {
        **fixtures.lessons[0],
        "dateTimePlaceText": "复杂地点说明: 4(6,7)",
        "dateTimePlacePersonText": {
            "cn": (
                "2~4,7~9(单),12~16(双),17周 "
                "周四下午6、7节；第7周在操场；第9周在附楼K408 "
                ":4(6,7) 赵老师\n"
                "5~6周 周四下午6、7节；第5周在附楼K104 :4(6,7) 王老师"
            )
        },
    }

    catalog = build_semester_catalog(
        fixtures.semester,
        [lesson],
        {lesson["code"]: fixtures.details_by_code[lesson["code"]]},
        calendar_overrides={},
    )

    schedule = catalog["courses"][0]["schedule"]
    expanded_weeks = set()
    for slot in schedule:
        assert slot["day"] == 4
        assert slot["periods"] == [6, 7]
        if len(slot["weeks"]) == 2:
            expanded_weeks.update(range(slot["weeks"][0], slot["weeks"][1] + 1))
        else:
            expanded_weeks.update(slot["weeks"])
    assert expanded_weeks == {2, 3, 4, 5, 6, 7, 9, 12, 14, 16, 17}


def test_schedule_preserves_clock_time_and_maps_it_to_grid_periods(fixtures):
    lesson = {
        **fixtures.lessons[0],
        "dateTimePlaceText": "国金院5号楼101室: 2(14:00~17:00)",
        "dateTimePlacePersonText": {
            "cn": "2~5,7~9周 国金院5号楼101室 :2(14:00~17:00) 王老师"
        },
    }

    catalog = build_semester_catalog(
        fixtures.semester,
        [lesson],
        {lesson["code"]: fixtures.details_by_code[lesson["code"]]},
        calendar_overrides={},
    )

    assert catalog["courses"][0]["schedule"] == [
        {
            "weeks": [2, 5],
            "room": "国金院5号楼101室",
            "day": 2,
            "periods": [6, 7, 8, 9],
            "startTime": "14:00",
            "endTime": "17:00",
        },
        {
            "weeks": [7, 9],
            "room": "国金院5号楼101室",
            "day": 2,
            "periods": [6, 7, 8, 9],
            "startTime": "14:00",
            "endTime": "17:00",
        },
    ]


def test_schedule_maps_between_period_clock_time_to_nearest_grid_period(fixtures):
    lesson = {
        **fixtures.lessons[0],
        "dateTimePlaceText": "国金院5号楼101室: 2(19:00~19:30)",
        "dateTimePlacePersonText": {
            "cn": "2~4周 国金院5号楼101室 :2(19:00~19:30) 王老师"
        },
    }

    catalog = build_semester_catalog(
        fixtures.semester,
        [lesson],
        {lesson["code"]: fixtures.details_by_code[lesson["code"]]},
        calendar_overrides={},
    )

    slot = catalog["courses"][0]["schedule"][0]
    assert slot["periods"] == [11]
    assert (slot["startTime"], slot["endTime"]) == ("19:00", "19:30")


def test_schedule_splits_two_noncontiguous_parity_weeks(fixtures):
    lesson = {
        **fixtures.lessons[0],
        "dateTimePlaceText": "1~3(单)周 5201: 1(1,2); 2~4(双)周 5301: 2(3,4)",
    }
    detail = fixtures.details_by_code[lesson["code"]]
    catalog = build_semester_catalog(
        fixtures.semester,
        [lesson],
        {lesson["code"]: detail},
        calendar_overrides={},
    )

    assert catalog["courses"][0]["schedule"] == [
        {"weeks": [1, 1], "room": "5201", "day": 1, "periods": [1, 2]},
        {"weeks": [3, 3], "room": "5201", "day": 1, "periods": [1, 2]},
        {"weeks": [2, 2], "room": "5301", "day": 2, "periods": [3, 4]},
        {"weeks": [4, 4], "room": "5301", "day": 2, "periods": [3, 4]},
    ]


def test_build_catalog_normalizes_empty_detail_text(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )

    detail = catalog["detailsBySection"]["001109.02"]
    assert detail["name"]["en"] == ""
    assert detail["grading"] == ""
    assert detail["examType"] == ""
    assert detail["discipline"] == ""
    assert detail["lang"] == ""
    assert detail["prerequisite"] == ""
    assert detail["legacyTextbook"] == ""
    assert detail["textbooks"] == []
    assert detail["materials"] == []
    assert detail["referenceBooks"] == ""
    assert detail["description"] == {"cn": "", "en": ""}
    assert detail["syllabus"] == ""


def test_build_catalog_includes_source_semester_and_calendar(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )

    assert catalog["schemaVersion"] == 1
    assert catalog["source"] == {
        "url": "https://catalog.ustc.edu.cn/query/lesson",
        "semesterId": 461,
    }
    assert catalog["semester"]["key"] == "2026-fall"
    assert catalog["semester"]["calendar"]["weekCount"] == 20


def test_build_catalog_selects_calendar_override_by_semester_key(fixtures):
    override = {
        "sourceUrl": "https://example.test/calendar",
        "holidays": {"2026-10-01": {"label": "休", "name": "测试假期"}},
        "makeupDays": {"2026-10-10": {"label": "补周一课", "useWeekday": 1}},
    }
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={"wrong-key": {}, "2026-fall": override},
    )

    calendar = catalog["semester"]["calendar"]
    assert calendar["sourceUrl"] == override["sourceUrl"]
    assert calendar["holidays"] == override["holidays"]
    assert calendar["makeupDays"] == override["makeupDays"]


def test_validate_catalog_rejects_missing_detail(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    del catalog["detailsBySection"]["001108.01"]
    with pytest.raises(ValueError, match="missing details"):
        validate_semester_catalog(catalog)


def test_validate_catalog_rejects_duplicate_course_ids(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    catalog["courses"].append(dict(catalog["courses"][0]))
    with pytest.raises(ValueError, match="duplicate course ids"):
        validate_semester_catalog(catalog)


def test_validate_catalog_rejects_extra_detail(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    catalog["detailsBySection"]["FOREIGN.01"] = dict(
        catalog["detailsBySection"]["001108.01"],
        code="FOREIGN.01",
    )
    with pytest.raises(ValueError, match="extra details"):
        validate_semester_catalog(catalog)


def test_validate_catalog_rejects_grading_mismatch(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    catalog["courses"][0]["grading"] = "五分制"
    with pytest.raises(ValueError, match="grading mismatch"):
        validate_semester_catalog(catalog)


def test_validate_catalog_rejects_unparsed_nonempty_schedule(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    catalog["courses"][0]["schedule"] = []

    with pytest.raises(ValueError, match="unparsed schedules: 001108.01"):
        validate_semester_catalog(catalog)


def test_validate_catalog_accepts_complete_catalog(fixtures):
    catalog = build_semester_catalog(
        fixtures.semester,
        fixtures.lessons,
        fixtures.details_by_code,
        calendar_overrides={},
    )
    assert validate_semester_catalog(catalog) is None


def test_build_term_calendar_merges_override(fixtures):
    calendar = build_term_calendar(
        fixtures.semester,
        "2026-fall",
        CALENDAR_OVERRIDES["2026-fall"],
    )

    assert calendar["weekStartDate"] == "2026-08-31"
    assert calendar["weekCount"] == 20
    assert calendar["sourceUrl"] == "https://www.teach.ustc.edu.cn/calendar/20135.html"
    assert calendar["holidays"]["2026-10-01"] == {"label": "休", "name": "国庆节"}
    assert calendar["makeupDays"]["2026-10-10"] == {
        "label": "补周二课",
        "useWeekday": 2,
    }


def test_summer_calendar_override_is_explicitly_empty():
    assert CALENDAR_OVERRIDES["2026-summer"] == {}


def test_build_term_calendar_counts_partial_final_week():
    calendar = build_term_calendar(
        {
            "nameZh": "2026年夏季学期",
            "start": "2026-06-29",
            "end": "2026-07-06",
        },
        "2026-summer",
        None,
    )

    assert calendar["weekCount"] == 2
