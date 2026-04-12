from __future__ import annotations


class ApexApiError(Exception):
    def __init__(self, status: int, message: str, code: str = "API_ERROR", details=None, request_id: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details
        self.request_id = request_id


class ApexNetworkError(Exception):
    pass
