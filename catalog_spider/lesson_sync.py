"""Authenticated, resumable lesson synchronization helpers."""

from __future__ import annotations

from contextlib import contextmanager
import json
from pathlib import Path
import re
import time
from typing import Callable

from .lesson_transform import (
    build_semester_catalog,
    semester_key,
    validate_semester_catalog,
)
from .paths import PUBLIC_SEMESTERS_DIR, RAW_LESSONS_DIR
from .semester_calendar import CALENDAR_OVERRIDES


BASE_URL = "https://catalog.ustc.edu.cn"
DETAIL_BATCH_SIZE = 50
_TERM_ORDER = {"fall": 3, "summer": 2, "spring": 1}
_DETAIL_RETRY_DELAYS = (1, 2, 4)
_AUTH_TIMEOUT_SECONDS = 10 * 60
_AUTH_POLL_SECONDS = 2
_SEMESTER_KEY_PATTERN = re.compile(r"^[0-9]{4}-(?:fall|summer|spring)$")


class SyncError(RuntimeError):
    """Raised when authentication, transport, or response validation fails."""

    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


@contextmanager
def authenticated_request_context(
    profile_dir: Path,
    *,
    playwright_factory=None,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
):
    """Yield ``BrowserContext.request``, which shares the authenticated cookies."""

    if playwright_factory is None:
        from playwright.sync_api import sync_playwright

        playwright_factory = sync_playwright

    profile_dir.mkdir(parents=True, exist_ok=True)
    with playwright_factory() as playwright:
        try:
            context = playwright.chromium.launch_persistent_context(
                str(profile_dir),
                channel="msedge",
                headless=False,
            )
        except Exception:
            print("未找到可用的 Microsoft Edge，正在打开可见 Chromium 浏览器。")
            context = playwright.chromium.launch_persistent_context(
                str(profile_dir),
                headless=False,
            )

        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(BASE_URL + "/query/lesson")
            print("请在浏览器中完成登录；脚本将等待认证状态。")
            deadline = monotonic() + _AUTH_TIMEOUT_SECONDS
            while True:
                try:
                    response = context.request.get(
                        BASE_URL + "/api/teach/semester/list",
                        timeout=30_000,
                    )
                    print(f"登录状态: {response.status}")
                    if response.ok:
                        break
                except Exception:
                    print("登录状态: 网络暂不可用，继续等待")
                if monotonic() >= deadline:
                    raise SyncError("authentication timed out after 600 seconds")
                sleep(_AUTH_POLL_SECONDS)
            yield context.request
        finally:
            context.close()


def api_get(request, path: str) -> object:
    """Issue one authenticated GET without exposing session state."""

    response = request.get(BASE_URL + path, timeout=30_000)
    if not response.ok:
        raise SyncError(
            f"GET {path} returned {response.status}",
            status=response.status,
        )
    return response.json()


def api_post_json(request, path: str, payload: dict) -> object:
    """Issue one authenticated JSON POST without exposing session state."""

    response = request.post(BASE_URL + path, data=payload, timeout=30_000)
    if not response.ok:
        raise SyncError(
            f"POST {path} returned {response.status}",
            status=response.status,
        )
    return response.json()


def batch_codes(
    codes: list[str],
    size: int = DETAIL_BATCH_SIZE,
) -> list[list[str]]:
    """Split lesson codes into stable request batches."""

    return [codes[index : index + size] for index in range(0, len(codes), size)]


def missing_codes(
    codes: list[str],
    details_by_code: dict[str, dict],
) -> list[str]:
    """Return codes that are not present in the resumable checkpoint."""

    return [code for code in codes if code not in details_by_code]


def merge_detail_batch(
    details_by_code: dict[str, dict],
    detail_batch: list[dict],
    *,
    expected_codes: list[str] | None = None,
) -> dict[str, dict]:
    """Validate and merge one complete API detail response without mutation."""

    batch_codes_found: list[str] = []
    for detail in detail_batch:
        if not isinstance(detail, dict) or not isinstance(detail.get("code"), str):
            raise SyncError("detail record missing code")
        batch_codes_found.append(detail["code"])

    duplicates = sorted(
        code
        for code in set(batch_codes_found)
        if batch_codes_found.count(code) > 1
    )
    if duplicates:
        raise SyncError(f"duplicate detail codes: {', '.join(duplicates)}")

    if expected_codes is not None:
        expected = set(expected_codes)
        found = set(batch_codes_found)
        unexpected = sorted(found - expected)
        if unexpected:
            raise SyncError(f"unexpected detail codes: {', '.join(unexpected)}")
        absent = sorted(expected - found)
        if absent:
            raise SyncError(f"missing detail codes: {', '.join(absent)}")

    merged = dict(details_by_code)
    merged.update(zip(batch_codes_found, detail_batch, strict=True))
    return merged


def write_json_atomic(path: Path, payload: object) -> None:
    """Write UTF-8 JSON through a sibling temporary file and atomically replace."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _read_json(path: Path, *, default: object) -> object:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _snapshot_files(root: Path) -> dict[Path, bytes]:
    if not root.exists():
        return {}
    return {
        path.relative_to(root): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def _write_bytes_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".rollback.tmp")
    temporary.write_bytes(payload)
    temporary.replace(path)


def _restore_file_snapshot(root: Path, snapshot: dict[Path, bytes]) -> None:
    failures: list[OSError] = []
    current_files = (
        [path for path in root.rglob("*") if path.is_file()]
        if root.exists()
        else []
    )
    for path in current_files:
        if path.relative_to(root) not in snapshot:
            try:
                path.unlink()
            except OSError as error:
                failures.append(error)
    for relative_path, payload in snapshot.items():
        try:
            _write_bytes_atomic(root / relative_path, payload)
        except OSError as error:
            failures.append(error)
    if failures:
        raise SyncError(
            f"failed to restore {len(failures)} public file(s) after publication error"
        ) from failures[0]


def _publish_json_transaction(root: Path, outputs: dict[Path, object]) -> None:
    snapshot = _snapshot_files(root)
    try:
        for path, payload in outputs.items():
            write_json_atomic(path, payload)
    except BaseException as publication_error:
        try:
            _restore_file_snapshot(root, snapshot)
        except SyncError as rollback_error:
            raise rollback_error from publication_error
        raise


def _detail_batch_with_retry(
    request,
    codes: list[str],
    semester_id: object,
    *,
    sleep: Callable[[float], None],
) -> object:
    payload = {"codes": codes, "semester": semester_id}
    for attempt in range(len(_DETAIL_RETRY_DELAYS) + 1):
        try:
            return api_post_json(request, "/api/teach/lesson/infos", payload)
        except SyncError as error:
            retryable = error.status == 429 or (
                error.status is not None and 500 <= error.status < 600
            )
            if not retryable or attempt == len(_DETAIL_RETRY_DELAYS):
                raise
            sleep(_DETAIL_RETRY_DELAYS[attempt])
    raise AssertionError("unreachable")


def _validated_semester_list(payload: object) -> list[dict]:
    if not isinstance(payload, list) or not all(
        isinstance(semester, dict) for semester in payload
    ):
        raise SyncError("semester list response must be an array of objects")
    return payload


def _validated_lessons(payload: object) -> tuple[list[dict], list[str]]:
    if not isinstance(payload, list) or not all(
        isinstance(lesson, dict) for lesson in payload
    ):
        raise SyncError("lesson list response must be an array of objects")

    codes: list[str] = []
    for lesson in payload:
        code = lesson.get("code")
        if not isinstance(code, str) or not code:
            raise SyncError("lesson record missing code")
        codes.append(code)
    duplicates = sorted(code for code in set(codes) if codes.count(code) > 1)
    if duplicates:
        raise SyncError(f"duplicate lesson codes: {', '.join(duplicates)}")
    return payload, codes


def _validated_checkpoint(payload: object) -> dict[str, dict]:
    if not isinstance(payload, dict):
        raise SyncError("details checkpoint must be an object")
    for code, detail in payload.items():
        if (
            not isinstance(code, str)
            or not isinstance(detail, dict)
            or detail.get("code") != code
        ):
            raise SyncError("details checkpoint contains an invalid record")
    return payload


def sync_requested_semesters(
    request,
    semester_names: list[str],
    *,
    activate: str | None = None,
    raw_lessons_dir: Path = RAW_LESSONS_DIR,
    public_semesters_dir: Path = PUBLIC_SEMESTERS_DIR,
    calendar_overrides: dict[str, dict] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> list[dict]:
    """Synchronize requested labels through an injected authenticated request context."""

    if activate is not None and activate not in semester_names:
        raise SyncError("--activate must exactly match one requested semester label")

    available = _validated_semester_list(
        api_get(request, "/api/teach/semester/list")
    )
    by_name = {
        semester.get("nameZh"): semester
        for semester in available
        if isinstance(semester.get("nameZh"), str)
    }
    catalogs: list[dict] = []
    overrides = CALENDAR_OVERRIDES if calendar_overrides is None else calendar_overrides

    for name in dict.fromkeys(semester_names):
        semester = by_name.get(name)
        if semester is None:
            raise SyncError(f"semester not found: {name}")
        for field in ("id", "nameZh", "start", "end"):
            if field not in semester:
                raise SyncError(f"semester record missing {field}: {name}")

        key = semester_key(name)
        raw_dir = raw_lessons_dir / key
        lesson_payload = api_get(
            request,
            f"/api/teach/lesson/list-for-teach/{semester['id']}",
        )
        lessons, codes = _validated_lessons(lesson_payload)
        write_json_atomic(raw_dir / "semester.json", semester)
        write_json_atomic(raw_dir / "lessons.json", lessons)

        checkpoint_path = raw_dir / "details.json"
        checkpoint_details = _validated_checkpoint(
            _read_json(checkpoint_path, default={})
        )
        details = {
            code: checkpoint_details[code]
            for code in codes
            if code in checkpoint_details
        }
        if details != checkpoint_details or not checkpoint_path.exists():
            write_json_atomic(checkpoint_path, details)

        for code_batch in batch_codes(missing_codes(codes, details)):
            detail_payload = _detail_batch_with_retry(
                request,
                code_batch,
                semester["id"],
                sleep=sleep,
            )
            if not isinstance(detail_payload, list):
                raise SyncError("detail response must be an array")
            details = merge_detail_batch(
                details,
                detail_payload,
                expected_codes=code_batch,
            )
            write_json_atomic(checkpoint_path, details)

        expected_codes = set(codes)
        detail_codes = set(details)
        absent = sorted(expected_codes - detail_codes)
        if absent:
            raise SyncError(f"missing details: {', '.join(absent)}")
        unexpected = sorted(detail_codes - expected_codes)
        if unexpected:
            raise SyncError(f"extra details: {', '.join(unexpected)}")

        catalog = build_semester_catalog(
            semester,
            lessons,
            details,
            overrides,
        )
        validate_semester_catalog(catalog)

        catalogs.append(catalog)

    if not catalogs:
        return catalogs

    manifest_path = public_semesters_dir / "index.json"
    current_manifest = _read_json(manifest_path, default=None)
    if current_manifest is not None and not isinstance(current_manifest, dict):
        raise SyncError("semester manifest must be an object")

    manifest = current_manifest
    outputs: dict[Path, object] = {}
    for catalog in catalogs:
        key = catalog["semester"]["key"]
        name = catalog["semester"]["name"]
        manifest = build_manifest(
            manifest,
            key,
            name,
            activate=activate == name,
        )
        outputs[public_semesters_dir / key / "courses.json"] = catalog
    outputs[manifest_path] = manifest
    _publish_json_transaction(public_semesters_dir, outputs)

    return catalogs


def build_requested_semesters(
    semester_keys: list[str],
    *,
    activate: str | None = None,
    raw_lessons_dir: Path = RAW_LESSONS_DIR,
    public_semesters_dir: Path = PUBLIC_SEMESTERS_DIR,
    calendar_overrides: dict[str, dict] | None = None,
) -> list[dict]:
    """Build and publish semester catalogs exclusively from saved raw JSON."""

    unique_keys = list(dict.fromkeys(semester_keys))
    if activate is not None and activate not in unique_keys:
        raise SyncError("--activate must exactly match one requested semester key")
    for key in unique_keys:
        if not _SEMESTER_KEY_PATTERN.fullmatch(key):
            raise SyncError(f"invalid semester key: {key}")

    overrides = CALENDAR_OVERRIDES if calendar_overrides is None else calendar_overrides
    catalogs: list[dict] = []
    for key in unique_keys:
        raw_dir = raw_lessons_dir / key
        semester_payload = _read_json(raw_dir / "semester.json", default=None)
        if not isinstance(semester_payload, dict):
            raise SyncError(f"semester raw data must be an object: {key}")
        for field in ("id", "nameZh", "start", "end"):
            if field not in semester_payload:
                raise SyncError(f"semester raw data missing {field}: {key}")
        raw_key = semester_key(semester_payload["nameZh"])
        if raw_key != key:
            raise SyncError(
                f"requested key {key} does not match raw semester {raw_key}"
            )

        lessons, codes = _validated_lessons(
            _read_json(raw_dir / "lessons.json", default=None)
        )
        details = _validated_checkpoint(
            _read_json(raw_dir / "details.json", default=None)
        )
        expected_codes = set(codes)
        detail_codes = set(details)
        absent = sorted(expected_codes - detail_codes)
        if absent:
            raise SyncError(f"missing details: {', '.join(absent)}")
        unexpected = sorted(detail_codes - expected_codes)
        if unexpected:
            raise SyncError(f"extra details: {', '.join(unexpected)}")

        catalog = build_semester_catalog(
            semester_payload,
            lessons,
            details,
            overrides,
        )
        validate_semester_catalog(catalog)
        catalogs.append(catalog)

    if not catalogs:
        return catalogs

    manifest_path = public_semesters_dir / "index.json"
    current_manifest = _read_json(manifest_path, default=None)
    if current_manifest is not None and not isinstance(current_manifest, dict):
        raise SyncError("semester manifest must be an object")

    manifest = current_manifest
    outputs: dict[Path, object] = {}
    for catalog in catalogs:
        key = catalog["semester"]["key"]
        manifest = build_manifest(
            manifest,
            key,
            catalog["semester"]["name"],
            activate=activate == key,
        )
        outputs[public_semesters_dir / key / "courses.json"] = catalog
    outputs[manifest_path] = manifest
    _publish_json_transaction(public_semesters_dir, outputs)
    return catalogs


def catalog_statistics(catalog: dict) -> dict:
    """Summarize the completeness fields printed by ``validate-lessons``."""

    courses = catalog.get("courses", [])
    details = catalog.get("detailsBySection", {})
    grading_values = [
        course.get("grading").strip()
        for course in courses
        if isinstance(course.get("grading"), str) and course.get("grading").strip()
    ]
    detail_values = list(details.values())
    return {
        "semesterKey": catalog.get("semester", {}).get("key", ""),
        "courseCount": len(courses),
        "rawScheduleNonEmptyCount": sum(
            1
            for course in courses
            if isinstance(course.get("rawSchedule"), str)
            and course["rawSchedule"].strip()
        ),
        "scheduledCourseCount": sum(1 for course in courses if course.get("schedule")),
        "clockTimeCourseCount": sum(
            1
            for course in courses
            if any(
                isinstance(slot, dict)
                and isinstance(slot.get("startTime"), str)
                and slot["startTime"].strip()
                and isinstance(slot.get("endTime"), str)
                and slot["endTime"].strip()
                for slot in (course.get("schedule") or [])
            )
        ),
        "gradingNonEmptyCount": len(grading_values),
        "gradingLabels": sorted(set(grading_values)),
        "structuredTextbookCount": sum(
            len(detail.get("textbooks") or []) for detail in detail_values
        ),
        "structuredMaterialCount": sum(
            len(detail.get("materials") or []) for detail in detail_values
        ),
        "referenceBookNonEmptyCount": sum(
            1
            for detail in detail_values
            if isinstance(detail.get("referenceBooks"), str)
            and detail["referenceBooks"].strip()
        ),
    }


def validate_published_catalogs(
    public_semesters_dir: Path = PUBLIC_SEMESTERS_DIR,
    *,
    all_semesters: bool = False,
    semester_key_value: str | None = None,
) -> list[dict]:
    """Validate deployable catalogs selected by the manifest or an exact key."""

    if all_semesters == (semester_key_value is not None):
        raise ValueError("select exactly one of all_semesters or semester_key_value")

    if all_semesters:
        manifest = _read_json(public_semesters_dir / "index.json", default=None)
        if not isinstance(manifest, dict) or not isinstance(
            manifest.get("semesters"), list
        ):
            raise SyncError("semester manifest must contain a semesters array")
        relative_files: list[str] = []
        for entry in manifest["semesters"]:
            if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
                raise SyncError("semester manifest contains an invalid entry")
            relative_files.append(entry["file"])
    else:
        relative_files = [f"{semester_key_value}/courses.json"]

    root = public_semesters_dir.resolve()
    statistics: list[dict] = []
    for relative_file in relative_files:
        catalog_path = (public_semesters_dir / relative_file).resolve()
        if not catalog_path.is_relative_to(root):
            raise SyncError(f"catalog file escapes semester directory: {relative_file}")
        catalog = _read_json(catalog_path, default=None)
        if not isinstance(catalog, dict):
            raise SyncError(f"catalog must be an object: {relative_file}")
        validate_semester_catalog(catalog)
        statistics.append(catalog_statistics(catalog))
    return statistics


def _manifest_sort_key(entry: dict) -> tuple[int, int]:
    year_text, term = entry["key"].split("-", maxsplit=1)
    return (-int(year_text), -_TERM_ORDER[term])


def build_manifest(
    current: dict | None,
    key: str,
    name: str,
    *,
    activate: bool,
) -> dict:
    """Return a manifest containing an updated semester entry."""

    current = current or {}
    entries = {
        entry["key"]: dict(entry)
        for entry in current.get("semesters", [])
    }
    entries[key] = {"key": key, "name": name, "file": f"{key}/courses.json"}
    default_semester = key if activate else current.get("defaultSemester", key)
    return {
        "schemaVersion": 1,
        "defaultSemester": default_semester,
        "semesters": sorted(entries.values(), key=_manifest_sort_key),
    }
