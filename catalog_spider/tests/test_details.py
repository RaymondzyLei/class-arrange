import json
from catalog_spider.details import process_one, summarize


def test_process_one_writes_file(tmp_path, monkeypatch):
    """成功 → 写 raw/{id}.json"""
    from unittest.mock import MagicMock
    payload = {"trainType": "主修", "grade": "2026", "moduleTree": []}
    fake = MagicMock(status_code=200, content=json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def fake_get(_):
        return fake

    monkeypatch.setattr("catalog_spider.details.auto_retry_get", fake_get)
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    result = process_one(3413, raw_dir)
    assert result == ("ok", 3413)
    assert (raw_dir / "3413.json").exists()
    assert json.loads((raw_dir / "3413.json").read_text(encoding="utf-8"))["grade"] == "2026"


def test_process_one_skips_existing(tmp_path):
    """已存在 → skip（断点续爬）"""
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    (raw_dir / "3413.json").write_text("{}", encoding="utf-8")
    result = process_one(3413, raw_dir)
    assert result == ("skip", 3413)


def test_process_one_failed_status(tmp_path, monkeypatch):
    """HTTP 非 200 → failed，写 .failed.json"""
    from unittest.mock import MagicMock
    fake = MagicMock(status_code=500)

    def fake_get(_):
        return fake

    monkeypatch.setattr("catalog_spider.details.auto_retry_get", fake_get)
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    result = process_one(3413, raw_dir)
    assert result == ("failed", 3413)
    assert (raw_dir / "3413.failed.json").exists()


def test_process_one_no_response(tmp_path, monkeypatch):
    """auto_retry_get 返回 None（10 次重试都失败）→ failed"""

    def fake_get(_):
        return None

    monkeypatch.setattr("catalog_spider.details.auto_retry_get", fake_get)
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    result = process_one(3413, raw_dir)
    assert result == ("failed", 3413)
    assert (raw_dir / "3413.failed.json").exists()


def test_summarize_counts():
    s = summarize([("ok", 1), ("ok", 2), ("skip", 3), ("failed", 4), ("failed", 5)])
    assert s == {"ok": 2, "skip": 1, "failed": 2}