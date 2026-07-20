"""Build deterministic catalog revisions and compact browser-facing update feeds."""

from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from typing import Any


_COURSE_FIELD_LABELS = (
    ("courseName", "课程名称"),
    ("department", "开课单位"),
    ("teacher", "授课教师"),
    ("credits", "学分"),
    ("hours", "学时"),
    ("level", "课程层次"),
    ("sectionType", "教学班类型"),
    ("category", "课程类别"),
    ("courseType", "课程类型"),
    ("language", "授课语言"),
    ("examType", "考试方式"),
    ("grading", "成绩记录方式"),
    ("undergradShared", "本研共享"),
    ("capacity", "课容量"),
    ("classes", "面向班级"),
)


def _normalized_teacher(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return ",".join(sorted(part.strip() for part in value.split(",") if part.strip()))


def _course_code(classroom_id: str) -> str:
    return classroom_id.rsplit(".", maxsplit=1)[0]


def _canonical_catalog(catalog: dict) -> dict:
    canonical = deepcopy(catalog)
    canonical.pop("generatedAt", None)
    canonical.pop("revision", None)
    courses = []
    for raw_course in canonical.get("courses", []):
        course = dict(raw_course)
        course.pop("enrolled", None)
        course.pop("rawSchedule", None)
        course["teacher"] = _normalized_teacher(course.get("teacher"))
        courses.append(course)
    canonical["courses"] = sorted(courses, key=lambda course: course.get("id", ""))
    details = canonical.get("detailsBySection", {})
    canonical["detailsBySection"] = {
        key: details[key]
        for key in sorted(details)
    }
    return canonical


def catalog_revision(catalog: dict) -> str:
    """Return a content hash excluding volatile collection metadata."""

    serialized = json.dumps(
        _canonical_catalog(catalog),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _selected_snapshot(course: dict) -> dict:
    classroom_id = course["id"]
    return {
        "id": classroom_id,
        "courseCode": _course_code(classroom_id),
        "courseName": course.get("courseName", ""),
        "teacher": course.get("teacher", ""),
        "schedule": deepcopy(course.get("schedule", [])),
    }


def _identity(course: dict) -> dict:
    snapshot = _selected_snapshot(course)
    return {
        "id": snapshot["id"],
        "courseCode": snapshot["courseCode"],
        "courseName": snapshot["courseName"],
        "teacher": snapshot["teacher"],
    }


def _schedule_time(schedule: list[dict]) -> list[dict]:
    keys = ("weeks", "day", "periods", "startTime", "endTime")
    return [
        {key: deepcopy(slot[key]) for key in keys if key in slot}
        for slot in schedule
    ]


def _schedule_location(schedule: list[dict]) -> list[dict]:
    locations = {
        (slot.get("campus", ""), slot.get("room", "")): {
            "room": deepcopy(slot.get("room", "")),
            "campus": deepcopy(slot.get("campus", "")),
        }
        for slot in schedule
    }
    return [locations[key] for key in sorted(locations)]


def _value_change(field: str, label: str, before: Any, after: Any) -> dict:
    return {
        "field": field,
        "label": label,
        "before": deepcopy(before),
        "after": deepcopy(after),
    }


def _course_changes(
    old_course: dict,
    new_course: dict,
    old_detail: object,
    new_detail: object,
) -> list[dict]:
    changes = []
    for field, label in _COURSE_FIELD_LABELS:
        before = old_course.get(field)
        after = new_course.get(field)
        if field == "teacher":
            values_match = _normalized_teacher(before) == _normalized_teacher(after)
        else:
            values_match = before == after
        if not values_match:
            changes.append(
                _value_change(field, label, before, after)
            )

    old_schedule = old_course.get("schedule", [])
    new_schedule = new_course.get("schedule", [])
    old_time = _schedule_time(old_schedule)
    new_time = _schedule_time(new_schedule)
    if old_time != new_time:
        changes.append(_value_change("schedule", "上课时间与周次", old_time, new_time))

    old_location = _schedule_location(old_schedule)
    new_location = _schedule_location(new_schedule)
    if old_location != new_location:
        changes.append(
            _value_change("location", "上课地点或校区", old_location, new_location)
        )

    if old_detail != new_detail:
        changes.append({"field": "details", "label": "课程简介或教学大纲"})
    return changes


def _replacement_candidates(removed: dict, current_courses: dict[str, dict]) -> list[dict]:
    removed_code = _course_code(removed["id"])
    exact_code = [
        course
        for course in current_courses.values()
        if _course_code(course["id"]) == removed_code
    ]
    candidates = exact_code or [
        course
        for course in current_courses.values()
        if course.get("courseName") == removed.get("courseName")
    ]
    return [_selected_snapshot(course) for course in sorted(candidates, key=lambda item: item["id"])]


def _diff_catalogs(previous: dict, current: dict) -> dict:
    old_courses = {course["id"]: course for course in previous.get("courses", [])}
    new_courses = {course["id"]: course for course in current.get("courses", [])}
    old_ids = set(old_courses)
    new_ids = set(new_courses)

    added = [
        _selected_snapshot(new_courses[course_id])
        for course_id in sorted(new_ids - old_ids)
    ]
    removed = []
    for course_id in sorted(old_ids - new_ids):
        course = old_courses[course_id]
        removed.append(
            {
                "course": _selected_snapshot(course),
                "replacementCandidates": _replacement_candidates(course, new_courses),
            }
        )

    old_details = previous.get("detailsBySection", {})
    new_details = current.get("detailsBySection", {})
    modified = []
    for course_id in sorted(old_ids & new_ids):
        changes = _course_changes(
            old_courses[course_id],
            new_courses[course_id],
            old_details.get(course_id),
            new_details.get(course_id),
        )
        if changes:
            modified.append(
                {
                    "course": _identity(new_courses[course_id]),
                    "previous": _selected_snapshot(old_courses[course_id]),
                    "current": _selected_snapshot(new_courses[course_id]),
                    "changes": changes,
                }
            )
    return {"added": added, "removed": removed, "modified": modified}


def build_catalog_publication(
    previous_catalog: dict | None,
    catalog: dict,
    existing_feed: dict | None,
) -> tuple[dict, dict]:
    """Attach a revision and append one idempotent update batch when needed."""

    published = deepcopy(catalog)
    revision = catalog_revision(published)
    published["revision"] = revision
    semester_key = published["semester"]["key"]

    feed = deepcopy(existing_feed) if existing_feed else {
        "schemaVersion": 1,
        "semesterKey": semester_key,
        "currentRevision": revision,
        "entries": [],
    }
    feed["currentRevision"] = revision

    if previous_catalog is None:
        return published, feed

    previous_revision = catalog_revision(previous_catalog)
    if previous_revision == revision:
        return published, feed

    diff = _diff_catalogs(previous_catalog, published)
    entry_id = f"{semester_key}:{revision[:16]}"
    if not any(entry.get("id") == entry_id for entry in feed.get("entries", [])):
        entry = {
            "id": entry_id,
            "revision": revision,
            "previousRevision": previous_revision,
            "publishedAt": published.get("generatedAt", ""),
            "summary": {
                "added": len(diff["added"]),
                "removed": len(diff["removed"]),
                "modified": len(diff["modified"]),
            },
            **diff,
        }
        feed.setdefault("entries", []).append(entry)
    return published, feed
