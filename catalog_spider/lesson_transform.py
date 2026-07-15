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
_CLOCK_SLOT_RE = re.compile(
    r"(\d+)\s*\((\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\)"
)
_WEEK_HEAD_RE = re.compile(r"^([0-9~,()单双]+周)")
_WEEK_SPECIFIC_ROOM_RE = re.compile(
    r"(\d+)\s*[-~]\s*(\d+)\s*周\s*在\s*([^,;]+)"
)
_MAIN_CAMPUS_CODE_RE = re.compile(r"^(?:[125]\d{3}|3[ABC]\d{3})$", re.IGNORECASE)
_HIGH_TECH_CODE_RE = re.compile(
    r"^(?:G2|G3|GH|GT|GX|TH)(?:[-_A-Z0-9]|$)",
    re.IGNORECASE,
)
_MAIN_CAMPUS_TEXT_RE = re.compile(
    r"第[一二五]教学楼|[一二五]教|教[一二五]楼|3[ABC]教学楼|"
    r"5教|东区|西区|中区|地空楼|管理科研楼|管科楼|力.楼|电.楼|"
    r"生物楼|附楼|中体|^ARTS",
    re.IGNORECASE,
)
_HIGH_TECH_TEXT_RE = re.compile(r"高新区|信智(?:大)?楼")
_PERIOD_CLOCKS = (
    (1, "07:50", "08:35"),
    (2, "08:40", "09:25"),
    (3, "09:45", "10:30"),
    (4, "10:35", "11:20"),
    (5, "11:25", "12:10"),
    (6, "14:00", "14:45"),
    (7, "14:50", "15:35"),
    (8, "15:55", "16:40"),
    (9, "16:45", "17:30"),
    (10, "17:35", "18:20"),
    (11, "19:30", "20:15"),
    (12, "20:20", "21:05"),
    (13, "21:10", "21:55"),
)
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


def _campus_for_room(room: str) -> str:
    """Classify one normalized room label into the published campus vocabulary."""

    room = room.strip()
    if "附一院" in room:
        return "其他"

    high_tech = bool(
        _HIGH_TECH_CODE_RE.search(room)
        or _HIGH_TECH_TEXT_RE.search(room)
    )
    main = bool(
        _MAIN_CAMPUS_CODE_RE.fullmatch(room)
        or _MAIN_CAMPUS_TEXT_RE.search(room)
    )
    if high_tech and main:
        return "其他"
    if high_tech:
        return "高新区"
    if main:
        return "本部"
    return "其他"


def _expanded_week_set(weeks: list[int]) -> set[int]:
    if len(weeks) == 2:
        return set(range(weeks[0], weeks[1] + 1))
    return set(weeks)


def _split_week_specific_rooms(slot: dict) -> list[dict]:
    """Split the one known room label that changes campus by teaching week."""

    matches = list(_WEEK_SPECIFIC_ROOM_RE.finditer(slot["room"]))
    if len(matches) < 2:
        return [slot]

    split_slots: list[dict] = []
    covered_weeks: set[int] = set()
    for match in matches:
        start, end = int(match.group(1)), int(match.group(2))
        if start > end:
            return [slot]
        covered_weeks.update(range(start, end + 1))
        split_slots.append(
            {
                **slot,
                "weeks": [start, end],
                "room": match.group(3).strip(),
            }
        )

    if covered_weeks != _expanded_week_set(slot["weeks"]):
        return [slot]
    return split_slots


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


def _clock_minutes(value: str) -> int:
    hour, minute = value.split(":", maxsplit=1)
    return int(hour) * 60 + int(minute)


def _clock_periods(start_time: str, end_time: str) -> list[int]:
    start = _clock_minutes(start_time)
    end = _clock_minutes(end_time)
    if end <= start:
        return []

    period_ranges = [
        (period, _clock_minutes(period_start), _clock_minutes(period_end))
        for period, period_start, period_end in _PERIOD_CLOCKS
    ]
    overlapping = [
        period
        for period, period_start, period_end in period_ranges
        if max(start, period_start) < min(end, period_end)
    ]
    if overlapping:
        return overlapping

    distances = []
    for period, period_start, period_end in period_ranges:
        if end <= period_start:
            distance = period_start - end
        elif period_end <= start:
            distance = start - period_end
        else:
            distance = 0
        distances.append((distance, period))
    closest = min(distance for distance, _period in distances)
    return [period for distance, period in distances if distance == closest]


def _normalized_weeks(week_range: list[int]) -> list[int]:
    return (
        week_range
        if len(week_range) > 2
        else [min(week_range), max(week_range)]
    )


def _logical_person_lines(text: str) -> list[str]:
    lines: list[str] = []
    current = ""
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if _WEEK_HEAD_RE.match(line):
            if current:
                lines.append(current)
            current = line
        elif current:
            current = f"{current} {line}"
        else:
            current = line
    if current:
        lines.append(current)
    return lines


def _person_schedule_slots(text: str) -> list[dict]:
    slots: list[dict] = []
    for line in _logical_person_lines(text):
        week_match = _WEEK_HEAD_RE.match(line)
        if not week_match:
            raise ValueError(f"schedule record missing week range: {line}")
        week_ranges = _parse_week_ranges(week_match.group(1)[:-1])
        if not week_ranges:
            raise ValueError(f"schedule record has invalid week range: {line}")

        rest = line[week_match.end() :].strip()
        numeric_matches = [(match.start(), "periods", match) for match in _SLOT_RE.finditer(rest)]
        clock_matches = [(match.start(), "clock", match) for match in _CLOCK_SLOT_RE.finditer(rest)]
        matches = numeric_matches + clock_matches
        if not matches:
            raise ValueError(f"schedule record has no supported time: {line}")

        _offset, kind, match = max(matches, key=lambda item: item[0])
        room = rest[: match.start()].rstrip()
        if room.endswith(":"):
            room = room[:-1].rstrip()
        day = int(match.group(1))

        if kind == "clock":
            start_time, end_time = match.group(2), match.group(3)
            periods = _clock_periods(start_time, end_time)
            if not periods:
                raise ValueError(f"schedule record has invalid clock time: {line}")
        else:
            start_time = end_time = ""
            periods = [int(period) for period in match.group(2).split(",")]

        for week_range in week_ranges:
            slot = {
                "weeks": _normalized_weeks(week_range),
                "room": room,
                "day": day,
                "periods": periods,
            }
            if start_time:
                slot["startTime"] = start_time
                slot["endTime"] = end_time
            slots.append(slot)
    return slots


def _schedule_slots(raw: Any, *, person_text: bool = False) -> list[dict]:
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
    if person_text:
        slots = _person_schedule_slots(text)
    else:
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
                        slots.append(
                            {
                                "weeks": _normalized_weeks(week_range),
                                "room": room,
                                "day": day,
                                "periods": periods,
                            }
                        )
    classified_slots: list[dict] = []
    for slot in slots:
        for classified in _split_week_specific_rooms(slot):
            classified["campus"] = _campus_for_room(classified["room"])
            classified_slots.append(classified)

    unique_slots: list[dict] = []
    seen: set[tuple] = set()
    for slot in classified_slots:
        key = (
            tuple(slot["weeks"]),
            slot["room"],
            slot["campus"],
            slot["day"],
            tuple(slot["periods"]),
            slot.get("startTime", ""),
            slot.get("endTime", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        unique_slots.append(slot)
    return unique_slots


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
    person_schedule = _localized(lesson.get("dateTimePlacePersonText"))
    schedule_source = person_schedule or raw_schedule
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
        "schedule": _schedule_slots(schedule_source, person_text=bool(person_schedule)),
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

    unparsed_schedules = [
        course["id"]
        for course in catalog.get("courses", [])
        if _text(course.get("rawSchedule")) and not course.get("schedule")
    ]
    if unparsed_schedules:
        raise ValueError(f"unparsed schedules: {', '.join(unparsed_schedules)}")
