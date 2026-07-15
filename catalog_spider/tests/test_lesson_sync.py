import json
from contextlib import contextmanager
from pathlib import Path
import tomllib

import pytest

from catalog_spider.paths import (
    BROWSER_PROFILE_DIR,
    DATA_ROOT,
    PUBLIC_SEMESTERS_DIR,
    RAW_DIR,
    RAW_LESSONS_DIR,
)
from catalog_spider.lesson_sync import (
    BASE_URL,
    SyncError,
    api_get,
    api_post_json,
    authenticated_request_context,
    batch_codes,
    build_requested_semesters,
    build_manifest,
    catalog_statistics,
    merge_detail_batch,
    missing_codes,
    sync_requested_semesters,
    validate_published_catalogs,
    write_json_atomic,
)


class FakeResponse:
    def __init__(self, payload, *, status=200):
        self.payload = payload
        self.status = status
        self.ok = 200 <= status < 300

    def json(self):
        return self.payload


class RecordingRequest:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return next(self.responses)

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        return next(self.responses)


class LessonRequest:
    def __init__(self, semesters, lessons, detail_responses):
        self.semesters = semesters
        self.lessons = lessons
        self.detail_responses = iter(detail_responses)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        if url.endswith("/api/teach/semester/list"):
            return FakeResponse(self.semesters)
        if "/api/teach/lesson/list-for-teach/" in url:
            return FakeResponse(self.lessons)
        raise AssertionError(f"unexpected GET {url}")

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        return next(self.detail_responses)


class FlakyLessonListRequest(LessonRequest):
    def __init__(self, semesters, lessons, detail_responses):
        super().__init__(semesters, lessons, detail_responses)
        self.lesson_list_attempts = 0

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        if url.endswith("/api/teach/semester/list"):
            return FakeResponse(self.semesters)
        if "/api/teach/lesson/list-for-teach/" in url:
            self.lesson_list_attempts += 1
            if self.lesson_list_attempts == 1:
                raise TimeoutError("simulated slow catalog transfer")
            return FakeResponse(self.lessons)
        raise AssertionError(f"unexpected GET {url}")


class FakePage:
    def __init__(self):
        self.visited = []

    def goto(self, url):
        self.visited.append(url)


class FakeBrowserContext:
    def __init__(self, request):
        self.request = request
        self.pages = [FakePage()]
        self.closed = False

    def close(self):
        self.closed = True


class FakeChromium:
    def __init__(self, context, *, fail_edge=False):
        self.context = context
        self.fail_edge = fail_edge
        self.launches = []

    def launch_persistent_context(self, user_data_dir, **kwargs):
        self.launches.append((user_data_dir, kwargs))
        if self.fail_edge and kwargs.get("channel") == "msedge":
            raise RuntimeError("edge unavailable")
        return self.context


class FakePlaywrightManager:
    def __init__(self, chromium):
        self.playwright = type("Playwright", (), {"chromium": chromium})()

    def __enter__(self):
        return self.playwright

    def __exit__(self, *_args):
        return False


@pytest.fixture
def lesson_api_fixtures():
    fixture_dir = Path(__file__).parent / "fixtures"
    lessons = json.loads(
        (fixture_dir / "lesson_list_mini.json").read_text(encoding="utf-8")
    )
    details = json.loads(
        (fixture_dir / "lesson_details_mini.json").read_text(encoding="utf-8")
    )
    semester = {
        "id": 461,
        "nameZh": "2026年秋季学期",
        "start": "2026-08-31",
        "end": "2027-01-17",
        "generatedAt": "2026-07-13T00:00:00Z",
    }
    return semester, lessons, details


def snapshot_files(root: Path) -> dict[str, bytes]:
    if not root.exists():
        return {}
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def test_batch_codes_uses_fifty_items():
    codes = [f"C{i:03}.01" for i in range(101)]
    assert [len(batch) for batch in batch_codes(codes)] == [50, 50, 1]


def test_lesson_paths_separate_private_state_from_deployable_data():
    project_root = Path(__file__).parents[2]
    assert BROWSER_PROFILE_DIR == DATA_ROOT / "browser-profile"
    assert RAW_LESSONS_DIR == RAW_DIR / "lessons"
    assert PUBLIC_SEMESTERS_DIR == project_root / "public" / "data" / "semesters"


def test_missing_codes_excludes_checkpointed_details():
    assert missing_codes(
        ["A.01", "B.01"],
        {"A.01": {"code": "A.01"}},
    ) == ["B.01"]


def test_build_manifest_replaces_entry_without_dropping_other_terms():
    current = {
        "schemaVersion": 1,
        "defaultSemester": "2026-fall",
        "semesters": [
            {
                "key": "2026-fall",
                "name": "2026年秋季学期",
                "file": "2026-fall/courses.json",
            }
        ],
    }

    result = build_manifest(
        current,
        "2026-summer",
        "2026年夏季学期",
        activate=False,
    )

    assert [entry["key"] for entry in result["semesters"]] == [
        "2026-fall",
        "2026-summer",
    ]
    assert result["defaultSemester"] == "2026-fall"


def test_merge_detail_batch_is_pure_and_indexes_complete_details():
    current = {"A.01": {"code": "A.01", "grading": "百分制"}}
    incoming = [{"code": "B.01", "grading": "五级制"}]

    result = merge_detail_batch(current, incoming, expected_codes=["B.01"])

    assert result == {
        "A.01": {"code": "A.01", "grading": "百分制"},
        "B.01": {"code": "B.01", "grading": "五级制"},
    }
    assert current == {"A.01": {"code": "A.01", "grading": "百分制"}}


@pytest.mark.parametrize(
    ("incoming", "message"),
    [
        ([{"grading": "百分制"}], "missing code"),
        ([{"code": "FOREIGN.01"}], "unexpected detail codes"),
        (
            [{"code": "B.01"}, {"code": "B.01"}],
            "duplicate detail codes",
        ),
    ],
)
def test_merge_detail_batch_rejects_invalid_or_foreign_records(incoming, message):
    with pytest.raises(SyncError, match=message):
        merge_detail_batch({}, incoming, expected_codes=["B.01"])


def test_merge_detail_batch_rejects_incomplete_response():
    with pytest.raises(SyncError, match="missing detail codes"):
        merge_detail_batch(
            {},
            [{"code": "B.01"}],
            expected_codes=["B.01", "C.01"],
        )


def test_build_manifest_sorts_newest_year_then_fall_summer_spring():
    manifest = None
    for key, name in (
        ("2026-spring", "2026年春季学期"),
        ("2027-summer", "2027年夏季学期"),
        ("2026-fall", "2026年秋季学期"),
        ("2026-summer", "2026年夏季学期"),
    ):
        manifest = build_manifest(manifest, key, name, activate=False)

    assert [entry["key"] for entry in manifest["semesters"]] == [
        "2027-summer",
        "2026-fall",
        "2026-summer",
        "2026-spring",
    ]
    assert manifest["defaultSemester"] == "2026-spring"


def test_build_manifest_only_changes_default_when_activated():
    current = {
        "schemaVersion": 1,
        "defaultSemester": "2026-fall",
        "semesters": [],
    }

    inactive = build_manifest(
        current,
        "2026-summer",
        "旧名称",
        activate=False,
    )
    active = build_manifest(
        inactive,
        "2026-summer",
        "2026年夏季学期",
        activate=True,
    )

    assert inactive["defaultSemester"] == "2026-fall"
    assert active["defaultSemester"] == "2026-summer"
    assert active["semesters"] == [
        {
            "key": "2026-summer",
            "name": "2026年夏季学期",
            "file": "2026-summer/courses.json",
        }
    ]


def test_write_json_atomic_replaces_existing_file_with_deterministic_json(tmp_path):
    target = tmp_path / "nested" / "payload.json"
    target.parent.mkdir()
    target.write_text('{"stale": true}\n', encoding="utf-8")

    write_json_atomic(target, {"名称": "课程", "items": [1, 2]})

    assert json.loads(target.read_text(encoding="utf-8")) == {
        "名称": "课程",
        "items": [1, 2],
    }
    assert target.read_text(encoding="utf-8").endswith("\n")
    assert not target.with_suffix(".json.tmp").exists()


def test_write_json_atomic_retries_transient_windows_file_lock(tmp_path, monkeypatch):
    target = tmp_path / "payload.json"
    target.write_text('{"stale": true}\n', encoding="utf-8")
    original_replace = Path.replace
    attempts = 0

    def flaky_replace(source, destination):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise PermissionError("simulated Vite watcher lock")
        return original_replace(source, destination)

    monkeypatch.setattr(Path, "replace", flaky_replace)

    write_json_atomic(target, {"fresh": True})

    assert attempts == 2
    assert json.loads(target.read_text(encoding="utf-8")) == {"fresh": True}


def test_write_json_atomic_skips_replacing_identical_content(tmp_path, monkeypatch):
    target = tmp_path / "payload.json"
    payload = {"unchanged": True}
    write_json_atomic(target, payload)

    def locked_replace(_source, _destination):
        raise PermissionError("simulated persistent Vite file lock")

    monkeypatch.setattr(Path, "replace", locked_replace)

    write_json_atomic(target, payload)

    assert json.loads(target.read_text(encoding="utf-8")) == payload
    assert not target.with_suffix(".json.tmp").exists()


def test_api_get_uses_authenticated_request_context():
    request = RecordingRequest([FakeResponse([{"id": 461}])])

    result = api_get(request, "/api/teach/semester/list")

    assert result == [{"id": 461}]
    assert request.calls == [
        (
            "GET",
            BASE_URL + "/api/teach/semester/list",
            {"timeout": 30_000},
        )
    ]


def test_api_post_json_sends_dict_as_playwright_data():
    request = RecordingRequest([FakeResponse([{"code": "A.01"}])])
    payload = {"codes": ["A.01"], "semester": 461}

    result = api_post_json(request, "/api/teach/lesson/infos", payload)

    assert result == [{"code": "A.01"}]
    assert request.calls == [
        (
            "POST",
            BASE_URL + "/api/teach/lesson/infos",
            {"data": payload, "timeout": 30_000},
        )
    ]


@pytest.mark.parametrize(("method", "status"), [("GET", 401), ("POST", 503)])
def test_api_transport_raises_status_only_error(method, status):
    request = RecordingRequest([FakeResponse({"secret": "never print"}, status=status)])

    if method == "GET":
        call = lambda: api_get(request, "/private")
    else:
        call = lambda: api_post_json(request, "/private", {"value": 1})

    with pytest.raises(SyncError, match=rf"{method} /private returned {status}") as caught:
        call()

    assert caught.value.status == status
    assert "secret" not in str(caught.value)


def test_sync_requested_semesters_publishes_complete_valid_catalog(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    request = LessonRequest([semester], lessons, [FakeResponse(details)])
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public" / "data" / "semesters"

    result = sync_requested_semesters(
        request,
        [semester["nameZh"]],
        activate=semester["nameZh"],
        raw_lessons_dir=raw_root,
        public_semesters_dir=public_root,
        calendar_overrides={},
    )

    checkpoint = raw_root / "2026-fall"
    assert json.loads((checkpoint / "semester.json").read_text(encoding="utf-8")) == semester
    assert json.loads((checkpoint / "lessons.json").read_text(encoding="utf-8")) == lessons
    assert set(
        json.loads((checkpoint / "details.json").read_text(encoding="utf-8"))
    ) == {lesson["code"] for lesson in lessons}

    catalog = json.loads(
        (public_root / "2026-fall" / "courses.json").read_text(encoding="utf-8")
    )
    manifest = json.loads((public_root / "index.json").read_text(encoding="utf-8"))
    assert [course["id"] for course in catalog["courses"]] == sorted(
        lesson["code"] for lesson in lessons
    )
    assert manifest["defaultSemester"] == "2026-fall"
    assert manifest["semesters"][0]["file"] == "2026-fall/courses.json"
    assert result == [catalog]


def test_sync_retries_slow_lesson_list_once_with_extended_timeout(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    request = FlakyLessonListRequest(
        [semester],
        lessons,
        [FakeResponse(details)],
    )
    delays = []

    sync_requested_semesters(
        request,
        [semester["nameZh"]],
        raw_lessons_dir=tmp_path / "raw",
        public_semesters_dir=tmp_path / "public",
        calendar_overrides={},
        sleep=delays.append,
    )

    lesson_list_calls = [
        call
        for call in request.calls
        if "/api/teach/lesson/list-for-teach/" in call[1]
    ]
    assert lesson_list_calls == [
        (
            "GET",
            BASE_URL + f"/api/teach/lesson/list-for-teach/{semester['id']}",
            {"timeout": 180_000},
        ),
        (
            "GET",
            BASE_URL + f"/api/teach/lesson/list-for-teach/{semester['id']}",
            {"timeout": 180_000},
        ),
    ]
    assert delays == [5]


def test_sync_resumes_by_requesting_only_details_missing_from_checkpoint(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    raw_root = tmp_path / "raw"
    checkpoint = raw_root / "2026-fall"
    checkpoint.mkdir(parents=True)
    write_json_atomic(checkpoint / "details.json", {details[0]["code"]: details[0]})
    request = LessonRequest([semester], lessons, [FakeResponse([details[1]])])

    sync_requested_semesters(
        request,
        [semester["nameZh"]],
        raw_lessons_dir=raw_root,
        public_semesters_dir=tmp_path / "public",
        calendar_overrides={},
    )

    post_calls = [call for call in request.calls if call[0] == "POST"]
    assert [call[2]["data"]["codes"] for call in post_calls] == [
        [details[1]["code"]]
    ]
    saved = json.loads((checkpoint / "details.json").read_text(encoding="utf-8"))
    assert set(saved) == {detail["code"] for detail in details}


def test_sync_prunes_stale_checkpoint_details_after_lesson_list_changes(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    raw_root = tmp_path / "raw"
    checkpoint = raw_root / "2026-fall"
    checkpoint.mkdir(parents=True)
    saved_details = {detail["code"]: detail for detail in details}
    saved_details["REMOVED.01"] = {"code": "REMOVED.01"}
    write_json_atomic(checkpoint / "details.json", saved_details)
    request = LessonRequest([semester], lessons, [])

    sync_requested_semesters(
        request,
        [semester["nameZh"]],
        raw_lessons_dir=raw_root,
        public_semesters_dir=tmp_path / "public",
        calendar_overrides={},
    )

    assert not [call for call in request.calls if call[0] == "POST"]
    normalized = json.loads(
        (checkpoint / "details.json").read_text(encoding="utf-8")
    )
    assert set(normalized) == {lesson["code"] for lesson in lessons}
    assert (tmp_path / "public" / "2026-fall" / "courses.json").exists()


def test_sync_retries_429_and_server_errors_with_one_two_four_second_delays(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    request = LessonRequest(
        [semester],
        lessons,
        [
            FakeResponse({}, status=429),
            FakeResponse({}, status=500),
            FakeResponse({}, status=503),
            FakeResponse(details),
        ],
    )
    delays = []

    sync_requested_semesters(
        request,
        [semester["nameZh"]],
        raw_lessons_dir=tmp_path / "raw",
        public_semesters_dir=tmp_path / "public",
        calendar_overrides={},
        sleep=delays.append,
    )

    assert delays == [1, 2, 4]
    assert len([call for call in request.calls if call[0] == "POST"]) == 4


def test_successful_batch_is_checkpointed_before_later_non_retryable_failure(tmp_path):
    semester = {
        "id": 461,
        "nameZh": "2026年秋季学期",
        "start": "2026-08-31",
        "end": "2027-01-17",
    }
    lessons = [{"code": f"C{i:03}.01"} for i in range(51)]
    first_details = [{"code": lesson["code"]} for lesson in lessons[:50]]
    request = LessonRequest(
        [semester],
        lessons,
        [FakeResponse(first_details), FakeResponse({}, status=400)],
    )
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public"
    old_catalog = public_root / "2026-fall" / "courses.json"
    old_manifest = public_root / "index.json"
    write_json_atomic(old_catalog, {"old": "catalog"})
    write_json_atomic(old_manifest, {"old": "manifest"})
    delays = []

    with pytest.raises(SyncError, match="returned 400"):
        sync_requested_semesters(
            request,
            [semester["nameZh"]],
            raw_lessons_dir=raw_root,
            public_semesters_dir=public_root,
            calendar_overrides={},
            sleep=delays.append,
        )

    saved_details = json.loads(
        (raw_root / "2026-fall" / "details.json").read_text(encoding="utf-8")
    )
    assert set(saved_details) == {lesson["code"] for lesson in lessons[:50]}
    assert json.loads(old_catalog.read_text(encoding="utf-8")) == {"old": "catalog"}
    assert json.loads(old_manifest.read_text(encoding="utf-8")) == {"old": "manifest"}
    assert delays == []


def test_second_semester_fetch_failure_leaves_entire_public_tree_unchanged(
    tmp_path,
    lesson_api_fixtures,
):
    fall, lessons, details = lesson_api_fixtures
    summer = {
        "id": 462,
        "nameZh": "2026年夏季学期",
        "start": "2026-06-29",
        "end": "2026-08-23",
        "generatedAt": "2026-07-13T00:00:00Z",
    }
    request = LessonRequest(
        [fall, summer],
        lessons,
        [FakeResponse(details), FakeResponse({}, status=400)],
    )
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public"
    write_json_atomic(public_root / "2026-fall" / "courses.json", {"old": "fall"})
    write_json_atomic(
        public_root / "2025-spring" / "courses.json",
        {"old": "unrelated"},
    )
    write_json_atomic(
        public_root / "index.json",
        {
            "schemaVersion": 1,
            "defaultSemester": "2025-spring",
            "semesters": [
                {
                    "key": "2025-spring",
                    "name": "2025年春季学期",
                    "file": "2025-spring/courses.json",
                }
            ],
        },
    )
    before = snapshot_files(public_root)

    with pytest.raises(SyncError, match="returned 400"):
        sync_requested_semesters(
            request,
            [fall["nameZh"], summer["nameZh"]],
            activate=fall["nameZh"],
            raw_lessons_dir=raw_root,
            public_semesters_dir=public_root,
            calendar_overrides={},
        )

    assert snapshot_files(public_root) == before
    assert (raw_root / "2026-fall" / "details.json").exists()
    assert (raw_root / "2026-summer" / "details.json").exists()


def test_manifest_write_failure_rolls_back_every_public_file_and_absence(
    tmp_path,
    monkeypatch,
    lesson_api_fixtures,
):
    import catalog_spider.lesson_sync as lesson_sync_module

    fall, lessons, details = lesson_api_fixtures
    summer = {
        "id": 462,
        "nameZh": "2026年夏季学期",
        "start": "2026-06-29",
        "end": "2026-08-23",
        "generatedAt": "2026-07-13T00:00:00Z",
    }
    request = LessonRequest(
        [fall, summer],
        lessons,
        [FakeResponse(details), FakeResponse(details)],
    )
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public"
    manifest_path = public_root / "index.json"
    write_json_atomic(public_root / "2026-fall" / "courses.json", {"old": "fall"})
    write_json_atomic(
        manifest_path,
        {
            "schemaVersion": 1,
            "defaultSemester": "2025-spring",
            "semesters": [
                {
                    "key": "2025-spring",
                    "name": "2025年春季学期",
                    "file": "2025-spring/courses.json",
                }
            ],
        },
    )
    before = snapshot_files(public_root)
    real_writer = lesson_sync_module.write_json_atomic
    failed = False

    def fail_after_replacing_manifest(path, payload):
        nonlocal failed
        real_writer(path, payload)
        if path == manifest_path and not failed:
            failed = True
            raise OSError("simulated manifest failure after replace")

    monkeypatch.setattr(
        lesson_sync_module,
        "write_json_atomic",
        fail_after_replacing_manifest,
    )

    with pytest.raises(OSError, match="simulated manifest failure"):
        sync_requested_semesters(
            request,
            [fall["nameZh"], summer["nameZh"]],
            activate=summer["nameZh"],
            raw_lessons_dir=raw_root,
            public_semesters_dir=public_root,
            calendar_overrides={},
        )

    assert failed is True
    assert snapshot_files(public_root) == before
    assert (raw_root / "2026-fall" / "details.json").exists()
    assert (raw_root / "2026-summer" / "details.json").exists()


def test_detail_schema_error_is_not_retried_or_published(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, _details = lesson_api_fixtures
    request = LessonRequest([semester], lessons, [FakeResponse([{"code": "FOREIGN.01"}])])
    public_root = tmp_path / "public"
    old_catalog = public_root / "2026-fall" / "courses.json"
    write_json_atomic(old_catalog, {"old": True})
    delays = []

    with pytest.raises(SyncError, match="unexpected detail codes"):
        sync_requested_semesters(
            request,
            [semester["nameZh"]],
            raw_lessons_dir=tmp_path / "raw",
            public_semesters_dir=public_root,
            calendar_overrides={},
            sleep=delays.append,
        )

    assert len([call for call in request.calls if call[0] == "POST"]) == 1
    assert delays == []
    assert json.loads(old_catalog.read_text(encoding="utf-8")) == {"old": True}


def test_sync_requires_exact_semester_label_without_fetching_lessons(tmp_path):
    semester = {
        "id": 461,
        "nameZh": "2026年秋季学期",
        "start": "2026-08-31",
        "end": "2027-01-17",
    }
    request = LessonRequest([semester], [], [])

    with pytest.raises(SyncError, match="semester not found"):
        sync_requested_semesters(
            request,
            [" 2026年秋季学期"],
            raw_lessons_dir=tmp_path / "raw",
            public_semesters_dir=tmp_path / "public",
            calendar_overrides={},
        )

    assert [call[1] for call in request.calls] == [
        BASE_URL + "/api/teach/semester/list"
    ]


def test_duplicate_lesson_codes_fail_before_detail_request_or_publication(tmp_path):
    semester = {
        "id": 461,
        "nameZh": "2026年秋季学期",
        "start": "2026-08-31",
        "end": "2027-01-17",
    }
    request = LessonRequest(
        [semester],
        [{"code": "A.01"}, {"code": "A.01"}],
        [],
    )

    with pytest.raises(SyncError, match="duplicate lesson codes"):
        sync_requested_semesters(
            request,
            [semester["nameZh"]],
            raw_lessons_dir=tmp_path / "raw",
            public_semesters_dir=tmp_path / "public",
            calendar_overrides={},
        )

    assert not [call for call in request.calls if call[0] == "POST"]
    assert not (tmp_path / "public" / "2026-fall" / "courses.json").exists()


def test_authenticated_context_uses_visible_edge_and_context_request(
    tmp_path,
    capsys,
):
    request = RecordingRequest(
        [
            FakeResponse({"private": "never print"}, status=401),
            FakeResponse([{"id": 461}], status=200),
        ]
    )
    context = FakeBrowserContext(request)
    chromium = FakeChromium(context)
    manager = FakePlaywrightManager(chromium)
    delays = []
    profile_dir = tmp_path / "browser-profile"

    with authenticated_request_context(
        profile_dir,
        playwright_factory=lambda: manager,
        sleep=delays.append,
        monotonic=lambda: 0,
    ) as authenticated_request:
        assert authenticated_request is context.request

    assert chromium.launches == [
        (str(profile_dir), {"channel": "msedge", "headless": False})
    ]
    assert context.pages[0].visited == [BASE_URL + "/query/lesson"]
    assert request.calls == [
        (
            "GET",
            BASE_URL + "/api/teach/semester/list",
            {"timeout": 30_000},
        ),
        (
            "GET",
            BASE_URL + "/api/teach/semester/list",
            {"timeout": 30_000},
        ),
    ]
    assert delays == [2]
    assert context.closed is True
    output = capsys.readouterr().out
    assert "请在浏览器中完成登录" in output
    assert "401" in output
    assert "200" in output
    assert "private" not in output
    assert "never print" not in output


def test_authenticated_context_falls_back_to_visible_chromium(tmp_path):
    request = RecordingRequest([FakeResponse([], status=200)])
    context = FakeBrowserContext(request)
    chromium = FakeChromium(context, fail_edge=True)
    manager = FakePlaywrightManager(chromium)

    with authenticated_request_context(
        tmp_path / "profile",
        playwright_factory=lambda: manager,
        monotonic=lambda: 0,
    ):
        pass

    assert chromium.launches == [
        (
            str(tmp_path / "profile"),
            {"channel": "msedge", "headless": False},
        ),
        (str(tmp_path / "profile"), {"headless": False}),
    ]


def test_authenticated_context_times_out_without_exposing_response_body(
    tmp_path,
    capsys,
):
    request = RecordingRequest(
        [FakeResponse({"credential": "never print"}, status=403)]
    )
    context = FakeBrowserContext(request)
    chromium = FakeChromium(context)
    manager = FakePlaywrightManager(chromium)
    clock = iter([0, 601])

    with pytest.raises(SyncError, match="authentication timed out"):
        with authenticated_request_context(
            tmp_path / "profile",
            playwright_factory=lambda: manager,
            monotonic=lambda: next(clock),
        ):
            pass

    assert context.closed is True
    output = capsys.readouterr().out
    assert "403" in output
    assert "credential" not in output
    assert "never print" not in output


def test_catalog_statistics_reports_requested_detail_coverage(
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    from catalog_spider.lesson_transform import build_semester_catalog

    catalog = build_semester_catalog(
        semester,
        lessons,
        {detail["code"]: detail for detail in details},
        {},
    )

    assert catalog_statistics(catalog) == {
        "semesterKey": "2026-fall",
        "courseCount": 2,
        "rawScheduleNonEmptyCount": 2,
        "scheduledCourseCount": 2,
        "clockTimeCourseCount": 0,
        "gradingNonEmptyCount": 1,
        "gradingLabels": ["百分制"],
        "structuredTextbookCount": 1,
        "structuredMaterialCount": 1,
        "referenceBookNonEmptyCount": 1,
    }


def test_catalog_statistics_counts_courses_with_precise_clock_times():
    catalog = {
        "semester": {"key": "2026-fall"},
        "courses": [
            {
                "rawSchedule": "5301: 1(1,2)",
                "schedule": [{"day": 1, "periods": [1, 2], "weeks": [1]}],
            },
            {
                "rawSchedule": "周一 19:00-19:30",
                "schedule": [
                    {
                        "day": 1,
                        "periods": [11],
                        "weeks": [1],
                        "startTime": "19:00",
                        "endTime": "19:30",
                    }
                ],
            },
            {"rawSchedule": "", "schedule": []},
        ],
        "detailsBySection": {},
    }

    stats = catalog_statistics(catalog)

    assert stats["rawScheduleNonEmptyCount"] == 2
    assert stats["scheduledCourseCount"] == 2
    assert stats["clockTimeCourseCount"] == 1


def _write_raw_semester(root, semester, lessons, details):
    key = "2026-fall" if "秋季" in semester["nameZh"] else "2026-summer"
    raw_dir = root / key
    write_json_atomic(raw_dir / "semester.json", semester)
    write_json_atomic(raw_dir / "lessons.json", lessons)
    write_json_atomic(
        raw_dir / "details.json",
        {detail["code"]: detail for detail in details},
    )


def test_build_requested_semesters_rebuilds_local_raw_data_in_one_publication(
    tmp_path,
    lesson_api_fixtures,
):
    fall, lessons, details = lesson_api_fixtures
    summer = {
        **fall,
        "id": 462,
        "nameZh": "2026年夏季学期",
        "start": "2026-06-29",
        "end": "2026-08-23",
    }
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public"
    _write_raw_semester(raw_root, fall, lessons, details)
    _write_raw_semester(raw_root, summer, lessons, details)
    before_raw = snapshot_files(raw_root)

    catalogs = build_requested_semesters(
        ["2026-fall", "2026-summer", "2026-fall"],
        activate="2026-summer",
        raw_lessons_dir=raw_root,
        public_semesters_dir=public_root,
        calendar_overrides={},
    )

    assert [catalog["semester"]["key"] for catalog in catalogs] == [
        "2026-fall",
        "2026-summer",
    ]
    assert snapshot_files(raw_root) == before_raw
    manifest = json.loads((public_root / "index.json").read_text(encoding="utf-8"))
    assert manifest["defaultSemester"] == "2026-summer"
    assert {entry["key"] for entry in manifest["semesters"]} == {
        "2026-fall",
        "2026-summer",
    }
    for key in ("2026-fall", "2026-summer"):
        catalog = json.loads(
            (public_root / key / "courses.json").read_text(encoding="utf-8")
        )
        assert catalog["semester"]["key"] == key


def test_build_requested_semesters_leaves_public_tree_unchanged_when_raw_is_invalid(
    tmp_path,
    lesson_api_fixtures,
):
    fall, lessons, details = lesson_api_fixtures
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public"
    _write_raw_semester(raw_root, fall, lessons, details[:-1])
    write_json_atomic(public_root / "2025-spring" / "courses.json", {"old": True})
    write_json_atomic(
        public_root / "index.json",
        {
            "schemaVersion": 1,
            "defaultSemester": "2025-spring",
            "semesters": [],
        },
    )
    before = snapshot_files(public_root)

    with pytest.raises(SyncError, match="missing details"):
        build_requested_semesters(
            ["2026-fall"],
            raw_lessons_dir=raw_root,
            public_semesters_dir=public_root,
            calendar_overrides={},
        )

    assert snapshot_files(public_root) == before


def test_build_requested_semesters_rejects_raw_directory_key_mismatch(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    wrong = {**semester, "nameZh": "2026年夏季学期"}
    raw_dir = tmp_path / "raw" / "2026-fall"
    write_json_atomic(raw_dir / "semester.json", wrong)
    write_json_atomic(raw_dir / "lessons.json", lessons)
    write_json_atomic(
        raw_dir / "details.json",
        {detail["code"]: detail for detail in details},
    )

    with pytest.raises(SyncError, match="does not match raw semester"):
        build_requested_semesters(
            ["2026-fall"],
            raw_lessons_dir=tmp_path / "raw",
            public_semesters_dir=tmp_path / "public",
            calendar_overrides={},
        )


def test_build_requested_semesters_rejects_noncanonical_key_before_reading_paths(
    tmp_path,
):
    with pytest.raises(SyncError, match="invalid semester key"):
        build_requested_semesters(
            ["../2026-fall"],
            raw_lessons_dir=tmp_path / "raw",
            public_semesters_dir=tmp_path / "public",
            calendar_overrides={},
        )


def test_validate_published_catalogs_all_uses_manifest_files(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    from catalog_spider.lesson_transform import build_semester_catalog

    catalog = build_semester_catalog(
        semester,
        lessons,
        {detail["code"]: detail for detail in details},
        {},
    )
    write_json_atomic(tmp_path / "2026-fall" / "courses.json", catalog)
    write_json_atomic(
        tmp_path / "index.json",
        {
            "schemaVersion": 1,
            "defaultSemester": "2026-fall",
            "semesters": [
                {
                    "key": "2026-fall",
                    "name": "2026年秋季学期",
                    "file": "2026-fall/courses.json",
                }
            ],
        },
    )

    stats = validate_published_catalogs(tmp_path, all_semesters=True)

    assert stats[0]["semesterKey"] == "2026-fall"
    assert stats[0]["courseCount"] == 2


def test_validate_published_catalogs_by_key_calls_catalog_validator(
    tmp_path,
    lesson_api_fixtures,
):
    semester, lessons, details = lesson_api_fixtures
    from catalog_spider.lesson_transform import build_semester_catalog

    catalog = build_semester_catalog(
        semester,
        lessons,
        {detail["code"]: detail for detail in details},
        {},
    )
    del catalog["detailsBySection"][lessons[0]["code"]]
    write_json_atomic(tmp_path / "2026-fall" / "courses.json", catalog)

    with pytest.raises(ValueError, match="missing details"):
        validate_published_catalogs(
            tmp_path,
            semester_key_value="2026-fall",
        )


def test_cli_rejects_activate_label_not_requested_before_opening_browser(
    monkeypatch,
    capsys,
):
    import catalog_spider.__main__ as cli

    def forbidden_browser(*_args, **_kwargs):
        raise AssertionError("browser must not open for invalid arguments")

    monkeypatch.setattr(cli, "authenticated_request_context", forbidden_browser, raising=False)

    with pytest.raises(SystemExit) as caught:
        cli.main(
            [
                "sync-lessons",
                "--semester",
                "2026年秋季学期",
                "--activate",
                "2026年夏季学期",
            ]
        )

    assert caught.value.code == 2
    assert "--activate must exactly match one of --semester" in capsys.readouterr().err


def test_sync_cli_injects_browser_request_and_profile_dir(monkeypatch, tmp_path):
    import catalog_spider.__main__ as cli

    authenticated_request = object()
    calls = []

    @contextmanager
    def fake_authenticated_context(profile_dir):
        calls.append(("profile", profile_dir))
        yield authenticated_request

    def fake_sync(request, names, **kwargs):
        calls.append(("sync", request, names, kwargs))
        return []

    monkeypatch.setattr(cli, "authenticated_request_context", fake_authenticated_context, raising=False)
    monkeypatch.setattr(cli, "sync_requested_semesters", fake_sync, raising=False)

    result = cli.main(
        [
            "sync-lessons",
            "--semester",
            "2026年秋季学期",
            "--semester",
            "2026年夏季学期",
            "--activate",
            "2026年秋季学期",
            "--profile-dir",
            str(tmp_path / "profile"),
        ]
    )

    assert result == 0
    assert calls == [
        ("profile", tmp_path / "profile"),
        (
            "sync",
            authenticated_request,
            ["2026年秋季学期", "2026年夏季学期"],
            {"activate": "2026年秋季学期"},
        ),
    ]


def test_validate_cli_prints_course_and_detail_statistics(
    monkeypatch,
    tmp_path,
    capsys,
    lesson_api_fixtures,
):
    import catalog_spider.__main__ as cli
    from catalog_spider.lesson_transform import build_semester_catalog

    semester, lessons, details = lesson_api_fixtures
    catalog = build_semester_catalog(
        semester,
        lessons,
        {detail["code"]: detail for detail in details},
        {},
    )
    write_json_atomic(tmp_path / "2026-fall" / "courses.json", catalog)
    monkeypatch.setattr(cli, "PUBLIC_SEMESTERS_DIR", tmp_path, raising=False)

    result = cli.main(["validate-lessons", "--semester-key", "2026-fall"])

    assert result == 0
    assert capsys.readouterr().out.strip() == (
        "semester=2026-fall courses=2 raw_schedule_non_empty=2 "
        "scheduled_courses=2 clock_time_courses=0 grading_non_empty=1 "
        "grading_labels=百分制 textbooks=1 materials=1 "
        "reference_books_non_empty=1"
    )


def test_build_lessons_cli_rebuilds_from_local_files_without_browser_or_network(
    monkeypatch,
    tmp_path,
    capsys,
    lesson_api_fixtures,
):
    import catalog_spider.__main__ as cli

    semester, lessons, details = lesson_api_fixtures
    raw_root = tmp_path / "raw"
    public_root = tmp_path / "public"
    _write_raw_semester(raw_root, semester, lessons, details)

    def forbidden(*_args, **_kwargs):
        raise AssertionError("local build must not open a browser or access the network")

    monkeypatch.setattr(cli, "RAW_LESSONS_DIR", raw_root, raising=False)
    monkeypatch.setattr(cli, "PUBLIC_SEMESTERS_DIR", public_root, raising=False)
    monkeypatch.setattr(cli, "authenticated_request_context", forbidden, raising=False)
    monkeypatch.setattr(cli, "api_get", forbidden, raising=False)
    monkeypatch.setattr(cli, "api_post_json", forbidden, raising=False)

    result = cli.main(
        [
            "build-lessons",
            "--semester-key",
            "2026-fall",
            "--activate",
            "2026-fall",
        ]
    )

    assert result == 0
    assert (public_root / "2026-fall" / "courses.json").exists()
    assert json.loads((public_root / "index.json").read_text(encoding="utf-8"))[
        "defaultSemester"
    ] == "2026-fall"
    assert capsys.readouterr().out.strip() == "built 2026-fall: courses=2"


def test_build_lessons_cli_requires_activate_to_be_requested(capsys):
    import catalog_spider.__main__ as cli

    with pytest.raises(SystemExit) as caught:
        cli.main(
            [
                "build-lessons",
                "--semester-key",
                "2026-fall",
                "--activate",
                "2026-summer",
            ]
        )

    assert caught.value.code == 2
    assert "--activate must exactly match one of --semester-key" in capsys.readouterr().err


def test_validate_cli_requires_exactly_one_target():
    import catalog_spider.__main__ as cli

    with pytest.raises(SystemExit) as missing:
        cli.main(["validate-lessons"])
    with pytest.raises(SystemExit) as conflicting:
        cli.main(
            [
                "validate-lessons",
                "--all",
                "--semester-key",
                "2026-fall",
            ]
        )

    assert missing.value.code == 2
    assert conflicting.value.code == 2


def test_spider_dependency_group_includes_playwright():
    project_root = Path(__file__).parents[2]
    pyproject = tomllib.loads(
        (project_root / "pyproject.toml").read_text(encoding="utf-8")
    )

    assert any(
        dependency.split(">=", maxsplit=1)[0] == "playwright"
        for dependency in pyproject["dependency-groups"]["spider"]
    )


def test_gitignore_excludes_browser_profile_and_lesson_checkpoints():
    project_root = Path(__file__).parents[2]
    lines = (project_root / ".gitignore").read_text(encoding="utf-8").splitlines()
    comment_index = lines.index(
        "# Catalog login profile and resumable raw lesson responses"
    )

    assert lines[comment_index : comment_index + 3] == [
        "# Catalog login profile and resumable raw lesson responses",
        "catalog_spider/data/browser-profile/",
        "catalog_spider/data/raw/lessons/",
    ]
