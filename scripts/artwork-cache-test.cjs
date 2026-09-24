const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { createArtworkCache } = require('../src/artwork-cache.cjs');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xbox-artwork-cache-'));
  try {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let requests = 0;
    const url = 'https://art.example.test/cover.png';
    const cache = createArtworkCache(directory, {
      allowedHosts: new Set(['art.example.test']),
      fetchImage: async () => { requests++; return new Response(image, { headers: { 'content-type': 'image/png' } }); }
    });
    const [first, duplicate] = await Promise.all([cache.cacheImage(url), cache.cacheImage(url)]);
    assert.equal(first, duplicate);
    assert.equal(requests, 1, 'simultaneous requests should share one download');
    assert.deepEqual(await fs.readFile(fileURLToPath(first)), image);
    const artwork = await cache.cacheArtwork({ tile: url, logo: url, tileIsSquare: true });
    assert.equal(artwork.tile, first);
    assert.equal(artwork.sourceUrls.tile, url);
    assert.equal(await cache.cacheImage('https://not-allowed.test/cover.png'), 'https://not-allowed.test/cover.png');
    const offline = createArtworkCache(directory, {
      allowedHosts: new Set(['art.example.test']),
      fetchImage: () => { throw Error('Network must not be used for a cached image'); }
    });
    assert.equal(await offline.cacheImage(url), first);
    assert.equal((await offline.cacheArtwork(artwork)).tile, first);
    console.log('PASS: bounded allowlisted artwork cache, duplicate requests, and offline reuse');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
