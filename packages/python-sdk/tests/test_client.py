"""Unit tests for the Python SDK. Run: python -m unittest discover -s tests (from packages/python-sdk)."""

from __future__ import annotations

import json
import os
import sys
import unittest
from unittest import mock

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from apexmonitor_sdk import ApexApiError, ApexClient, ApexNetworkError  # noqa: E402


def response(status: int = 200, body=None, headers: dict | None = None) -> requests.Response:
    r = requests.Response()
    r.status_code = status
    r._content = b"" if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
    r.headers.update(headers or {})
    return r


class ClientTestCase(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch("apexmonitor_sdk.client.requests.request")
        self.request = patcher.start()
        self.addCleanup(patcher.stop)
        sleeper = mock.patch("apexmonitor_sdk.client.time.sleep")
        self.sleep = sleeper.start()
        self.addCleanup(sleeper.stop)

    def last_call(self):
        return self.request.call_args.kwargs


class TransportTests(ClientTestCase):
    def test_requires_base_url_and_strips_trailing_slash(self):
        with self.assertRaises(ValueError):
            ApexClient("")
        self.request.return_value = response(200, {"data": 1})
        ApexClient("https://api.example/").request("GET", "x")
        self.assertEqual(self.last_call()["url"], "https://api.example/x")

    def test_sends_json_query_and_default_headers(self):
        self.request.return_value = response(200, {"ok": True})
        client = ApexClient("https://a", default_headers={"x-team": "t"}, timeout_s=3)
        result = client.request("POST", "/p", query={"a": 1}, body={"b": 2}, headers={"x-extra": "e"})
        call = self.last_call()
        self.assertEqual(result, {"ok": True})
        self.assertEqual(call["params"], {"a": 1})
        self.assertEqual(call["json"], {"b": 2})
        self.assertEqual(call["timeout"], 3)
        self.assertEqual(call["headers"]["content-type"], "application/json")
        self.assertEqual(call["headers"]["x-team"], "t")
        self.assertEqual(call["headers"]["x-extra"], "e")

    def test_returns_none_for_empty_success_bodies(self):
        self.request.return_value = response(204)
        self.assertIsNone(ApexClient("https://a").request("DELETE", "/x"))

    def test_auth_strategies(self):
        cases = [
            ({"type": "bearer", "token": "tok"}, {"authorization": "Bearer tok"}),
            ({"type": "apiKey", "key": "k"}, {"x-api-key": "k"}),
            ({"type": "apiKey", "key": "k", "headerName": "x-custom"}, {"x-custom": "k"}),
            ({"type": "custom", "getHeaders": lambda: {"x-sig": "s"}}, {"x-sig": "s"}),
        ]
        for auth, expected in cases:
            with self.subTest(auth=auth.get("type")):
                self.request.return_value = response(200, {})
                ApexClient("https://a", auth=auth).request("GET", "/")
                for k, v in expected.items():
                    self.assertEqual(self.last_call()["headers"][k], v)

    def test_idempotency_key_header(self):
        self.request.return_value = response(202, {})
        ApexClient("https://a").ingest({"logs": []}, idempotency_key="idem-1")
        self.assertEqual(self.last_call()["headers"]["idempotency-key"], "idem-1")

    def test_api_error_mapping_without_retry_for_4xx(self):
        self.request.return_value = response(403, {"error": "FORBIDDEN", "message": "nope", "requestId": "rid", "details": {"a": 1}})
        with self.assertRaises(ApexApiError) as ctx:
            ApexClient("https://a").me()
        err = ctx.exception
        self.assertEqual((err.status, err.code, str(err), err.request_id, err.details), (403, "FORBIDDEN", "nope", "rid", {"a": 1}))
        self.assertEqual(self.request.call_count, 1)

    def test_error_fallbacks_for_non_json_bodies(self):
        self.request.return_value = response(400, b"bad", {"x-request-id": "hdr"})
        with self.assertRaises(ApexApiError) as ctx:
            ApexClient("https://a").me()
        self.assertEqual(ctx.exception.code, "API_ERROR")
        self.assertEqual(ctx.exception.request_id, "hdr")

    def test_retries_retryable_statuses_then_succeeds(self):
        self.request.side_effect = [response(503, {}), response(429, {}), response(200, {"ok": 1})]
        self.assertEqual(ApexClient("https://a", max_retries=2).me(), {"ok": 1})
        self.assertEqual(self.request.call_count, 3)
        self.assertEqual(self.sleep.call_count, 2)

    def test_gives_up_after_max_retries(self):
        self.request.return_value = response(503, {"error": "UNAVAILABLE"})
        with self.assertRaises(ApexApiError) as ctx:
            ApexClient("https://a", max_retries=1).me()
        self.assertEqual(ctx.exception.status, 503)
        self.assertEqual(self.request.call_count, 2)

    def test_network_errors_retry_then_raise_network_error(self):
        self.request.side_effect = requests.ConnectionError("down")
        with self.assertRaises(ApexNetworkError):
            ApexClient("https://a", max_retries=2).me()
        self.assertEqual(self.request.call_count, 3)

    @unittest.expectedFailure
    def test_known_bug_ki_11_rum_key_uses_x_rum_key_header(self):
        self.request.return_value = response(202, {})
        ApexClient("https://a", auth={"type": "rumKey", "key": "rum_k"}).rum_ingest({"events": []})
        self.assertEqual(self.last_call()["headers"].get("x-rum-key"), "rum_k")

    @unittest.expectedFailure
    def test_known_bug_ki_33_idempotency_header_matches_server(self):
        self.request.return_value = response(202, {})
        ApexClient("https://a").ingest({"logs": []}, idempotency_key="idem-1")
        self.assertEqual(self.last_call()["headers"].get("x-idempotency-key"), "idem-1")


class EndpointTests(ClientTestCase):
    def test_endpoint_mapping(self):
        cases = [
            (lambda c: c.login({}), "POST", "/api/v1/auth/login"),
            (lambda c: c.refresh({}), "POST", "/api/v1/auth/refresh"),
            (lambda c: c.me(), "GET", "/api/v1/users/me"),
            (lambda c: c.list_projects(), "GET", "/api/v1/projects"),
            (lambda c: c.create_project({}), "POST", "/api/v1/projects"),
            (lambda c: c.ingest({}), "POST", "/api/v1/ingest"),
            (lambda c: c.rum_ingest({}), "POST", "/api/v1/rum"),
            (lambda c: c.metrics_overview({"projectId": "p"}), "GET", "/api/v1/metrics/overview"),
            (lambda c: c.logs(), "GET", "/api/v1/logs"),
            (lambda c: c.traces(), "GET", "/api/v1/traces"),
            (lambda c: c.trace_detail("t1"), "GET", "/api/v1/traces/t1"),
            (lambda c: c.insights(), "GET", "/api/v1/insights"),
            (lambda c: c.keys(), "GET", "/api/v1/keys"),
            (lambda c: c.create_key({}), "POST", "/api/v1/keys"),
            (lambda c: c.revoke_key(5), "DELETE", "/api/v1/keys/5"),
            (lambda c: c.checkout({}), "POST", "/api/v1/billing/checkout"),
        ]
        for invoke, method, path in cases:
            with self.subTest(path=path, method=method):
                self.request.return_value = response(200, {})
                invoke(ApexClient("https://a"))
                self.assertEqual(self.last_call()["method"], method)
                self.assertEqual(self.last_call()["url"], f"https://a{path}")

    @unittest.expectedFailure
    def test_known_bug_ki_34_revoke_key_sends_project_id(self):
        self.request.return_value = response(204)
        ApexClient("https://a").revoke_key(5)
        self.assertIn("projectId", self.last_call()["params"] or {})


if __name__ == "__main__":
    unittest.main()
