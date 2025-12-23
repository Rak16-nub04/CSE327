const fs = require('fs');
const path = require('path');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureJsonArrayFile(filePath) {
  const dir = path.dirname(filePath);
  ensureDirExists(dir);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
    return;
  }

  // If file exists but is empty/invalid, reset to empty array.
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      fs.writeFileSync(filePath, '[]', 'utf8');
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      fs.writeFileSync(filePath, '[]', 'utf8');
    }
  } catch {
    fs.writeFileSync(filePath, '[]', 'utf8');
  }
}

function readArray(filePath) {
  ensureJsonArrayFile(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeArray(filePath, value) {
  ensureJsonArrayFile(filePath);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  ensureJsonArrayFile,
  readArray,
  writeArray
};
