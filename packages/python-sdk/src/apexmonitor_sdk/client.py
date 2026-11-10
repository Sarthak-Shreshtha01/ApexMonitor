from __future__ import annotations

import random
import time
import uuid
from typing import Any

import requests

from .errors import ApexApiError, ApexNetworkError

# 409 is not retryable: a conflict (e.g. email already taken) comes back the same every time.
RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}
# The server rejected these without acting on them, so even a POST without a key can be resent.
REJECTED_UNPROCESSED_STATUS = {429, 503}
# Repeating these can't create anything twice.
IDEMPOTENT_METHODS = {"GET", "HEAD", "PUT", "DELETE", "OPTIONS"}
# Header the server reads for deduplication.
IDEMPOTENCY_HEADER = "x-idempotency-key"
DEFAULT_KEY_HEADERS = {"apiKey": "x-api-key", "rumKey": "x-rum-key"}


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
        # Re-sending a POST/PATCH that may have reached the server could create it twice,
        # unless the server can deduplicate it by idempotency key.
        safe_to_repeat = method.upper() in IDEMPOTENT_METHODS or bool(idempotency_key)

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
                retryable = response.status_code in RETRYABLE_STATUS and (
                    safe_to_repeat or response.status_code in REJECTED_UNPROCESSED_STATUS
                )
                if not retryable or attempt >= self.max_retries:
                    raise ApexApiError(response.status_code, message, code=code, details=payload.get("details"), request_id=request_id)

            except requests.RequestException as exc:
                if not safe_to_repeat or attempt >= self.max_retries:
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
        """Sends a log batch. A fresh idempotency key is used unless given, so retries are stored once."""
        return self.request("POST", "/api/v1/ingest", body=payload, idempotency_key=idempotency_key or str(uuid.uuid4()))

    def rum_ingest(self, payload: dict[str, Any], idempotency_key: str | None = None):
        return self.request("POST", "/api/v1/rum", body=payload, idempotency_key=idempotency_key or str(uuid.uuid4()))

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

    def revoke_key(self, key_id: int, project_id: str):
        """Revokes an ingest key. The server needs the key's project to check ownership."""
        return self.request("DELETE", f"/api/v1/keys/{key_id}", query={"projectId": project_id})

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
            headers[IDEMPOTENCY_HEADER] = idempotency_key

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
            header_name = self.auth.get("headerName", DEFAULT_KEY_HEADERS[auth_type])
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
