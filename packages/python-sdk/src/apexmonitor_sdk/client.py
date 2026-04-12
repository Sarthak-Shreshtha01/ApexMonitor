from __future__ import annotations

import random
import time
from typing import Any

import requests

from .errors import ApexApiError, ApexNetworkError

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class ApexClient:
    def __init__(
        self,
        base_url: str,
        auth: dict[str, Any] | None = None,
        timeout_s: float = 15.0,
        max_retries: int = 2,
        base_delay_s: float = 0.3,
        default_headers: dict[str, str] | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.auth = auth
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self.base_delay_s = base_delay_s
        self.default_headers = default_headers or {}

        if not self.base_url:
            raise ValueError("Apex SDK requires a non-empty base_url")

    def request(self, method: str, path: str, query: dict[str, Any] | None = None, body: Any = None, headers: dict[str, str] | None = None, idempotency_key: str | None = None):
        url = f"{self.base_url}{path if path.startswith('/') else '/' + path}"
        attempt = 0

        while True:
            try:
                request_headers = self._build_headers(headers or {}, idempotency_key)
                response = requests.request(
                    method=method,
                    url=url,
                    params=query,
                    json=body,
                    headers=request_headers,
                    timeout=self.timeout_s,
                )

                if response.ok:
                    if response.text:
                        return response.json()
                    return None

                payload = self._safe_json(response)
                code = payload.get("code") or payload.get("error") or "API_ERROR"
                message = payload.get("message") or f"Request failed with status {response.status_code}"
                request_id = payload.get("requestId") or response.headers.get("x-request-id")
                if response.status_code not in RETRYABLE_STATUS or attempt >= self.max_retries:
                    raise ApexApiError(response.status_code, message, code=code, details=payload.get("details"), request_id=request_id)

            except requests.RequestException as exc:
                if attempt >= self.max_retries:
                    raise ApexNetworkError(str(exc)) from exc

            attempt += 1
            delay = self.base_delay_s * (2 ** (attempt - 1)) + random.random() / 10
            time.sleep(delay)

    def login(self, payload: dict[str, Any]):
        return self.request("POST", "/api/v1/auth/login", body=payload)

    def refresh(self, payload: dict[str, Any]):
        return self.request("POST", "/api/v1/auth/refresh", body=payload)

    def me(self):
        return self.request("GET", "/api/v1/users/me")

    def list_projects(self):
        return self.request("GET", "/api/v1/projects")

    def create_project(self, payload: dict[str, Any]):
        return self.request("POST", "/api/v1/projects", body=payload)

    def ingest(self, payload: dict[str, Any], idempotency_key: str | None = None):
        return self.request("POST", "/api/v1/ingest", body=payload, idempotency_key=idempotency_key)

    def rum_ingest(self, payload: dict[str, Any], idempotency_key: str | None = None):
        return self.request("POST", "/api/v1/rum", body=payload, idempotency_key=idempotency_key)

    def metrics_overview(self, query: dict[str, Any] | None = None):
        return self.request("GET", "/api/v1/metrics/overview", query=query)

    def logs(self, query: dict[str, Any] | None = None):
        return self.request("GET", "/api/v1/logs", query=query)

    def traces(self, query: dict[str, Any] | None = None):
        return self.request("GET", "/api/v1/traces", query=query)

    def trace_detail(self, trace_id: str):
        return self.request("GET", f"/api/v1/traces/{trace_id}")

    def insights(self, query: dict[str, Any] | None = None):
        return self.request("GET", "/api/v1/insights", query=query)

    def keys(self):
        return self.request("GET", "/api/v1/keys")

    def create_key(self, payload: dict[str, Any]):
        return self.request("POST", "/api/v1/keys", body=payload)

    def revoke_key(self, key_id: int):
        return self.request("DELETE", f"/api/v1/keys/{key_id}")

    def checkout(self, payload: dict[str, Any], idempotency_key: str | None = None):
        return self.request("POST", "/api/v1/billing/checkout", body=payload, idempotency_key=idempotency_key)

    def _build_headers(self, extra_headers: dict[str, str], idempotency_key: str | None):
        headers = {
            "content-type": "application/json",
            **self.default_headers,
            **extra_headers,
        }

        auth_headers = self._auth_headers()
        headers.update(auth_headers)

        if idempotency_key:
            headers["idempotency-key"] = idempotency_key

        return headers

    def _auth_headers(self):
        if not self.auth:
            return {}

        auth_type = self.auth.get("type")
        if auth_type == "bearer":
            token = self.auth.get("token")
            return {"authorization": f"Bearer {token}"}

        if auth_type in ("apiKey", "rumKey"):
            key = self.auth.get("key")
            header_name = self.auth.get("headerName", "x-api-key")
            return {header_name: key}

        if auth_type == "custom":
            get_headers = self.auth.get("getHeaders")
            if callable(get_headers):
                return get_headers()

        return {}

    def _safe_json(self, response: requests.Response):
        try:
            payload = response.json()
            if isinstance(payload, dict):
                return payload
            return {"message": str(payload)}
        except ValueError:
            return {"message": response.text or "Request failed"}
