# SDK Publishing Guide

## Packages in this repo

- npm package: `@apexmonitor/sdk` from `packages/sdk`
- npm package: `@apexmonitor/browser-sdk` from `packages/browser-sdk`
- PyPI package: `apexmonitor-sdk` from `packages/python-sdk`

## 1. Prerequisites

- npm org with publish rights.
- PyPI project and API token.
- GitHub Actions secrets configured:
  - `NPM_TOKEN`
  - `PYPI_API_TOKEN`

## 2. Version Bump

Update versions before release:

- `packages/sdk/package.json`
- `packages/browser-sdk/package.json`
- `packages/python-sdk/pyproject.toml`

If browser SDK depends on core, keep compatible version in:

- `packages/browser-sdk/package.json` dependency `@apexmonitor/sdk`

## 3. Build and Verify Locally

```bash
npm install
npm run build:sdk
npm run build:browser-sdk
```

Python package verification:

```bash
cd packages/python-sdk
python -m pip install --upgrade build twine
python -m build
python -m twine check dist/*
```

## 4. Publish Manually (optional)

npm:

```bash
npm publish --workspace=@apexmonitor/sdk
npm publish --workspace=@apexmonitor/browser-sdk
```

PyPI:

```bash
cd packages/python-sdk
python -m build
python -m twine upload dist/*
```

## 5. Publish via GitHub Actions

Use workflow `release-sdks.yml`:

- Trigger manually (`workflow_dispatch`) and pass versions.
- It builds and publishes npm and PyPI packages.

## 6. Post Publish Checklist

- Verify package pages on npm and PyPI.
- Test install in a clean sample app.
- Create release notes and migration notes.
- Announce support window and rollback plan.
