const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { env } = require('../config/env');

const LOCAL_STORAGE_SCHEME = 'local://';

function sanitizeFilename(name) {
  return String(name || 'attachment')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
}

async function ensureAttachmentDir() {
  await fs.mkdir(env.attachmentStorageDir, { recursive: true });
}

function buildLocalStorageKey(filename) {
  return `${LOCAL_STORAGE_SCHEME}${filename}`;
}

function resolveAttachmentPath(storedPath) {
  const normalized = String(storedPath || '');
  if (normalized.startsWith(LOCAL_STORAGE_SCHEME)) {
    return path.join(env.attachmentStorageDir, normalized.slice(LOCAL_STORAGE_SCHEME.length));
  }

  return normalized;
}

async function saveAttachment({ originalName, contentBase64 }) {
  await ensureAttachmentDir();

  const extension = path.extname(originalName || '') || '';
  const basename = sanitizeFilename(path.basename(originalName || 'attachment', extension));
  const storedFilename = `${Date.now()}-${crypto.randomUUID()}-${basename}${extension}`.slice(0, 200);
  const storedPath = resolveAttachmentPath(buildLocalStorageKey(storedFilename));
  const buffer = Buffer.from(contentBase64, 'base64');

  await fs.writeFile(storedPath, buffer);

  return {
    storedPath: buildLocalStorageKey(storedFilename),
    fileSize: BigInt(buffer.byteLength),
  };
}

async function deleteAttachmentFile(storedPath) {
  try {
    await fs.unlink(resolveAttachmentPath(storedPath));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  deleteAttachmentFile,
  ensureAttachmentDir,
  resolveAttachmentPath,
  saveAttachment,
};
