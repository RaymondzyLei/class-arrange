from catalog_spider.client import auto_retry_get, BASE_URL


def test_base_url_constant():
    assert BASE_URL == "https://catalog.ustc.edu.cn"


def test_auto_retry_get_returns_response(monkeypatch):
    """成功后直接返回 response，不重试"""
    from unittest.mock import MagicMock
    fake = MagicMock(status_code=200, json=lambda: {"ok": True})

    def fake_get(url, **kwargs):
        return fake

    monkeypatch.setattr("catalog_spider.client.requests.get", fake_get)
    resp = auto_retry_get("/api/test")
    assert resp.status_code == 200


def test_auto_retry_get_retries_then_succeeds(monkeypatch):
    """前两次抛异常，第三次成功"""
    from unittest.mock import MagicMock
    fake = MagicMock(status_code=200)
    calls = {"n": 0}

    def flaky(url, **kwargs):
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("boom")
        return fake

    monkeypatch.setattr("catalog_spider.client.requests.get", flaky)
    resp = auto_retry_get("/api/test")
    assert calls["n"] == 3
    assert resp.status_code == 200