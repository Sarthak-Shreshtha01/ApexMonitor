import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const releaseVersion = process.env.RELEASE_VERSION?.trim();

if (!releaseVersion) {
  throw new Error('RELEASE_VERSION is required');
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readJsonVersion = async (relativePath) => {
  const filePath = path.join(rootDir, relativePath);
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text).version;
};

const sdkVersion = await readJsonVersion('packages/sdk/package.json');
const browserVersion = await readJsonVersion('packages/browser-sdk/package.json');
const pyproject = await readFile(path.join(rootDir, 'packages/python-sdk', 'pyproject.toml'), 'utf8');
const pyMatch = pyproject.match(/^version\s*=\s*"([^"]+)"/m);
const pythonVersion = pyMatch?.[1];

const versions = [sdkVersion, browserVersion, pythonVersion].filter(Boolean);
const mismatched = versions.filter((version) => version !== releaseVersion);

if (mismatched.length > 0) {
  throw new Error(`Release version mismatch: expected ${releaseVersion}, got ${versions.join(', ')}`);
}

console.log(`Release version check passed for ${releaseVersion}.`);