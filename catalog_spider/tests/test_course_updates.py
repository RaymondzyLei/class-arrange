from copy import deepcopy

from catalog_spider.course_updates import build_catalog_publication, catalog_revision


def _course(
    code: str,
    *,
    name: str = "高等数学",
    teacher: str = "张老师",
    room: str = "5101",
    campus: str = "本部",
    enrolled: int = 10,
    capacity: int = 30,
    level: str = "本科",
) -> dict:
    return {
        "id": code,
        "courseName": name,
        "department": {"code": "001", "name": "数学学院"},
        "teacher": teacher,
        "credits": 4,
        "hours": 64,
        "level": level,
        "sectionType": "计划内",
        "category": "",
        "courseType": "理论课",
        "language": "中文",
        "examType": "闭卷",
        "grading": "百分制",
        "undergradShared": False,
        "enrolled": enrolled,
        "capacity": capacity,
        "classes": ["2026级"],
        "rawSchedule": f"{room}: 1(1,2)",
        "schedule": [
            {
                "weeks": [1, 16],
                "room": room,
                "day": 1,
                "periods": [1, 2],
                "campus": campus,
            }
        ],
    }


def _catalog(*courses: dict, generated_at: str = "2026-07-15T00:00:00Z") -> dict:
    return {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "source": {"kind": "test"},
        "semester": {
            "key": "2026-fall",
            "name": "2026年秋季学期",
            "startDate": "2026-08-31",
            "endDate": "2027-01-17",
            "calendar": {
                "termStartDate": "2026-08-31",
                "termEndDate": "2027-01-17",
                "weekStartDate": "2026-08-31",
                "weekCount": 20,
            },
        },
        "courses": list(courses),
        "detailsBySection": {
            course["id"]: {
                "code": course["id"],
                "name": {"cn": course["courseName"], "en": "Calculus"},
                "description": {"cn": "课程简介", "en": "Description"},
            }
            for course in courses
        },
    }


def test_revision_ignores_generated_time_and_enrolled_count():
    first = _catalog(_course("MATH100.01", enrolled=10))
    second = _catalog(
        _course("MATH100.01", enrolled=29),
        generated_at="2026-07-16T00:00:00Z",
    )

    assert catalog_revision(first) == catalog_revision(second)


def test_teacher_order_does_not_create_a_catalog_update():
    previous = _catalog(
        _course("BIOL5042P.01", teacher="周荣斌,江维,王夏琼,符传孩,马洪第")
    )
    current = _catalog(
        _course("BIOL5042P.01", teacher="江维,周荣斌,符传孩,王夏琼,马洪第"),
        generated_at="2026-07-16T00:00:00Z",
    )

    published, feed = build_catalog_publication(previous, current, None)

    assert catalog_revision(previous) == published["revision"]
    assert feed["entries"] == []


def test_publication_records_meaningful_changes_and_keeps_feed_idempotent():
    previous = _catalog(_course("MATH100.01", capacity=30))
    current = _catalog(_course("MATH100.01", teacher="李老师", capacity=40))

    published, feed = build_catalog_publication(previous, current, None)
    repeated, repeated_feed = build_catalog_publication(published, deepcopy(current), feed)

    assert published["revision"] == feed["currentRevision"]
    assert feed["entries"][0]["summary"] == {"added": 0, "removed": 0, "modified": 1}
    changes = feed["entries"][0]["modified"][0]["changes"]
    assert [(change["field"], change["label"]) for change in changes] == [
        ("teacher", "授课教师"),
        ("capacity", "课容量"),
    ]
    assert repeated["revision"] == published["revision"]
    assert repeated_feed == feed


def test_removed_classroom_includes_likely_replacement_without_auto_replacing():
    previous = _catalog(_course("MATH100.01"), _course("PHYS100.01", name="大学物理"))
    current = _catalog(_course("MATH100.02"), _course("PHYS100.01", name="大学物理"))

    _published, feed = build_catalog_publication(previous, current, None)

    removed = feed["entries"][0]["removed"][0]
    assert removed["course"]["id"] == "MATH100.01"
    assert [candidate["id"] for candidate in removed["replacementCandidates"]] == [
        "MATH100.02"
    ]
    assert "replacementId" not in removed


def test_detail_only_change_is_summarized_without_embedding_large_html():
    previous = _catalog(_course("MATH100.01"))
    current = deepcopy(previous)
    current["detailsBySection"]["MATH100.01"]["description"]["cn"] = "更新后的长简介"

    _published, feed = build_catalog_publication(previous, current, None)

    change = feed["entries"][0]["modified"][0]["changes"][0]
    assert change == {"field": "details", "label": "课程简介或教学大纲"}
    assert "更新后的长简介" not in str(feed)


def test_time_only_change_does_not_also_report_a_location_change():
    previous = _catalog(_course("MATH100.01"))
    current = deepcopy(previous)
    current["courses"][0]["schedule"][0]["day"] = 2

    _published, feed = build_catalog_publication(previous, current, None)

    fields = [
        change["field"]
        for change in feed["entries"][0]["modified"][0]["changes"]
    ]
    assert fields == ["schedule"]


def test_extending_time_ranges_at_one_location_only_reports_a_time_change():
    previous = _catalog(_course("MATH100.01"))
    current = deepcopy(previous)
    current["courses"][0]["schedule"].append(
        {
            "weeks": [17, 18],
            "room": "5101",
            "day": 1,
            "periods": [1, 2],
            "campus": "本部",
        }
    )

    _published, feed = build_catalog_publication(previous, current, None)

    fields = [
        change["field"]
        for change in feed["entries"][0]["modified"][0]["changes"]
    ]
    assert fields == ["schedule"]


def test_splitting_one_occupied_time_range_does_not_create_a_course_change():
    previous = _catalog(_course("MATH100.01"))
    previous["courses"][0]["schedule"][0]["weeks"] = [8, 13]
    current = deepcopy(previous)
    current["courses"][0]["schedule"] = [
        {
            **current["courses"][0]["schedule"][0],
            "weeks": [8, 9],
        },
        {
            **current["courses"][0]["schedule"][0],
            "weeks": [10, 13],
        },
    ]

    _published, feed = build_catalog_publication(previous, current, None)

    entry = feed["entries"][0]
    assert entry["summary"] == {"added": 0, "removed": 0, "modified": 0}
    assert entry["modified"] == []


def test_education_level_change_is_recorded_in_update_snapshots():
    previous = _catalog(_course("MATH100.01", level="本科"))
    current = _catalog(_course("MATH100.01", level="研究生"))

    _published, feed = build_catalog_publication(previous, current, None)

    modified = feed["entries"][0]["modified"][0]
    assert modified["previous"]["level"] == "本科"
    assert modified["current"]["level"] == "研究生"
    assert modified["changes"] == [
        {
            "field": "level",
            "label": "学历层次",
            "before": "本科",
            "after": "研究生",
        }
    ]
