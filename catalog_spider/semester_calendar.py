"""Build frontend term calendars from semester dates and local overrides."""

from __future__ import annotations

from datetime import date
import math


DEFAULT_SOURCE_URL = "https://catalog.ustc.edu.cn/query/lesson"


CALENDAR_OVERRIDES: dict[str, dict] = {
    "2026-fall": {
        "sourceUrl": "https://www.teach.ustc.edu.cn/calendar/20135.html",
        "holidays": {
            "2026-09-25": {"label": "休", "name": "中秋节"},
            "2026-09-26": {"label": "休", "name": "中秋假期"},
            "2026-09-27": {"label": "休", "name": "中秋假期"},
            "2026-10-01": {"label": "休", "name": "国庆节"},
            "2026-10-02": {"label": "休", "name": "国庆假期"},
            "2026-10-03": {"label": "休", "name": "国庆假期"},
            "2026-10-04": {"label": "休", "name": "国庆假期"},
            "2026-10-05": {"label": "休", "name": "国庆假期"},
            "2026-10-06": {"label": "休", "name": "国庆假期"},
            "2026-10-07": {"label": "休", "name": "国庆假期"},
            "2027-01-01": {"label": "休", "name": "元旦"},
            "2027-01-02": {"label": "休", "name": "元旦假期"},
            "2027-01-03": {"label": "休", "name": "元旦假期"},
        },
        "makeupDays": {
            "2026-09-20": {"label": "补周五课", "useWeekday": 5, "useWeek": 4},
            "2026-10-10": {"label": "补周二课", "useWeekday": 2},
        },
    },
    "2026-summer": {},
}


def build_term_calendar(semester: dict, key: str, override: dict | None) -> dict:
    """Merge semester dates with optional holiday and makeup-day metadata."""

    start = date.fromisoformat(semester["start"])
    end = date.fromisoformat(semester["end"])
    return {
        "termId": key,
        "termName": semester["nameZh"],
        "weekStartDate": start.isoformat(),
        "weekCount": math.ceil(((end - start).days + 1) / 7),
        "sourceUrl": (override or {}).get("sourceUrl", DEFAULT_SOURCE_URL),
        "holidays": (override or {}).get("holidays", {}),
        "makeupDays": (override or {}).get("makeupDays", {}),
    }
