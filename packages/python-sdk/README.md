# apexmonitor-sdk

Official Python SDK for ApexMonitor.

## Install

```bash
pip install apexmonitor-sdk
```

## Quick Start

```python
from apexmonitor_sdk import ApexClient

client = ApexClient(
    base_url="https://api.example.com",
    auth={"type": "bearer", "token": "YOUR_TOKEN"},
)

metrics = client.metrics_overview({"projectId": "proj_123"})
print(metrics)
```
