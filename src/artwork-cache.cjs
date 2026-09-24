const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');
const { pathToFileURL } = require('url');

const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'],
  ['image/avif', '.avif'], ['image/gif', '.gif'], ['image/svg+xml', '.svg']
]);
const ALLOWED_HOSTS = new Set([
  'cdn2.steamgriddb.com', 'cdn.steamgriddb.com', 'cdn.akamai.steamstatic.com',
  'shared.fastly.steamstatic.com', 'store-images.s-microsoft.com',
  'images-eds.xboxlive.com', 'image.api.playstation.com', 'assets-prd.ignimgs.com'
]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CACHE_BYTES = 600 * 1024 * 1024;
const ARTWORK_FIELDS = ['tile', 'grid', 'wide', 'hero', 'logo'];

function createArtworkCache(directory, { fetchImage = fetch, allowedHosts = ALLOWED_HOSTS } = {}) {
  const inflight = new Map();
  let knownBytes;

  function allowed(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && allowedHosts.has(parsed.hostname);
    } catch { return false; }
  }

  async function cachedPath(url) {
    const hash = createHash('sha256').update(url).digest('hex');
    for (const suffix of IMAGE_TYPES.values()) {
      const filename = path.join(directory, `${hash}${suffix}`);
      try { await fs.access(filename); return filename; } catch { /* Try the next image format. */ }
    }
    return null;
  }

  async function sizeOnDisk() {
    if (knownBytes !== undefined) return knownBytes;
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const sizes = await Promise.all(entries.filter(entry => entry.isFile()).map(entry => fs.stat(path.join(directory, entry.name)).then(stat => stat.size).catch(() => 0)));
      knownBytes = sizes.reduce((total, size) => total + size, 0);
    } catch { knownBytes = 0; }
    return knownBytes;
  }

  async function store(url) {
    if (!allowed(url)) return url;
    const existing = await cachedPath(url);
    if (existing) return pathToFileURL(existing).href;
    if (await sizeOnDisk() >= MAX_CACHE_BYTES) return url;
    try {
      const response = await fetchImage(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok || !allowed(response.url || url)) return url;
      const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const extension = IMAGE_TYPES.get(mime);
      if (!extension || Number(response.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) return url;
      const chunks = [];
      let byteCount = 0;
      for await (const chunk of response.body) {
        byteCount += chunk.length;
        if (byteCount > MAX_IMAGE_BYTES) { await response.body.cancel().catch(() => {}); return url; }
        chunks.push(chunk);
      }
      if (!byteCount || (await sizeOnDisk()) + byteCount > MAX_CACHE_BYTES) return url;
      const filename = path.join(directory, `${createHash('sha256').update(url).digest('hex')}${extension}`);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${filename}.tmp`, Buffer.concat(chunks));
      await fs.rename(`${filename}.tmp`, filename);
      knownBytes += byteCount;
      return pathToFileURL(filename).href;
    } catch { return url; }
  }

  function cacheImage(url) {
    if (!allowed(url)) return Promise.resolve(url);
    if (!inflight.has(url)) inflight.set(url, store(url).finally(() => inflight.delete(url)));
    return inflight.get(url);
  }

  async function cacheArtwork(artwork) {
    if (!artwork) return artwork;
    const next = { ...artwork, sourceUrls: { ...(artwork.sourceUrls || {}) } };
    await Promise.all(ARTWORK_FIELDS.map(async field => {
      if (typeof next[field] !== 'string') return;
      const source = allowed(next[field]) ? next[field] : next.sourceUrls[field];
      if (!source) return;
      next.sourceUrls[field] = source;
      next[field] = await cacheImage(source);
    }));
    return next;
  }

  return { cacheImage, cacheArtwork, cachedPath };
}

module.exports = { createArtworkCache };
