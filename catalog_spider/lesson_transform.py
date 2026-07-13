"""Pure transformation from USTC lesson responses to the frontend catalog."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import re
from typing import Any

from .semester_calendar import build_term_calendar


TERM_NAMES = {"春季": "spring", "夏季": "summer", "秋季": "fall"}
SOURCE_URL = "https://catalog.ustc.edu.cn/query/lesson"

_SLOT_RE = re.compile(r"(\d+)\s*\((\d+(?:,\d+)*)\)")
_WEEK_HEAD_RE = re.compile(r"^([0-9~,()单双]+周)")
_TEXTBOOK_FIELDS = (
    "nameZh",
    "edition",
    "author",
    "publishingHouse",
    "dates",
    "isbn",
)


def semester_key(name_zh: str) -> str:
    match = re.fullmatch(r"(\d{4})年(春季|夏季|秋季)学期", name_zh.strip())
    if not match:
        raise ValueError(f"unsupported semester name: {name_zh}")
    return f"{match.group(1)}-{TERM_NAMES[match.group(2)]}"


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _localized(value: Any, *, language: str = "cn") -> str:
    if not isinstance(value, dict):
        return _text(value)
    keys = (language, "nameZh" if language == "cn" else "nameEn", "name", "cn")
    for key in keys:
        if key in value and value[key] is not None:
            return _text(value[key])
    return ""


def _number(value: Any) -> int | float:
    if value is None or value == "":
        return 0
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0
    return int(number) if number.is_integer() else number


def _integer(value: Any) -> int:
    return int(_number(value))


def _boolean(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    return bool(value)


def _parse_week_ranges(value: str) -> list[list[int]]:
    ranges: list[list[int]] = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        match = re.fullmatch(r"(\d+)\s*~\s*(\d+)(?:\((单|双)\))?", part)
        if match:
            start, end = int(match.group(1)), int(match.group(2))
            parity = match.group(3)
            if parity == "单":
                weeks = [week for week in range(start, end + 1) if week % 2 == 1]
                if len(weeks) == 2:
                    ranges.extend([[week, week] for week in weeks])
                else:
                    ranges.append(weeks)
            elif parity == "双":
                weeks = [week for week in range(start, end + 1) if week % 2 == 0]
                if len(weeks) == 2:
                    ranges.extend([[week, week] for week in weeks])
                else:
                    ranges.append(weeks)
            else:
                ranges.append([start, end])
            continue
        if part.isdigit():
            week = int(part)
            ranges.append([week, week])
    return [week_range for week_range in ranges if week_range]


def _schedule_slots(raw: Any) -> list[dict]:
    if not raw:
        return []
    text = _text(raw)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = (
        text.replace("_x000d_", "")
        .replace("；", ";")
        .replace("，", ",")
        .replace("～", "~")
        .replace("（", "(")
        .replace("）", ")")
        .replace("：", ":")
    )
    slots: list[dict] = []
    for line in text.splitlines():
        current_weeks: list[list[int]] = []
        for segment in line.split(";"):
            segment = segment.strip()
            if not segment:
                continue
            week_match = _WEEK_HEAD_RE.match(segment)
            if week_match:
                current_weeks = _parse_week_ranges(week_match.group(1)[:-1])
                segment = segment[week_match.end() :].strip()
            if not current_weeks or not segment:
                continue

            room, separator, times = segment.partition(":")
            if not separator:
                pieces = segment.split(maxsplit=1)
                room = pieces[0] if pieces and not _SLOT_RE.fullmatch(pieces[0]) else ""
                times = pieces[1] if len(pieces) == 2 else segment
            room = room.strip()
            for slot_match in _SLOT_RE.finditer(times):
                day = int(slot_match.group(1))
                periods = [int(period) for period in slot_match.group(2).split(",")]
                for week_range in current_weeks:
                    weeks = (
                        week_range
                        if len(week_range) > 2
                        else [min(week_range), max(week_range)]
                    )
                    slots.append(
                        {
                            "weeks": weeks,
                            "room": room,
                            "day": day,
                            "periods": periods,
                        }
                    )
    return slots


def _normalize_textbook(textbook: dict) -> dict:
    normalized = {field: _text(textbook.get(field)) for field in _TEXTBOOK_FIELDS}
    normalized["publish"] = _boolean(textbook.get("publish"))
    return normalized


def _normalize_detail(section_code: str, detail: dict) -> dict:
    name = detail.get("name") if isinstance(detail.get("name"), dict) else {}
    description = detail.get("desc") if isinstance(detail.get("desc"), dict) else {}
    english_name = _text(name.get("en"))
    if english_name == "1":
        english_name = ""

    textbooks: list[dict] = []
    materials: list[dict] = []
    for source in detail.get("textbooks") or []:
        normalized = _normalize_textbook(source)
        (textbooks if normalized["publish"] else materials).append(normalized)

    syllabus = detail.get("syllabus")
    return {
        "code": _text(detail.get("code")) or section_code,
        "name": {"cn": _text(name.get("cn")), "en": english_name},
        "dept": _text(detail.get("dept")),
        "credit": _number(detail.get("credit")),
        "hour": _number(detail.get("hour")),
        "sem": _text(detail.get("sem")),
        "grading": _text(detail.get("grading")),
        "examType": _text(detail.get("examType")),
        "discipline": _text(detail.get("discipline")),
        "lang": _text(detail.get("lang")),
        "prerequisite": _text(detail.get("preq", detail.get("prerequisite"))),
        "legacyTextbook": _text(detail.get("textbook", detail.get("legacyTextbook"))),
        "textbooks": textbooks,
        "materials": materials,
        "referenceBooks": _text(detail.get("ref", detail.get("referenceBooks"))),
        "description": {
            "cn": _text(description.get("cn")),
            "en": _text(description.get("en")),
        },
        "syllabus": "" if syllabus is None else syllabus,
    }


def _normalize_lesson(lesson: dict, detail: dict | None) -> dict:
    code = _text(lesson.get("code"))
    course = lesson.get("course")
    department = lesson.get("openDepartment")
    teachers = lesson.get("teacherAssignmentList") or []
    classes = lesson.get("adminClasses") or []
    raw_schedule = _text(lesson.get("dateTimePlaceText"))
    return {
        "id": code,
        "courseName": _localized(course),
        "department": {
            "code": _text(department.get("code")) if isinstance(department, dict) else "",
            "name": _localized(department),
        },
        "teacher": ",".join(filter(None, (_localized(teacher) for teacher in teachers))),
        "credits": _number(lesson.get("credits")),
        "hours": _integer(lesson.get("period")),
        "level": _localized(lesson.get("education")),
        "sectionType": _localized(lesson.get("classType")),
        "category": _localized(lesson.get("courseClassify")),
        "courseType": _localized(lesson.get("courseType")),
        "language": _localized(lesson.get("teachLang")),
        "examType": _localized(lesson.get("examMode")),
        "grading": _text((detail or {}).get("grading")),
        "undergradShared": _boolean(lesson.get("graduateAndPostgraduat")),
        "enrolled": _integer(lesson.get("stdCount")),
        "capacity": _integer(lesson.get("limitCount")),
        "classes": list(filter(None, (_localized(admin_class) for admin_class in classes))),
        "rawSchedule": raw_schedule,
        "schedule": _schedule_slots(raw_schedule),
    }


def _generated_at(semester: dict) -> str:
    supplied = semester.get("generatedAt")
    if supplied is not None:
        return _text(supplied)
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_semester_catalog(
    semester: dict,
    lessons: list[dict],
    details_by_code: dict[str, dict],
    calendar_overrides: dict[str, dict],
) -> dict:
    """Return schemaVersion=1 catalog sorted by classroom code."""

    key = semester_key(semester["nameZh"])
    courses = sorted(
        (
            _normalize_lesson(lesson, details_by_code.get(_text(lesson.get("code"))))
            for lesson in lessons
        ),
        key=lambda course: course["id"],
    )
    details = {
        code: _normalize_detail(code, details_by_code[code])
        for code in sorted(details_by_code)
    }
    return {
        "schemaVersion": 1,
        "generatedAt": _generated_at(semester),
        "source": {"url": SOURCE_URL, "semesterId": semester["id"]},
        "semester": {
            "key": key,
            "name": semester["nameZh"],
            "startDate": semester["start"],
            "endDate": semester["end"],
            "calendar": build_term_calendar(semester, key, calendar_overrides.get(key)),
        },
        "courses": courses,
        "detailsBySection": details,
    }


def validate_semester_catalog(catalog: dict) -> None:
    """Raise ValueError on duplicate course ids, missing/extra details, or grading mismatch."""

    course_ids = [course.get("id") for course in catalog.get("courses", [])]
    duplicate_ids = sorted(code for code, count in Counter(course_ids).items() if count > 1)
    if duplicate_ids:
        raise ValueError(f"duplicate course ids: {', '.join(duplicate_ids)}")

    details = catalog.get("detailsBySection", {})
    expected_ids = set(course_ids)
    detail_ids = set(details)
    missing_ids = sorted(expected_ids - detail_ids)
    if missing_ids:
        raise ValueError(f"missing details: {', '.join(missing_ids)}")
    extra_ids = sorted(detail_ids - expected_ids)
    if extra_ids:
        raise ValueError(f"extra details: {', '.join(extra_ids)}")

    grading_mismatches = [
        code
        for code, course in zip(course_ids, catalog.get("courses", []), strict=True)
        if _text(course.get("grading")) != _text(details[code].get("grading"))
    ]
    if grading_mismatches:
        raise ValueError(f"grading mismatch: {', '.join(grading_mismatches)}")
