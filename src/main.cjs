const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { fileURLToPath } = require('url');
const { spawn, execFile } = require('child_process');
const { createArtworkCache } = require('./artwork-cache.cjs');

if (process.env.NEBULA_DEMO === '1') {
  app.setPath('userData', process.env.NEBULA_DEMO_USER_DATA || path.join(app.getPath('temp'), 'xbox-preview-ui-demo'));
  app.disableHardwareAcceleration();
}

let mainWindow;
let currentLibrary = [];
const gameDetailCache = new Map();
let steamChartsCache = { at: 0, apiKey: '', ranks: new Map(), status: 'empty' };
let steamDiscoveryCache = { at: 0, data: null };
const steamDiscoveryArtworkCache = new Map();
let steamDiscoveryArtworkRunning = false;
let xboxTitleHistoryCache = { at: 0, apiKey: '', xuid: '', titles: [] };
const xboxAchievementCache = new Map();

const SETTINGS_DEFAULTS = {
  steamGridDbKey: '',
  steamApiKey: '',
  xboxApiKey: '',
  steamId64: '',
  showUninstalledSteam: false,
  showUninstalledEpic: false,
  legendaryPath: '',
  fullscreen: true,
  hiddenGameIds: [],
  customGames: [],
  artwork: {},
  playHistory: [],
  playCounts: {},
  steamAppDetails: {},
  gameLaunchOptions: {},
  gameCategoryOverrides: {},
  achievementReferenceAppIds: {},
  xboxAchievementReferences: {},
  soundEffects: true,
  onboardingComplete: false,
  steamBannerDismissed: false,
  avatarId: 'one-orbit',
  avatarImage: '',
  displayName: 'Player',
  uiScale: 1,
  tileRadius: 8,
  reducedMotion: false,
  useRandomScreenshotBackground: true,
  shuffleHomeScreenshots: true
};

let settingsWriteQueue = Promise.resolve();
let librarySnapshotWriteQueue = Promise.resolve();
let artworkScanEpoch = 0;

function settingsPath() {
  const root = process.env.NEBULA_DEMO === '1' ? process.env.NEBULA_DEMO_USER_DATA || path.join(app.getPath('temp'), 'xbox-preview-ui-demo') : app.getPath('userData');
  return path.join(root, 'settings.json');
}

function librarySnapshotPath() {
  return path.join(path.dirname(settingsPath()), 'library-snapshot.json');
}

const artworkCache = createArtworkCache(path.join(path.dirname(settingsPath()), 'artwork-cache'));
let artworkCacheTask = Promise.resolve();

async function readLibrarySnapshot() {
  try {
    await librarySnapshotWriteQueue;
    const snapshot = JSON.parse(await fs.readFile(librarySnapshotPath(), 'utf8'));
    if (snapshot.version !== 1 || !Array.isArray(snapshot.games) || snapshot.games.length > 30000
      || !snapshot.games.every(game => typeof game?.id === 'string' && typeof game.title === 'string' && typeof game.provider === 'string')) return null;
    if (!currentLibrary.length) currentLibrary = snapshot.games;
    return { ...snapshot.summary, games: snapshot.games, cachedAt: snapshot.savedAt };
  } catch { return null; }
}

function writeLibrarySnapshot(result, scanEpoch) {
  const operation = librarySnapshotWriteQueue.then(async () => {
    if (scanEpoch !== artworkScanEpoch) return;
    const target = librarySnapshotPath();
    const temporary = `${target}.tmp`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(temporary, JSON.stringify({ version: 1, savedAt: Date.now(), summary: { ...result, games: undefined }, games: result.games }), 'utf8');
    if (scanEpoch !== artworkScanEpoch) return;
    await fs.rename(temporary, target);
  });
  librarySnapshotWriteQueue = operation.catch(() => {});
  return operation;
}

async function readSettings() {
  try {
    const saved = JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
    return { ...SETTINGS_DEFAULTS, ...saved, showUninstalledSteam: Boolean(saved.showUninstalledSteam && saved.steamApiKey), uiScale: saved.uiScale === 0.7 && !saved.uiScaleCustomized ? 1 : saved.uiScale ?? SETTINGS_DEFAULTS.uiScale, steamGridDbKey: saved.steamGridDbKey || process.env.NEBULA_SGDB_KEY || '' };
  } catch {
    if (process.env.NEBULA_DEMO === '1') return { ...SETTINGS_DEFAULTS, onboardingComplete: true, fullscreen: false };
    try {
      const legacyPath = path.join(app.getPath('appData'), 'nebula-pc-launcher', 'settings.json');
      const saved = JSON.parse(await fs.readFile(legacyPath, 'utf8'));
      return { ...SETTINGS_DEFAULTS, ...saved, showUninstalledSteam: Boolean(saved.showUninstalledSteam && saved.steamApiKey), uiScale: saved.uiScale === 0.7 && !saved.uiScaleCustomized ? 1 : saved.uiScale ?? SETTINGS_DEFAULTS.uiScale, steamGridDbKey: saved.steamGridDbKey || process.env.NEBULA_SGDB_KEY || '' };
    } catch {
      return { ...SETTINGS_DEFAULTS, steamGridDbKey: process.env.NEBULA_SGDB_KEY || '' };
    }
  }
}

async function fetchSteamCurrentPopularity(apiKey) {
  if (!apiKey) return { ranks: new Map(), status: 'needs-api-key' };
  if (steamChartsCache.apiKey === apiKey && Date.now() - steamChartsCache.at < 20 * 60 * 1000) {
    return { ranks: steamChartsCache.ranks, status: steamChartsCache.status };
  }
  try {
    const url = new URL('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('input_json', JSON.stringify({ context: { language: 'english', country_code: 'US' }, data_request: { include_basic_info: true } }));
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Steam charts returned ${response.status}`);
    const body = await response.json();
    const entries = body?.response?.ranks || body?.response?.games || [];
    const ranks = new Map(entries.flatMap((entry, index) => {
      const id = String(entry.appid || entry.app_id || entry.id || '');
      const rank = Number(entry.rank) || index + 1;
      return /^\d+$/.test(id) ? [[id, rank]] : [];
    }));
    steamChartsCache = { at: Date.now(), apiKey, ranks, status: ranks.size ? 'ready' : 'unavailable' };
    return { ranks, status: steamChartsCache.status };
  } catch {
    steamChartsCache = { at: Date.now(), apiKey, ranks: new Map(), status: 'unavailable' };
    return { ranks: steamChartsCache.ranks, status: steamChartsCache.status };
  }
}

function decodeSteamText(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function steamDiscoveryItem(appId, title, rank, extra = {}) {
  return { id: `steam-discovery-${appId}`, appId: String(appId), title: decodeSteamText(title), provider: 'Steam', discoveryOnly: true, installed: false, rank, artwork: { tile: null, tileIsSquare: false }, ...extra };
}

function parseSteamChart(html, { withPlayers = false, paidOnly = false } = {}) {
  const items = [];
  const seen = new Set();
  for (const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const link = row.match(/href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^\"]*"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i);
    if (!link || seen.has(link[1])) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => decodeSteamText(match[1].replace(/<[^>]*>/g, '')));
    if (paidOnly && cells.some(cell => /^(?:free|free to play)$/i.test(cell))) continue;
    const rank = Number(cells.find(cell => /^\d+$/.test(cell))) || items.length + 1;
    const currentPlayers = withPlayers ? Number((cells.find(cell => /^\d{1,3}(?:,\d{3})+$/.test(cell)) || '0').replaceAll(',', '')) : undefined;
    seen.add(link[1]);
    items.push(steamDiscoveryItem(link[1], link[2], paidOnly ? items.length + 1 : rank, { currentPlayers }));
    if (items.length === 5) break;
  }
  return items;
}

function parseSteamUpcoming(html, limit = 5) {
  const items = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b[^>]*data-ds-appid="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const id = match[1];
    if (seen.has(id)) continue;
    const title = match[2].match(/<span class="title">([^<]+)<\/span>/i)?.[1];
    if (!title) continue;
    // A zero final price is common for unreleased games, so only reject an
    // explicit Free-to-Play tag or Steam's visible "Free" price label.
    if (/data-ds-tagids="[^"]*\b113\b/i.test(match[0]) || /discount_final_price free|>\s*Free(?: To Play)?\s*</i.test(match[2])) continue;
    seen.add(id);
    items.push(steamDiscoveryItem(id, title, items.length + 1));
    if (items.length === limit) break;
  }
  return items;
}

async function verifyUpcomingPaid(candidates) {
  const selected = [];
  for (let index = 0; index < candidates.length && selected.length < 5; index += 5) {
    const batch = candidates.slice(index, index + 5);
    const checked = await Promise.all(batch.map(async game => {
      try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appId}&l=english`, { signal: AbortSignal.timeout(7000) });
        if (!response.ok) return game;
        const details = (await response.json())?.[game.appId]?.data;
        return details?.is_free === true || (details?.type && details.type !== 'game') ? null : game;
      } catch { return game; }
    }));
    selected.push(...checked.filter(Boolean));
  }
  return selected.slice(0, 5).map((game, index) => ({ ...game, rank: index + 1 }));
}

async function fetchSteamDiscovery() {
  if (steamDiscoveryCache.data && Date.now() - steamDiscoveryCache.at < 20 * 60 * 1000) return steamDiscoveryCache.data;
  if (process.env.NEBULA_DEMO === '1') {
    const demo = { mostPlayed: [730, 570, 440, 1172470, 1085660].map((id, i) => steamDiscoveryItem(id, ['Counter-Strike 2', 'Dota 2', 'Team Fortress 2', 'Apex Legends', 'Destiny 2'][i], i + 1)), topSellers: [1091500, 1245620, 1174180, 594650, 2252570].map((id, i) => steamDiscoveryItem(id, ['Cyberpunk 2077', 'Elden Ring', 'Red Dead Redemption 2', 'Hunt: Showdown', 'Another paid game'][i], i + 1)), upcoming: [3669870, 2246340, 2314430, 2828710, 2406980].map((id, i) => steamDiscoveryItem(id, ['CONTROL Resonant', 'Upcoming game', 'Coming soon', 'New on Steam', 'Future release'][i], i + 1)), status: 'ready' };
    steamDiscoveryCache = { at: Date.now(), data: demo };
    return demo;
  }
  const urls = [
    'https://store.steampowered.com/charts/mostplayed?l=english',
    'https://store.steampowered.com/charts/topselling/global?l=english',
    'https://store.steampowered.com/search/results/?query&start=0&count=40&dynamic_data=&sort_by=_ASC&filter=popularcomingsoon&infinite=1&l=english'
  ];
  const responses = await Promise.allSettled(urls.map(async url => {
    const response = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Steam returned ${response.status}`);
    return url.includes('/search/results/') ? (await response.json()).results_html || '' : await response.text();
  }));
  const body = index => responses[index].status === 'fulfilled' ? responses[index].value : '';
  const data = { mostPlayed: parseSteamChart(body(0), { withPlayers: true }), topSellers: parseSteamChart(body(1), { paidOnly: true }), upcoming: await verifyUpcomingPaid(parseSteamUpcoming(body(2), 15)), status: responses.every(result => result.status === 'fulfilled') ? 'ready' : 'partial' };
  steamDiscoveryCache = { at: Date.now(), data };
  enrichSteamDiscoveryArtwork(data).catch(() => {});
  return data;
}

async function enrichSteamDiscoveryArtwork(data) {
  if (steamDiscoveryArtworkRunning) return;
  steamDiscoveryArtworkRunning = true;
  try {
    const settings = await readSettings();
    const games = [...new Map([...data.mostPlayed, ...data.topSellers, ...data.upcoming].map(game => [game.appId, game])).values()];
    let next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (next < games.length) {
        const game = games[next++];
        const cached = steamDiscoveryArtworkCache.get(game.appId);
        const artwork = cached && Date.now() - cached.at < 24 * 60 * 60 * 1000
          ? cached.artwork : await findArtwork(game.title, settings.steamGridDbKey, 'Steam', false).catch(() => null);
        if (!cached || Date.now() - cached.at >= 24 * 60 * 60 * 1000) steamDiscoveryArtworkCache.set(game.appId, { at: Date.now(), artwork });
        if (!artwork?.tile) continue;
        for (const item of [...data.mostPlayed, ...data.topSellers, ...data.upcoming]) if (item.appId === game.appId) item.artwork = artwork;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('steam:discovery-artwork', { appId: game.appId, artwork });
      }
    }));
  } finally { steamDiscoveryArtworkRunning = false; }
}

function writeSettings(next, { replaceArtwork = false } = {}) {
  const operation = settingsWriteQueue.then(async () => {
    const previous = await readSettings();
    const settings = { ...previous, ...next };
    if (next.artwork && !replaceArtwork) {
      settings.artwork = { ...(previous.artwork || {}) };
      for (const [id, entry] of Object.entries(next.artwork)) {
        const old = settings.artwork[id] || {};
        settings.artwork[id] = { ...old, ...entry, logo: entry.logo || old.logo || null };
      }
    }
    await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
    await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
    return settings;
  });
  settingsWriteQueue = operation.catch(() => {});
  return operation;
}

function replaceSettings(next) {
  const operation = settingsWriteQueue.then(async () => {
    await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
    await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  });
  settingsWriteQueue = operation.catch(() => {});
  return operation;
}

function parseVdfValue(text, key) {
  return text.match(new RegExp(`"${key}"\\s+"([^"]*)"`, 'i'))?.[1] || '';
}

async function exists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findSteamRoots() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam')
  ];

  const roots = [];
  for (const candidate of candidates) {
    if (await exists(path.join(candidate, 'steamapps'))) roots.push(candidate);
  }

  for (const root of [...roots]) {
    try {
      const libraryVdf = await fs.readFile(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      const matches = [...libraryVdf.matchAll(/"path"\s+"([^"]+)"/gi)];
      for (const match of matches) {
        const libraryRoot = match[1].replace(/\\\\/g, '\\');
        if (!roots.includes(libraryRoot) && await exists(path.join(libraryRoot, 'steamapps'))) roots.push(libraryRoot);
      }
    } catch { /* Steam may not have created libraryfolders.vdf yet. */ }
  }
  return roots;
}

function isSteamRuntimeComponent(appId, title) {
  return String(appId) === '228980' || /steamworks common redistributables|steam linux runtime|steam runtime redistributable/i.test(String(title || ''));
}

async function scanSteam() {
  const games = [];
  const roots = await findSteamRoots();
  let steamExecutable = '';
  for (const root of roots) {
    if (await exists(path.join(root, 'steam.exe'))) {
      steamExecutable = path.join(root, 'steam.exe');
      break;
    }
  }
  for (const root of roots) {
    const steamApps = path.join(root, 'steamapps');
    let manifests = [];
    try {
      manifests = (await fs.readdir(steamApps)).filter((file) => /^appmanifest_\d+\.acf$/i.test(file));
    } catch { continue; }

    for (const manifest of manifests) {
      try {
        const text = await fs.readFile(path.join(steamApps, manifest), 'utf8');
        const appId = parseVdfValue(text, 'appid');
        const title = parseVdfValue(text, 'name');
        const installDir = parseVdfValue(text, 'installdir');
        const type = parseVdfValue(text, 'type').toLowerCase();
        const updated = Number(parseVdfValue(text, 'LastUpdated')) || 0;
        if (!appId || !title || isSteamRuntimeComponent(appId, title)) continue;
        games.push({
          id: `steam-${appId}`,
          title,
          provider: 'Steam',
          appId,
          steamType: type,
          addedAt: updated ? updated * 1000 : 0,
          steamExecutable,
          installPath: path.join(steamApps, 'common', installDir),
          launchUri: `steam://rungameid/${appId}`
        });
      } catch { /* Ignore incomplete manifests. */ }
    }
  }
  return games;
}

async function detectSteamId64() {
  for (const root of await findSteamRoots()) {
    try {
      const users = await fs.readFile(path.join(root, 'config', 'loginusers.vdf'), 'utf8');
      const entries = [...users.matchAll(/"(\d{17})"\s*\{([^{}]*)\}/g)];
      const recent = entries.find((entry) => /"MostRecent"\s+"1"/i.test(entry[2]));
      if (recent) return recent[1];
      if (entries[0]) return entries[0][1];
    } catch { /* Steam may not have a local account signed in. */ }
  }
  return '';
}

async function detectRecentSteamId64() {
  for (const root of await findSteamRoots()) {
    try {
      const users = await fs.readFile(path.join(root, 'config', 'loginusers.vdf'), 'utf8');
      const recent = users.match(/"(\d{17})"\s*\{[^{}]*"MostRecent"\s+"1"[^{}]*\}/i);
      if (recent) return recent[1];
    } catch { /* No local account is selected in this Steam install. */ }
  }
  return '';
}

async function steamClientIsRunning() {
  if (process.platform !== 'win32') return false;
  return new Promise((resolve) => {
    let output = '';
    const child = spawn('tasklist.exe', ['/FI', 'IMAGENAME eq steam.exe', '/FO', 'CSV', '/NH'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 2500);
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.once('error', () => { clearTimeout(timer); resolve(false); });
    child.once('close', () => { clearTimeout(timer); resolve(/"steam\.exe"/i.test(output)); });
  });
}

async function fetchOwnedSteamGames(settings) {
  const steamId64 = String(settings.steamId64 || await detectSteamId64()).trim();
  if (!settings.steamApiKey || !steamId64) {
    return { games: [], status: settings.steamApiKey ? 'needs-steam-id' : 'needs-api-key', steamId64, count: 0 };
  }
  try {
    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
    url.searchParams.set('key', settings.steamApiKey);
    url.searchParams.set('steamid', steamId64);
    url.searchParams.set('include_appinfo', '1');
    url.searchParams.set('include_played_free_games', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return { games: [], status: response.status === 401 || response.status === 403 ? 'invalid-api-key' : 'steam-error', steamId64, count: 0 };
    const body = await response.json();
    if (!body?.response || !Array.isArray(body.response.games)) {
      return { games: [], status: 'private-library', steamId64, count: 0 };
    }
    return {
      status: 'ready', steamId64, count: body.response.games.length,
      games: body.response.games.filter((item) => !isSteamRuntimeComponent(item.appid, item.name)).map((item) => ({
        id: `steam-${item.appid}`,
        title: item.name || `Steam game ${item.appid}`,
        provider: 'Steam',
        appId: String(item.appid),
        installed: false,
        steamPlaytimeMinutes: Number(item.playtime_forever) || 0,
        launchUri: `steam://rungameid/${item.appid}`
      }))
    };
  } catch {
    return { games: [], status: 'steam-error', steamId64, count: 0 };
  }
}

async function scanEpic() {
  const manifestRoot = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files = [];
  try {
    files = (await fs.readdir(manifestRoot)).filter((file) => file.endsWith('.item'));
  } catch { return []; }

  const games = [];
  for (const file of files) {
    try {
      const item = JSON.parse(await fs.readFile(path.join(manifestRoot, file), 'utf8'));
      if (!item.DisplayName || !item.InstallLocation || item.bIsIncompleteInstall) continue;
      const executable = path.join(item.InstallLocation, item.LaunchExecutable || '');
      games.push({
        id: `epic-${item.CatalogItemId || item.AppName || item.DisplayName}`,
        title: item.DisplayName,
        provider: 'Epic Games',
        installPath: item.InstallLocation,
        executable,
        args: item.LaunchCommand || ''
      });
    } catch { /* Ignore launcher support manifests. */ }
  }
  return games;
}

async function collectFiles(root, extension, files = []) {
  try {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory()) await collectFiles(candidate, extension, files);
      else if (entry.name.toLowerCase().endsWith(extension)) files.push(candidate);
    }
  } catch { /* A start-menu folder may be missing or inaccessible. */ }
  return files;
}

async function scanXboxGames() {
  const roots = [
    path.join(process.env.SystemDrive || 'C:', 'XboxGames'),
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'XboxGames')
  ];
  const games = [];
  for (const root of roots) {
    let entries = [];
    try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const installPath = path.join(root, entry.name);
      const executables = await collectFiles(installPath, '.exe');
      const playable = executables
        .filter((file) => !/\\(redist|redist64|support|prereq|crash|easyanticheat|_commonredist)(\\|$)/i.test(file))
        .filter((file) => !/(unins|install|setup|launcherupdater|crashreport|ueprereq)/i.test(path.basename(file)));
      const executable = playable.find((file) => /\\content\\/i.test(file)) || playable[0];
      if (!executable) continue;
      games.push({
        id: `xbox-${Buffer.from(installPath.toLowerCase()).toString('base64url')}`,
        title: entry.name,
        provider: 'Xbox PC',
        installPath,
        executable,
        args: ''
      });
    }
  }
  return games;
}

async function scanPublisherShortcuts() {
  const roots = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ].filter(Boolean);
  const rules = [
    { provider: 'Ubisoft Connect', match: /(ubisoft|uplay)/i },
    { provider: 'EA app', match: /(^|\\|\s)(ea games|electronic arts)(\\|\s|$)/i },
    { provider: 'Battle.net', match: /(battle\.net|blizzard)/i },
    { provider: 'GOG Galaxy', match: /(gog|galaxy)/i },
    { provider: 'Amazon Games', match: /amazon games/i },
    { provider: 'Rockstar Games', match: /rockstar games/i },
    { provider: 'Riot Games', match: /riot games/i },
    { provider: 'itch.io', match: /itch\.io/i },
    { provider: 'Xbox PC', match: /(^|\\)xbox(\\|\s|$)/i }
  ];
  const ignored = /(uninstall|unins|launcher|updater|repair|crash|website|readme|support|ubisoft connect|ea app|battle\.net|xbox app|gog galaxy|amazon games|rockstar games launcher|riot client|itch\.io app)/i;
  const games = [];
  for (const root of roots) {
    const shortcuts = [...await collectFiles(root, '.lnk'), ...await collectFiles(root, '.url')];
    for (const shortcutPath of shortcuts) {
      const relative = path.relative(root, shortcutPath);
      const rule = rules.find((item) => item.match.test(relative));
      const title = path.basename(shortcutPath, path.extname(shortcutPath)).trim();
      if (!rule || !title || ignored.test(title)) continue;
      games.push({
        id: `shortcut-${Buffer.from(shortcutPath.toLowerCase()).toString('base64url')}`,
        title,
        provider: rule.provider,
        shortcutPath,
        installPath: null
      });
    }
  }
  return games;
}

async function scanInstalledLaunchers() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const roaming = process.env.APPDATA || '';
  const definitions = [
    ['Steam', [path.join(programFilesX86, 'Steam', 'steam.exe'), path.join(programFiles, 'Steam', 'steam.exe')]],
    ['Epic Games Launcher', [path.join(programFilesX86, 'Epic Games', 'Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe'), path.join(programFiles, 'Epic Games', 'Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe')]],
    ['EA app', [path.join(programFiles, 'Electronic Arts', 'EA Desktop', 'EA Desktop', 'EADesktop.exe')]],
    ['Ubisoft Connect', [path.join(programFilesX86, 'Ubisoft', 'Ubisoft Game Launcher', 'UbisoftConnect.exe')]],
    ['Battle.net', [path.join(programFilesX86, 'Battle.net', 'Battle.net Launcher.exe'), path.join(programFiles, 'Battle.net', 'Battle.net Launcher.exe')]],
    ['GOG Galaxy', [path.join(programFilesX86, 'GOG Galaxy', 'GalaxyClient.exe'), path.join(programFiles, 'GOG Galaxy', 'GalaxyClient.exe')]],
    ['Amazon Games', [path.join(programFilesX86, 'Amazon Games', 'App', 'Amazon Games.exe'), ...(local ? [path.join(local, 'Amazon Games', 'App', 'Amazon Games.exe')] : [])]],
    ['Rockstar Games Launcher', [path.join(programFiles, 'Rockstar Games', 'Launcher', 'Launcher.exe'), path.join(programFilesX86, 'Rockstar Games', 'Launcher', 'Launcher.exe')]],
    ['Riot Client', [path.join(path.parse(programFiles).root, 'Riot Games', 'Riot Client', 'RiotClientServices.exe'), ...(local ? [path.join(local, 'Riot Games', 'Riot Client', 'RiotClientServices.exe')] : [])]],
    ['itch', [path.join(programFiles, 'itch', 'itch.exe'), ...(roaming ? [path.join(roaming, 'itch', 'itch.exe')] : [])]]
  ];
  const launchers = [];
  for (const [title, candidates] of definitions) {
    const executable = (await Promise.all(candidates.map(async candidate => await exists(candidate) ? candidate : null))).find(Boolean);
    if (!executable) continue;
    let launcherIcon = '';
    try { launcherIcon = (await app.getFileIcon(executable, { size: 'normal' })).toDataURL(); } catch { /* Text mark still identifies the app. */ }
    launchers.push({ id: `launcher-${normalizeTitle(title).replaceAll(' ', '-')}`, title, provider: title === 'Epic Games Launcher' ? 'Epic Games' : title, executable, installPath: path.dirname(executable), isApp: true, isLauncher: true, launcherIcon });
  }
  if (process.platform === 'win32') {
    const xboxPackage = await new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-AppxPackage -Name Microsoft.GamingApp).PackageFamilyName'], { windowsHide: true, timeout: 3500 }, (error, stdout) => resolve(!error && /Microsoft\.GamingApp_/i.test(stdout)));
    });
    if (xboxPackage) launchers.push({ id: 'launcher-xbox-app', title: 'Xbox app', provider: 'Xbox PC', launchUri: 'msxbox://', isApp: true, isLauncher: true, isXboxLauncher: true });
  }
  return launchers;
}

async function fetchSgdbJson(endpoint, apiKey) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://www.steamgriddb.com/api/v2${endpoint}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 15000) : 1500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`SteamGridDB returned ${response.status}`);
    const body = await response.json();
    return body.data || [];
  }
  return [];
}

async function fetchSteamNews(appId) {
  try {
    const response = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${encodeURIComponent(appId)}&count=10&maxlength=6000&format=json`, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const body = await response.json();
    return (body.appnews?.newsitems || []).map((item) => {
      const raw = String(item.contents || '');
      const candidate = String(item.image || raw.match(/\[img\](https:\/\/[^\[]+)\[\/img\]/i)?.[1] || raw.match(/<img[^>]+src=["'](https:\/\/[^"']+)/i)?.[1] || '');
      let image = null;
      try {
        const url = new URL(candidate);
        if (url.protocol === 'https:' && (url.hostname === 'steamstatic.com' || url.hostname.endsWith('.steamstatic.com'))) image = url.toString();
      } catch { /* No usable image in this post. */ }
      return {
        title: item.title, url: item.url, date: item.date, image,
        contents: raw.replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
      };
    }).filter((item) => {
      const sample = `${item.title} ${item.contents}`;
      const letters = (sample.match(/\p{L}/gu) || []).length;
      const latin = (sample.match(/[A-Za-z]/g) || []).length;
      if (letters && latin / letters < .8) return false;
      const englishSignals = sample.match(/\b(the|and|for|with|new|update|game|now|this|your|available|from|will|have|our|you|are|we|today|coming|patch|fixes|players)\b/gi) || [];
      return englishSignals.length >= 2;
    }).slice(0, 3);
  } catch {
    return [];
  }
}

function scheduleScreenshotCache(game, details) {
  if (!details.screenshots?.length || process.env.NEBULA_DEMO === '1') return;
  const task = (async () => {
    const cachedScreenshots = [];
    for (let index = 0; index < details.screenshots.length; index += 4) {
      cachedScreenshots.push(...await Promise.all(details.screenshots.slice(index, index + 4).map(url => artworkCache.cacheImage(url))));
    }
    if (!currentLibrary.some(entry => entry.id === game.id)) return;
    game.artwork = { ...(game.artwork || {}), screenshots: cachedScreenshots };
    details.screenshots = cachedScreenshots;
    await writeSettings({ artwork: { [game.id]: game.artwork } });
  })();
  artworkCacheTask = Promise.allSettled([artworkCacheTask, task]);
}

async function fetchGameDetails(game) {
  const cached = gameDetailCache.get(game.id);
  if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.data;
  const fallback = {
    title: game.title, provider: game.provider, description: '', genres: [], developer: '', publisher: '', releaseDate: '',
    screenshots: game.artwork?.screenshots || [], dlc: [], dlcStatus: 'unavailable',
    ageRating: '', controllerSupport: game.controls || 'unknown', categories: [], playableOn: ['PC'],
    achievementCount: 0, supportedLanguages: '', metacriticScore: null
  };
  const xboxFallback = async () => {
    const xboxDetails = await fetchXboxCatalogDetails(game.title);
    const result = xboxDetails ? { ...fallback, ...xboxDetails } : fallback;
    gameDetailCache.set(game.id, { at: Date.now(), data: result });
    scheduleScreenshotCache(game, result);
    return result;
  };
  let appId = /^\d+$/.test(String(game.achievementReferenceAppId || game.appId || '')) ? String(game.achievementReferenceAppId || game.appId) : '';
  if (!appId) try {
    const search = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.title)}&l=english&cc=US`, { signal: AbortSignal.timeout(7000) });
    const results = (await search.json()).items || [];
    const match = [...results].sort((a, b) => titleMatchScore(game.title, b.name) - titleMatchScore(game.title, a.name))[0];
    if (match?.id && titleMatchScore(game.title, match.name) >= 90) appId = String(match.id);
  } catch { /* An imported title may not have a Steam store listing. */ }
  if (!appId) return xboxFallback();
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=english`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return xboxFallback();
    const body = await response.json();
    const item = body?.[appId]?.success ? body[appId].data : null;
    if (!item) return xboxFallback();
    const details = {
      ...fallback,
      title: item.name || game.title,
      description: String(item.short_description || '').replace(/<[^>]+>/g, '').trim(),
      genres: (item.genres || []).map((entry) => entry.description).filter(Boolean).slice(0, 5),
      developer: (item.developers || []).join(', '),
      publisher: (item.publishers || []).join(', '),
      releaseDate: item.release_date?.date || '',
      ageRating: item.required_age ? `${item.required_age}+` : '',
      categories: (item.categories || []).map((entry) => entry.description).filter(Boolean).slice(0, 18),
      playableOn: Object.entries(item.platforms || {}).filter(([, supported]) => supported).map(([platform]) => platform === 'windows' ? 'PC' : platform === 'mac' ? 'macOS' : 'Linux'),
      controllerSupport: item.controller_support === 'full' ? 'controller' : item.controller_support === 'partial' ? 'partial' : fallback.controllerSupport,
      achievementCount: Number(item.achievements?.total) || 0,
      supportedLanguages: String(item.supported_languages || '').replace(/<br\s*\/?\s*>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\*+\s*languages with full audio support.*$/i, '').replace(/\*/g, '').split(',').map((language) => language.trim()).filter(Boolean).slice(0, 8).join(', '),
      metacriticScore: Number(item.metacritic?.score) || null,
      screenshots: (item.screenshots || []).map((entry) => entry.path_full || entry.path_thumbnail).filter((url) => /^https:\/\/[^/]*steamstatic\.com\//i.test(url)).slice(0, 12),
      dlcStatus: 'unavailable'
    };
    const dlcIds = (item.dlc || []).map(String).filter((id) => /^\d+$/.test(id)).slice(0, 50);
    details.dlcIds = dlcIds;
    details.dlcStatus = dlcIds.length ? 'needs-check' : 'none-listed';
    if (!details.description || !details.screenshots.length) {
      const xbox = await fetchXboxCatalogDetails(game.title);
      if (xbox) {
        details.description ||= xbox.description || '';
        if (!details.screenshots.length) details.screenshots = xbox.screenshots || [];
        details.publisher ||= xbox.publisher || '';
        details.developer ||= xbox.developer || '';
      }
    }
    if (!details.screenshots.length) details.screenshots = fallback.screenshots;
    gameDetailCache.set(game.id, { at: Date.now(), data: details });
    scheduleScreenshotCache(game, details);
    return details;
  } catch { return xboxFallback(); }
}

async function fetchOwnedDlc(game) {
  const details = await fetchGameDetails(game);
  if (!details.dlcIds?.length) return { status: details.dlcStatus, items: [] };
  const owned = await fetchOwnedSteamGames(await readSettings());
  const ownedById = new Map((owned.games || []).map((entry) => [String(entry.appId), entry]));
  const ids = details.dlcIds.slice(0, 12);
  const items = [];
  for (let start = 0; start < ids.length; start += 3) {
    const batch = await Promise.all(ids.slice(start, start + 3).map(async (id) => {
      let title = ownedById.get(id)?.title || `DLC ${id}`;
      try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english`, { signal: AbortSignal.timeout(6000) });
        if (response.ok) {
          const body = await response.json();
          title = body?.[id]?.data?.name || title;
        }
      } catch { /* The DLC is still shown even if its title lookup fails. */ }
      return { id, title, owned: owned.status === 'ready' && ownedById.has(id), image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg` };
    }));
    items.push(...batch);
  }
  return { status: owned.status === 'ready' ? 'listed-checked' : 'listed-unverified', items, total: details.dlcIds.length };
}

async function fetchXboxAchievementCatalog(game, settings) {
  const apiKey = String(settings.xboxApiKey || '').trim();
  if (!apiKey) return null;
  const savedReference = game.xboxAchievementReference || settings.xboxAchievementReferences?.[game.id] || {};
  let xuid = '';
  let titles = [];
  try {
    if (xboxTitleHistoryCache.apiKey === apiKey && Date.now() - xboxTitleHistoryCache.at < 60 * 60 * 1000) {
      ({ xuid, titles } = xboxTitleHistoryCache);
    } else {
      const request = async (route) => {
        const response = await fetch(`https://api.xbl.io/v2/${route}`, {
          headers: { 'X-Authorization': apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`OpenXBL returned ${response.status}`);
        const body = await response.json();
        return body?.content || body?.data || body;
      };
      const account = await request('account');
      const profile = account.profileUsers?.[0] || account.profile?.profileUsers?.[0] || account.account?.profileUsers?.[0] || {};
      const profileSettings = profile.settings || [];
      xuid = String(account.xuid || account.XUID || profile.id || profile.hostId || '');
      const history = await request('player/titleHistory');
      titles = Array.isArray(history) ? history : history.titles || history.titleHistory || history.items || history.games || history.titleHistory?.titles || [];
      if (!Array.isArray(titles)) titles = [];
      xboxTitleHistoryCache = { at: Date.now(), apiKey, xuid, titles };
      if (!xuid) {
        const setting = profileSettings.find((item) => String(item.id).toLowerCase() === 'xuid');
        xuid = String(setting?.value || '');
      }
      xboxTitleHistoryCache.xuid = xuid;
    }
    if (!xuid) throw new Error('OpenXBL did not return an Xbox account identifier.');
    let reference = String(savedReference.titleId || '').trim() ? savedReference : null;
    if (!reference) {
      const ranked = titles.map((entry) => ({
        entry,
        titleId: String(entry.titleId || entry.titleID || entry.title?.titleId || entry.id || ''),
        name: String(entry.name || entry.titleName || entry.title?.name || entry.displayName || entry.title?.displayName || '')
      })).filter((entry) => /^\d{1,12}$/.test(entry.titleId))
        .map((entry) => ({ ...entry, score: titleMatchScore(game.title, entry.name) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0]?.score >= 66) reference = {
        titleId: ranked[0].titleId,
        platform: String(ranked[0].entry.platform || ranked[0].entry.device || ranked[0].entry.platformName || 'auto')
      };
    }
    if (!reference?.titleId) return { status: 'xbox-no-match', items: [] };
    const titleId = String(reference.titleId);
    const cacheKey = `${apiKey}:${xuid}:${titleId}:${reference.platform || 'auto'}`;
    const cached = xboxAchievementCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.result;
    const platform = String(reference.platform || 'auto');
    const is360 = platform === 'xbox360' || /360|legacy/i.test(platform);
    const routes = is360
      ? [`achievements/x360/${encodeURIComponent(xuid)}/title/${encodeURIComponent(titleId)}`, `achievements/player/${encodeURIComponent(xuid)}/${encodeURIComponent(titleId)}`]
      : [`achievements/player/${encodeURIComponent(xuid)}/${encodeURIComponent(titleId)}`, `achievements/x360/${encodeURIComponent(xuid)}/title/${encodeURIComponent(titleId)}`];
    let payload = null;
    let requestSucceeded = false;
    let detectedPlatform = platform;
    for (const route of routes) {
      try {
        const response = await fetch(`https://api.xbl.io/v2/${route}`, {
          headers: { 'X-Authorization': apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) continue;
        payload = await response.json();
        requestSucceeded = true;
        detectedPlatform = route.includes('/x360/') ? 'Xbox 360' : 'Xbox';
        break;
      } catch { /* Try the other documented Xbox achievement route. */ }
    }
    const body = payload?.content || payload?.data || payload;
    const achievements = body?.achievements || body?.playerAchievements || body?.achievementList || body?.items || (Array.isArray(body) ? body : []);
    if (!requestSucceeded) return { status: 'xbox-unavailable', items: [] };
    if (!Array.isArray(achievements) || !achievements.length) return { status: 'xbox-no-match', items: [] };
    const safeIcon = (value) => {
      try {
        const url = new URL(String(value || ''));
        if (url.protocol === 'http:') url.protocol = 'https:';
        return url.protocol === 'https:' ? url.toString() : null;
      } catch { return null; }
    };
    const items = achievements.slice(0, 250).map((entry) => {
      const icon = (entry.mediaAssets || []).find((asset) => /icon/i.test(String(asset.type || asset.name || '')))?.url || entry.icon || entry.imageUrl || '';
      const unlockedState = String(entry.progressState || entry.progression?.achievementState || entry.state || '');
      const hasUnlockInfo = Boolean(unlockedState || entry.progression?.timeUnlocked || typeof entry.unlocked === 'boolean' || typeof entry.earned === 'boolean');
      const reward = (entry.rewards || []).find((item) => String(item.type).toLowerCase() === 'gamerscore');
      const secret = Boolean(entry.isSecret || entry.secret);
      return {
        id: String(entry.id || entry.achievementId || entry.name || ''),
        title: secret && !/achieved|unlocked/i.test(unlockedState) ? 'Secret achievement' : String(entry.name || entry.title || entry.displayName || 'Achievement'),
        description: secret && !/achieved|unlocked/i.test(unlockedState) ? 'Unlock this achievement to reveal its details.' : String(entry.description || entry.lockedDescription || entry.requirements?.[0]?.description || ''),
        unlocked: /achieved|unlocked|earned/i.test(unlockedState) || Boolean(entry.progression?.timeUnlocked) || entry.unlocked === true || entry.earned === true ? true : hasUnlockInfo ? false : null,
        icon: safeIcon(icon), lockedIcon: safeIcon(icon), gamerscore: Number(reward?.value || entry.gamerscore || 0)
      };
    }).filter((item) => item.title);
    const result = { status: 'xbox-ready', source: 'Xbox Live', platform: detectedPlatform, progressAvailable: items.some((item) => item.unlocked !== null), items };
    xboxAchievementCache.set(cacheKey, { at: Date.now(), result });
    return result;
  } catch {
    return { status: 'xbox-unavailable', items: [] };
  }
}

async function fetchGameAchievements(game) {
  const settings = await readSettings();
  const steamId = String(settings.steamId64 || await detectSteamId64()).trim();
  let appId = /^\d+$/.test(String(game.achievementReferenceAppId || game.appId || '')) ? String(game.achievementReferenceAppId || game.appId) : '';
  const referenceOnly = game.provider !== 'Steam';
  if (!appId && referenceOnly) {
    try {
      const search = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.title)}&l=english&cc=US`, { signal: AbortSignal.timeout(7000) });
      const results = (await search.json()).items || [];
      const match = [...results].sort((a, b) => titleMatchScore(game.title, b.name) - titleMatchScore(game.title, a.name))[0];
      if (match?.id && titleMatchScore(game.title, match.name) >= 82) appId = String(match.id);
    } catch { /* A non-Steam game may have no Steam edition. */ }
  }
  const safeSteamIcon = (value) => {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol === 'http:') url.protocol = 'https:';
      return url.protocol === 'https:' && (url.hostname.endsWith('.steamstatic.com') || url.hostname === 'steamstatic.com' || url.hostname.endsWith('.akamaihd.net')) ? url.toString() : null;
    } catch { return null; }
  };
  if (appId) {
    if (settings.steamApiKey) try {
      const schemaUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/');
      schemaUrl.searchParams.set('key', settings.steamApiKey);
      schemaUrl.searchParams.set('appid', appId);
      schemaUrl.searchParams.set('l', 'english');
      const playerUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/');
      playerUrl.searchParams.set('key', settings.steamApiKey);
      playerUrl.searchParams.set('steamid', steamId);
      playerUrl.searchParams.set('appid', appId);
      playerUrl.searchParams.set('l', 'english');
      const [schemaResponse, playerResponse] = await Promise.all([
        fetch(schemaUrl, { signal: AbortSignal.timeout(10000) }),
        !referenceOnly && steamId ? fetch(playerUrl, { signal: AbortSignal.timeout(10000) }) : Promise.resolve(null)
      ]);
      if (schemaResponse.ok) {
        const schema = await schemaResponse.json();
        const player = playerResponse?.ok ? await playerResponse.json() : null;
        const available = schema.game?.availableGameStats?.achievements || [];
        const unlocked = new Map((player?.playerstats?.achievements || []).map((entry) => [entry.apiname, Boolean(entry.achieved)]));
        if (available.length) return {
          status: referenceOnly ? 'reference-only' : 'ready',
          progressAvailable: !referenceOnly && Boolean(player?.playerstats?.success),
          items: available.slice(0, 150).map((entry) => ({
            id: entry.name, title: entry.displayName || entry.name,
            description: entry.hidden ? '' : entry.description || '',
            unlocked: !referenceOnly && unlocked.has(entry.name) ? unlocked.get(entry.name) : null,
            icon: safeSteamIcon(entry.icon), lockedIcon: safeSteamIcon(entry.icongray)
          }))
        };
      }
    } catch { /* Public and Xbox catalogs remain available if Steam API data is missing. */ }

    try {
      const response = await fetch(`https://steamcommunity.com/stats/${encodeURIComponent(appId)}/achievements/?l=english`, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const html = await response.text();
        const decode = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_entity, code) => {
          const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
          return code[0] === '#' ? String.fromCodePoint(parseInt(code.slice(code[1]?.toLowerCase() === 'x' ? 2 : 1), code[1]?.toLowerCase() === 'x' ? 16 : 10)) : named[code.toLowerCase()] || ' ';
        }).trim();
        const items = html.split(/<div class="achieveRow\b/i).slice(1, 151).map((chunk, index) => {
          const icon = safeSteamIcon(chunk.match(/<img[^>]+src="([^"]+)"/i)?.[1]);
          const title = decode(chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
          const description = decode(chunk.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1]);
          return title ? { id: `${appId}-${index}`, title, description, icon, lockedIcon: null, unlocked: null } : null;
        }).filter(Boolean);
        if (items.length) return { status: referenceOnly ? 'reference-only' : 'catalog-only', progressAvailable: false, items };
      }
    } catch { /* An authenticated Xbox catalog may have this game's achievement data. */ }
  }
  const xbox = await fetchXboxAchievementCatalog(game, settings);
  if (xbox) return xbox;
  return { status: appId ? 'none-listed' : 'no-reference', items: [] };
}

function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleMatchScore(query, candidate) {
  const wanted = normalizeTitle(query);
  const actual = normalizeTitle(candidate);
  if (!wanted || !actual) return 0;
  if (wanted === actual) return 100;
  if (actual.startsWith(wanted) || wanted.startsWith(actual)) return 82;
  if (actual.includes(wanted) || wanted.includes(actual)) return 72;
  const wantedWords = new Set(wanted.split(' '));
  const actualWords = new Set(actual.split(' '));
  const overlap = [...wantedWords].filter((word) => actualWords.has(word)).length / Math.max(wantedWords.size, actualWords.size);
  const rows = Array.from({ length: wanted.length + 1 }, (_, row) => row);
  for (let column = 1; column <= actual.length; column++) {
    let diagonal = rows[0];
    rows[0] = column;
    for (let row = 1; row <= wanted.length; row++) {
      const previous = rows[row];
      rows[row] = Math.min(rows[row] + 1, rows[row - 1] + 1, diagonal + (wanted[row - 1] === actual[column - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  const editSimilarity = 1 - rows[wanted.length] / Math.max(wanted.length, actual.length);
  return Math.round(Math.max(overlap * 68, editSimilarity * 64));
}

function catalogImage(images, purpose, squareOnly = false) {
  return images
    .filter((image) => !purpose || image.ImagePurpose === purpose)
    .filter((image) => !squareOnly || Number(image.Width) === Number(image.Height))
    .sort((a, b) => (Number(b.Width) * Number(b.Height)) - (Number(a.Width) * Number(a.Height)))[0];
}

function catalogImageUrl(image) {
  if (!image?.Uri) return null;
  return image.Uri.startsWith('//') ? `https:${image.Uri}` : image.Uri;
}

async function fetchXboxCatalogArtwork(title) {
  try {
    const endpoint = `https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/Games/products?query=${encodeURIComponent(title)}&market=US&languages=en-US&fieldsTemplate=details&platformdependencyname=windows.xbox`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) return null;
    const body = await response.json();
    const products = body.Products || body.products || body.Items || body.items || [];
    if (!products.length) return null;
    const wanted = normalizeTitle(title);
    const product = [...products].sort((a, b) => {
      const titleOf = (item) => item.ProductTitle || item.LocalizedProperties?.[0]?.ProductTitle || item.LocalizedProperties?.[0]?.Title || '';
      const score = (value) => {
        const normalized = normalizeTitle(value);
        return normalized === wanted ? 4 : normalized.includes(wanted) || wanted.includes(normalized) ? 2 : 0;
      };
      return score(titleOf(b)) - score(titleOf(a));
    })[0];
    const productTitle = product?.ProductTitle || product?.LocalizedProperties?.[0]?.ProductTitle || product?.LocalizedProperties?.[0]?.Title || '';
    if (titleMatchScore(title, productTitle) < 72) return null;
    const localized = product.LocalizedProperties?.[0] || product.localizedProperties?.[0] || product;
    const imageList = localized.Images || localized.images || product.Images || product.images || [];
    const images = Array.isArray(imageList) ? imageList : [];
    const square = catalogImage(images, 'FeaturePromotionalSquareArt', true)
      || catalogImage(images, 'BoxArt', true)
      || catalogImage(images, null, true);
    const hero = catalogImage(images, 'TitledHeroArt')
      || catalogImage(images, 'SuperHeroArt')
      || catalogImage(images, null);
    if (!square && !hero) return null;
    const catalogText = JSON.stringify(product).toLowerCase();
    const controls = catalogText.includes('controller') ? 'controller' : 'unknown';
    return {
      tile: catalogImageUrl(square),
      grid: catalogImageUrl(square),
      tileIsSquare: Boolean(square),
      hero: catalogImageUrl(hero),
      wide: catalogImageUrl(hero),
      logo: null,
      controls,
      imageSource: 'xbox-catalog'
    };
  } catch {
    return null;
  }
}

async function fetchXboxCatalogDetails(title) {
  try {
    const endpoint = `https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/Games/products?query=${encodeURIComponent(title)}&market=US&languages=en-US&fieldsTemplate=details&platformdependencyname=windows.xbox`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(6500) });
    if (!response.ok) return null;
    const body = await response.json();
    const products = body.Products || body.products || body.Items || body.items || [];
    const product = [...products].sort((a, b) => titleMatchScore(title, b.ProductTitle || b.LocalizedProperties?.[0]?.ProductTitle || '') - titleMatchScore(title, a.ProductTitle || a.LocalizedProperties?.[0]?.ProductTitle || ''))[0];
    if (!product || titleMatchScore(title, product.ProductTitle || product.LocalizedProperties?.[0]?.ProductTitle || '') < 82) return null;
    const localized = product.LocalizedProperties?.[0] || product;
    const images = localized.Images || product.Images || [];
    const screenshots = (Array.isArray(images) ? images : [])
      .filter((image) => /screen|hero/i.test(String(image.ImagePurpose || '')))
      .map(catalogImageUrl).filter(isAllowedArtworkUrl).slice(0, 12);
    return {
      title: localized.ProductTitle || product.ProductTitle || title,
      description: String(localized.ShortDescription || localized.ProductDescription || '').replace(/<[^>]+>/g, '').trim(),
      publisher: localized.PublisherName || product.PublisherName || '',
      developer: localized.DeveloperName || '',
      screenshots,
      dlcStatus: 'unavailable'
    };
  } catch { return null; }
}

async function fetchSteamAppDetails(appIds) {
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appIds.join(','))}&l=en&filters=basic,categories`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return {};
    const body = await response.json();
    return Object.fromEntries(appIds.flatMap((appId) => {
      const data = body?.[appId]?.success ? body[appId].data : null;
      if (!data) return [];
      const categories = data?.categories || [];
      const categoryNames = categories.map((category) => String(category.description || '').trim()).filter(Boolean);
      const controls = categories.some((category) => Number(category.id) === 28)
        ? 'controller'
        : categories.some((category) => Number(category.id) === 29) ? 'partial' : 'kbm';
      return [[appId, { type: String(data?.type || '').toLowerCase(), controls, categories: categoryNames }]];
    }));
  } catch {
    return {};
  }
}

async function fetchPsnSquareArtwork(title) {
  try {
    const endpoint = new URL('https://web.np.playstation.com/api/graphql/v1//op');
    endpoint.searchParams.set('operationName', 'getSearchResults');
    endpoint.searchParams.set('variables', JSON.stringify({ countryCode: 'US', languageCode: 'en', nextCursor: '', pageOffset: 0, pageSize: 24, searchTerm: title }));
    endpoint.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: '4df6284f982e57bec70f23c77e2c219dc792eb19af7fb3d3a81767aa3f1958aa' } }));
    const response = await fetch(endpoint, { headers: { 'Content-Type': 'application/json', Origin: 'https://store.playstation.com', Referer: 'https://store.playstation.com/', 'apollographql-client-name': '@sie-ppr-web-store/app', 'apollographql-client-version': '0.113.0', 'X-PSN-Store-Locale-Override': 'en-US' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const results = (await response.json())?.data?.universalSearch?.results || [];
    const match = results.filter((item) => !['ADD_ON', 'ADD_ON_PACK', 'DEMO', 'VIRTUAL_CURRENCY'].includes(item.storeDisplayClassification) && titleMatchScore(title, item.name) >= 82)
      .sort((a, b) => titleMatchScore(title, b.name) - titleMatchScore(title, a.name))[0];
    if (!match) return null;
    const media = match.media || [];
    const image = (roles) => roles.map((role) => media.find((item) => item.type === 'IMAGE' && item.role === role)?.url).find(Boolean);
    const tile = image(['MASTER', 'GAMEHUB_COVER_ART', 'EDITION_KEY_ART']);
    if (!tile || !/^https:\/\/image\.api\.playstation\.com\//i.test(tile)) return null;
    const hero = image(['BACKGROUND', 'SIXTEEN_BY_NINE_BANNER', 'BACKGROUND_LAYER_ART']);
    return { tile, grid: tile, tileIsSquare: true, hero: hero || null, wide: hero || null, imageSource: 'playstation-store' };
  } catch { return null; }
}

async function fetchIgnSquareArtwork(title) {
  try {
    const endpoint = new URL('https://mollusk.apis.ign.com/graphql');
    endpoint.searchParams.set('operationName', 'SearchObjectsByName');
    endpoint.searchParams.set('variables', JSON.stringify({ term: title, count: 20, objectType: 'Game' }));
    endpoint.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: 'e1c2e012a21b4a98aaa618ef1b43eb0cafe9136303274a34f5d9ea4f2446e884' } }));
    const response = await fetch(endpoint, { headers: { 'Content-Type': 'application/json', Referer: 'https://www.ign.com/reviews/games', 'apollographql-client-name': 'kraken', 'apollographql-client-version': 'v0.67.0' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const results = (await response.json())?.data?.searchObjectsByName?.objects || [];
    const match = results.filter((item) => titleMatchScore(title, item.metadata?.names?.name) >= 85)
      .sort((a, b) => titleMatchScore(title, b.metadata?.names?.name) - titleMatchScore(title, a.metadata?.names?.name))[0];
    const tile = match?.primaryImage?.url;
    if (!tile || !/^https:\/\/assets-prd\.ignimgs\.com\//i.test(tile)) return null;
    return { tile, grid: tile, tileIsSquare: true, imageSource: 'ign' };
  } catch { return null; }
}

async function findArtwork(title, apiKey, provider = 'PC', fullArt = true) {
  const [psn, xbox, ign] = await Promise.all([
    fetchPsnSquareArtwork(title), fetchXboxCatalogArtwork(title), fetchIgnSquareArtwork(title)
  ]);
  let sgdb = null;
  let sgdbError = '';
  if (apiKey && (fullArt || !(psn?.tile || ign?.tile || xbox?.tile))) {
    try {
      const results = await fetchSgdbJson(`/search/autocomplete/${encodeURIComponent(title)}`, apiKey);
      if (results.length) {
        const ranked = results
          .map((result) => ({ ...result, matchScore: titleMatchScore(title, result.name) }))
          .sort((a, b) => b.matchScore - a.matchScore);
        const best = ranked[0];
        const second = ranked[1];
        // Automatic art should be conservative: a plausible franchise/edition
        // match is not enough to silently attach its logo and screenshots.
        if (!best?.id || (best.matchScore < 92 && !(best.matchScore >= 88 && best.matchScore - (second?.matchScore || 0) >= 12))) {
          throw new Error('No confident SteamGridDB title match');
        }
        const gameId = best.id;
        const [squareGrids, logos, heroes] = await Promise.all([
          fetchSgdbJson(`/grids/game/${gameId}?dimensions=512x512,1024x1024&types=static&nsfw=false`, apiKey),
          fetchSgdbJson(`/logos/game/${gameId}?types=static&nsfw=false`, apiKey),
          fetchSgdbJson(`/heroes/game/${gameId}?types=static&nsfw=false`, apiKey)
        ]);
        const logo = logos.find((asset) => asset.width / asset.height > 2.2) || logos[0];
        const square = squareGrids.find((asset) => Number(asset.width) === Number(asset.height));
        sgdb = {
          tile: square?.url || null,
          grid: square?.url || null,
          tileIsSquare: Boolean(square),
          hero: heroes[0]?.url || null,
          wide: null,
          logo: logo?.url || null,
          controls: 'unknown',
          sgdbGameId: gameId,
          imageSource: square ? 'steamgriddb-square' : 'none'
        };
      }
    } catch (error) {
      sgdbError = error.message || 'SteamGridDB request failed';
    }
  }

  if (!sgdb?.tile && !xbox?.tile && !psn?.tile && !ign?.tile && apiKey && sgdb?.sgdbGameId) {
    try {
      const [verticalGrids, wideGrids] = await Promise.all([
        fetchSgdbJson(`/grids/game/${sgdb.sgdbGameId}?dimensions=600x900,660x930,342x482&types=static&nsfw=false`, apiKey),
        fetchSgdbJson(`/grids/game/${sgdb.sgdbGameId}?dimensions=460x215,920x430&types=static&nsfw=false`, apiKey)
      ]);
      const fallback = verticalGrids[0] || wideGrids[0];
      sgdb.tile = fallback?.url || null;
      sgdb.grid = fallback?.url || null;
      sgdb.wide = wideGrids[0]?.url || null;
      sgdb.imageSource = fallback ? 'steamgriddb-fallback' : 'none';
    } catch (error) {
      sgdbError = error.message || sgdbError;
    }
  }

  const selected = psn?.tile ? psn : xbox?.tile ? xbox : ign?.tile ? ign : sgdb || psn || xbox || ign || {};
  const hasArtwork = Boolean(selected.tile || selected.hero || sgdb?.hero || xbox?.hero);
  const coverCandidates = [psn, xbox, ign, sgdb].filter((source) => source?.tile && isAllowedArtworkUrl(source.tile))
    .filter((source, index, sources) => sources.findIndex((candidate) => candidate.tile === source.tile) === index)
    .map((source) => ({ tile: source.tile, imageSource: source.imageSource, tileIsSquare: Boolean(source.tileIsSquare) }));
  return {
    tile: selected.tile || null,
    grid: selected.grid || selected.tile || null,
    tileIsSquare: Boolean(selected.tileIsSquare),
    hero: sgdb?.hero || psn?.hero || xbox?.hero || selected.tile || null,
    wide: sgdb?.wide || psn?.wide || xbox?.wide || null,
    logo: sgdb?.logo || null,
    controls: xbox?.controls || 'unknown',
    sgdbGameId: sgdb?.sgdbGameId || null,
    imageSource: selected.imageSource || (hasArtwork ? 'steamgriddb-fallback' : 'none'),
    coverCandidates,
    artworkVersion: 6,
    artworkError: hasArtwork ? '' : sgdbError,
    artworkPriority: 'psn-then-xbox-then-ign-then-steamgriddb',
    provider
  };
}

function isSteamAppType(type) {
  return ['software', 'application', 'tool', 'video', 'music'].includes(String(type || '').toLowerCase());
}

async function findLegendaryExecutable(configuredPath = '') {
  const candidates = [configuredPath];
  for (const directory of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) candidates.push(path.join(directory, 'legendary.exe'));
  for (const root of [process.env.ProgramFiles, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean)) {
    for (const name of ['Heroic', 'heroic']) candidates.push(path.join(root, name, 'resources', 'app.asar.unpacked', 'build', 'bin', 'x64', 'win32', 'legendary.exe'));
  }
  for (const candidate of candidates) {
    if (!candidate || path.basename(candidate).toLowerCase() !== 'legendary.exe') continue;
    if (await exists(candidate)) return candidate;
  }
  return '';
}

function parseLegendaryGames(output) {
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error('Legendary did not return a game list.');
  return parsed.filter(item => item && typeof item === 'object' && item.app_name && item.app_title)
    .filter(item => !item.is_dlc && !/unreal engine|marketplace/i.test(item.app_title))
    .map(item => ({ id: `epic-owned-${String(item.app_name).replace(/[^a-z\d_-]/gi, '').slice(0, 80)}`, title: String(item.app_title).trim().slice(0, 160), provider: 'Epic Games', epicAppName: String(item.app_name), epicOwned: true, installed: false }))
    .filter(item => item.title && item.id !== 'epic-owned-');
}

async function fetchOwnedEpicGames(settings) {
  if (process.env.NEBULA_DEMO === '1') return { games: [], status: 'needs-helper', helperPath: '' };
  const helperPath = await findLegendaryExecutable(settings.legendaryPath);
  if (!helperPath) return { games: [], status: 'needs-helper', helperPath: '' };
  if (!settings.showUninstalledEpic) return { games: [], status: 'available', helperPath };
  try {
    const output = await new Promise((resolve, reject) => execFile(helperPath, ['list', '--json'], { windowsHide: true, timeout: 30000, maxBuffer: 30 * 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout)));
    const games = parseLegendaryGames(output);
    return { games, status: 'ready', helperPath };
  } catch { return { games: [], status: 'sign-in-required', helperPath }; }
}

async function scanLibrary({ refreshArt = false } = {}) {
  const scanEpoch = ++artworkScanEpoch;
  const progress = (percent, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:progress', { percent, message });
  };
  progress(3, 'Finding installed games and your Steam library…');
  if (process.env.NEBULA_DEMO === '1' && process.env.NEBULA_REVIEW_SCAN_DELAY) {
    await new Promise(resolve => setTimeout(resolve, Math.min(5000, Number(process.env.NEBULA_REVIEW_SCAN_DELAY) || 0)));
  }
  const settings = await readSettings();
  const [found, ownedResult, epicOwnedResult] = await Promise.all([
    process.env.NEBULA_DEMO === '1'
      ? [[
        { id: 'demo-1', title: 'Forza Horizon 5', provider: 'Steam', appId: '1551360', executable: process.execPath },
        { id: 'demo-2', title: 'Halo Infinite', provider: 'Steam', appId: '1240440', executable: process.execPath },
        { id: 'demo-3', title: 'Lies of P', provider: 'PC', executable: process.execPath },
        { id: 'demo-4', title: 'Hi-Fi RUSH', provider: 'Epic Games', executable: process.execPath },
        { id: 'demo-5', title: 'Sea of Thieves', provider: 'Steam', appId: '1172620', executable: process.execPath },
        { id: 'demo-6', title: 'Senua’s Saga', provider: 'PC', executable: process.execPath }
      ], [{ id: 'launcher-steam', title: 'Steam', provider: 'Steam', executable: process.execPath, isApp: true, isLauncher: true }, { id: 'launcher-epic-games-launcher', title: 'Epic Games Launcher', provider: 'Epic Games', executable: process.execPath, isApp: true, isLauncher: true }]]
      : Promise.all([scanSteam(), scanEpic(), scanXboxGames(), scanPublisherShortcuts(), scanInstalledLaunchers()]),
    process.env.NEBULA_DEMO === '1' ? Promise.resolve({ games: [], status: 'disabled' }) : fetchOwnedSteamGames(settings),
    fetchOwnedEpicGames(settings)
  ]);
  const ownedByAppId = new Map(ownedResult.games.map((game) => [game.appId, game]));
  const installed = found.flat().map((game) => ({
    ...game,
    installed: true,
    steamPlaytimeMinutes: ownedByAppId.get(game.appId)?.steamPlaytimeMinutes || 0,
    steamOwned: Boolean(ownedByAppId.has(game.appId))
  }));
  const installedIds = new Set(installed.filter((game) => game.provider === 'Steam').map((game) => game.appId));
  const remoteGames = settings.showUninstalledSteam ? ownedResult.games.filter((game) => !installedIds.has(game.appId)).map((game) => ({ ...game, steamOwned: true })) : [];
  const installedEpicTitles = new Set(installed.filter(game => game.provider === 'Epic Games').map(game => normalizeTitle(game.title)));
  const remoteEpicGames = settings.showUninstalledEpic ? epicOwnedResult.games.filter(game => !installedEpicTitles.has(normalizeTitle(game.title))) : [];
  const merged = [...installed, ...remoteGames, ...remoteEpicGames, ...(settings.customGames || []).map((game) => ({ installed: true, ...game, isCustom: true }))];
  progress(28, `Found ${merged.length} library items. Checking game types…`);
  const byId = new Map();
  const seen = new Set();
  for (const game of merged) {
    const dedupeKey = `${normalizeTitle(game.title)}:${game.provider}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    byId.set(game.id, game);
  }
  const artwork = { ...(settings.artwork || {}) };
  const steamAppDetails = { ...(settings.steamAppDetails || {}) };
  const steamGames = [...byId.values()].filter((game) => game.provider === 'Steam' && game.appId);
  const detailsPending = steamGames.filter((game) => game.installed !== false).filter((game) => {
    const cached = steamAppDetails[game.appId];
    return !cached?.type || !Array.isArray(cached.categories) || (cached.checkedAt && Date.now() - cached.checkedAt > 30 * 24 * 60 * 60 * 1000);
  }).slice(0, 120);
  for (let index = 0; index < detailsPending.length; index += 80) {
    const groups = Array.from({ length: Math.min(4, Math.ceil((detailsPending.length - index) / 20)) }, (_, groupIndex) => detailsPending.slice(index + groupIndex * 20, index + (groupIndex + 1) * 20));
    await Promise.all(groups.map(async (batch) => {
      const details = await fetchSteamAppDetails(batch.map((game) => game.appId));
      for (const game of batch) {
        const fetched = details[game.appId];
        const localType = game.steamType || '';
        steamAppDetails[game.appId] = {
          ...(steamAppDetails[game.appId] || {}),
          ...(fetched || {}),
          type: fetched?.type || localType || steamAppDetails[game.appId]?.type || '',
          controls: fetched?.controls || steamAppDetails[game.appId]?.controls || 'unknown',
          categories: fetched?.categories || steamAppDetails[game.appId]?.categories || [],
          checkedAt: fetched?.type || localType ? Date.now() : 0
        };
      }
    }));
  }
  if (detailsPending.length) await writeSettings({ steamAppDetails });
  progress(42, 'Preparing your game artwork…');
  const playHistory = settings.playHistory || [];
  const historyRank = new Map(playHistory.map((id, index) => [id, index]));
  const visible = [...byId.values()]
    .filter((game) => !(settings.hiddenGameIds || []).includes(game.id))
    .sort((a, b) => {
      const aRank = historyRank.has(a.id) ? historyRank.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bRank = historyRank.has(b.id) ? historyRank.get(b.id) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.title.localeCompare(b.title);
    });

  const capabilitiesByGame = {};
  for (const game of visible.filter((item) => item.provider === 'Steam' && item.appId)) {
    capabilitiesByGame[game.id] = steamAppDetails[game.appId]?.controls || 'unknown';
  }
  currentLibrary = visible.map((game) => ({
    ...game,
    artwork: artwork[game.id] || null,
    steamType: game.provider === 'Steam' ? (steamAppDetails[game.appId]?.type || game.steamType || 'game') : null,
    steamCategories: game.provider === 'Steam' ? (steamAppDetails[game.appId]?.categories || []) : [],
    isApp: game.isLauncher || (typeof settings.gameCategoryOverrides?.[game.id] === 'boolean'
      ? settings.gameCategoryOverrides[game.id]
      : game.isCustom ? Boolean(game.isApp) : game.provider === 'Steam' && isSteamAppType(steamAppDetails[game.appId]?.type || game.steamType)),
    installed: game.installed !== false,
    steamPlaytimeMinutes: Number(game.steamPlaytimeMinutes) || 0,
    playCount: Number((settings.playCounts || {})[game.id] || 0),
    launchOptions: (settings.gameLaunchOptions || {})[game.id] || '',
    achievementReferenceAppId: (settings.achievementReferenceAppIds || {})[game.id] || '',
    xboxAchievementReference: (settings.xboxAchievementReferences || {})[game.id] || null,
    controls: capabilitiesByGame[game.id] || game.controls || artwork[game.id]?.controls || 'unknown'
  }));
  const librarySummary = { steamStatus: ownedResult.status, steamOwnedCount: ownedResult.count || 0, steamId64: ownedResult.steamId64 || '', showUninstalledSteam: settings.showUninstalledSteam === true, steamApiKeyConfigured: Boolean(settings.steamApiKey), epicStatus: epicOwnedResult.status, epicOwnedCount: epicOwnedResult.games.length, epicHelperPath: epicOwnedResult.helperPath, showUninstalledEpic: settings.showUninstalledEpic === true };
  if (scanEpoch === artworkScanEpoch) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:initial', { games: currentLibrary, ...librarySummary });
    await writeLibrarySnapshot({ games: currentLibrary, ...librarySummary }, scanEpoch).catch(() => {});
  }
  if (settings.steamApiKey) {
    fetchSteamCurrentPopularity(settings.steamApiKey).then(({ ranks, status }) => {
      if (scanEpoch !== artworkScanEpoch || !mainWindow || mainWindow.isDestroyed()) return;
      const libraryRanks = Object.fromEntries(currentLibrary.filter((game) => game.provider === 'Steam' && ranks.has(String(game.appId))).map((game) => [game.id, ranks.get(String(game.appId))]));
      mainWindow.webContents.send('library:trending', { ranks: libraryRanks, status });
    });
  }

  if ((settings.steamGridDbKey || visible.length) && (process.env.NEBULA_DEMO !== '1' || process.env.NEBULA_DEMO_ART === '1')) {
    const pending = visible.filter((game) => {
      if (game.isLauncher) return false;
      const cached = artwork[game.id];
      return !cached?.manual && (refreshArt || cached?.artworkVersion !== 6 || (cached?.imageSource === 'none' && Date.now() - (cached.lastAttemptedAt || 0) > 7 * 24 * 60 * 60 * 1000));
    }).sort((a, b) => (historyRank.has(a.id) ? historyRank.get(a.id) : Number.MAX_SAFE_INTEGER) - (historyRank.has(b.id) ? historyRank.get(b.id) : Number.MAX_SAFE_INTEGER)
      || Number(b.installed !== false) - Number(a.installed !== false)
      || (Number(b.steamPlaytimeMinutes) || 0) - (Number(a.steamPlaytimeMinutes) || 0)
      || a.title.localeCompare(b.title));
    for (let index = 0; index < pending.length; index += 3) {
      if (scanEpoch !== artworkScanEpoch) break;
      const batch = pending.slice(index, index + 3);
      await Promise.all(batch.map(async (game) => {
        try {
          const foundArtwork = await findArtwork(game.title, settings.steamGridDbKey, game.provider, false);
          const existingLogo = artwork[game.id]?.artworkVersion === 6
            ? (currentLibrary.find((item) => item.id === game.id)?.artwork?.logo || artwork[game.id]?.logo)
            : null;
          artwork[game.id] = { ...(foundArtwork || { artworkVersion: 6, imageSource: 'none' }), logo: foundArtwork?.logo || existingLogo || null, lastAttemptedAt: Date.now() };
        } catch (error) {
          artwork[game.id] = { ...(artwork[game.id] || {}), artworkVersion: 6, imageSource: artwork[game.id]?.imageSource || 'none', lastAttemptedAt: Date.now(), artworkError: error.message };
        }
      }));
      if (scanEpoch !== artworkScanEpoch) break;
      const changes = batch.map((game) => ({ id: game.id, artwork: artwork[game.id] }));
      for (const change of changes) {
        const current = currentLibrary.find((game) => game.id === change.id);
        if (current) { current.artwork = change.artwork; if (current.controls === 'unknown') current.controls = change.artwork?.controls || 'unknown'; }
      }
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:artwork', changes);
      progress(42 + Math.round(53 * Math.min(index + batch.length, pending.length) / Math.max(pending.length, 1)), `Artwork ${Math.min(index + batch.length, pending.length)} of ${pending.length}…`);
      if (index % 15 === 0) await writeSettings({ artwork });
    }
    if (scanEpoch === artworkScanEpoch) await writeSettings({ artwork });
  }

  if (scanEpoch === artworkScanEpoch && (process.env.NEBULA_DEMO !== '1' || process.env.NEBULA_DEMO_ART === '1')) {
    const toCache = currentLibrary.filter(game => game.artwork && !game.isLauncher);
    const cacheOne = async game => {
      const cached = await artworkCache.cacheArtwork(game.artwork);
      if (scanEpoch !== artworkScanEpoch) return;
      game.artwork = cached;
      artwork[game.id] = cached;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:artwork', [{ id: game.id, artwork: cached }]);
    };
    artworkCacheTask = (async () => {
      for (let index = 0; index < toCache.length && scanEpoch === artworkScanEpoch; index += 4) {
        await Promise.all(toCache.slice(index, index + 4).map(cacheOne));
        if (index % 40 === 0) progress(95 + Math.round(4 * index / Math.max(toCache.length, 1)), `Saving artwork for offline use…`);
      }
    })();
    await artworkCacheTask.catch(() => {});
    if (scanEpoch === artworkScanEpoch) await writeSettings({ artwork });
  }

  if (scanEpoch === artworkScanEpoch) await writeLibrarySnapshot({ games: currentLibrary, ...librarySummary }, scanEpoch).catch(() => {});
  progress(100, `${currentLibrary.length} library items ready`);
  return { games: currentLibrary, ...librarySummary };
}

function launchExecutable(filePath, args = '', cwd = path.dirname(filePath)) {
  const parsedArgs = Array.isArray(args)
    ? args.map(String)
    : args.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, '')) || [];
  return new Promise((resolve, reject) => {
    const child = spawn(filePath, parsedArgs, { detached: true, stdio: 'ignore', cwd, windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

function isAllowedArtworkUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'file:') {
      const local = path.resolve(fileURLToPath(url));
      return local.startsWith(`${path.resolve(path.dirname(settingsPath()), 'artwork-cache')}${path.sep}`);
    }
    return url.protocol === 'https:' && ['cdn2.steamgriddb.com', 'cdn.steamgriddb.com', 'cdn.akamai.steamstatic.com', 'shared.fastly.steamstatic.com', 'store-images.s-microsoft.com', 'images-eds.xboxlive.com', 'image.api.playstation.com', 'assets-prd.ignimgs.com'].includes(url.hostname);
  } catch {
    return false;
  }
}

async function fetchArtworkForSgdbGame(game, apiKey) {
  const [squares, verticals, wides, logos, heroes] = await Promise.all([
    fetchSgdbJson(`/grids/game/${game.id}?dimensions=512x512,1024x1024&types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/grids/game/${game.id}?dimensions=600x900,660x930,342x482&types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/grids/game/${game.id}?dimensions=460x215,920x430&types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/logos/game/${game.id}?types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/heroes/game/${game.id}?types=static&nsfw=false`, apiKey)
  ]);
  const logo = logos.find((asset) => asset.width / asset.height > 2.2) || logos[0];
  const choices = [...squares, ...verticals, ...wides].slice(0, 36).map((asset) => ({
    url: asset.url,
    width: Number(asset.width),
    height: Number(asset.height),
    tileIsSquare: Number(asset.width) === Number(asset.height)
  }));
  return {
    game: { id: game.id, name: game.name }, choices,
    heroChoices: heroes.slice(0, 30).map((asset) => ({ url: asset.url, width: Number(asset.width), height: Number(asset.height) })),
    logoChoices: logos.slice(0, 30).map((asset) => ({ url: asset.url, width: Number(asset.width), height: Number(asset.height) })),
    logo: logo?.url || null, hero: heroes[0]?.url || null
  };
}

async function searchArtwork(query, selectedGameId = '') {
  const settings = await readSettings();
  if (!settings.steamGridDbKey) throw new Error('Add a SteamGridDB API key in Settings first.');
  const matches = await fetchSgdbJson(`/search/autocomplete/${encodeURIComponent(query)}`, settings.steamGridDbKey);
  if (!matches.length) return { game: null, games: [], choices: [], heroChoices: [], logoChoices: [], logo: null, hero: null };
  const games = [...matches]
    .map((game) => ({ id: game.id, name: game.name, matchScore: titleMatchScore(query, game.name) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
  const game = games.find((candidate) => String(candidate.id) === String(selectedGameId)) || games[0];
  return { ...await fetchArtworkForSgdbGame(game, settings.steamGridDbKey), games };
}

function registerIpc() {
  ipcMain.handle('artwork:official-steam', async (_event, gameId, requestedAppId) => {
    const game = currentLibrary.find(item => item.id === gameId);
    if (!game) throw new Error('Import this game before choosing artwork.');
    const appId = String(requestedAppId || (game.provider === 'Steam' ? game.appId : '') || '').trim();
    if (!/^\d{1,10}$/.test(appId)) throw new Error('Enter the Steam App ID for the edition you want.');
    const base = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/`;
    const assets = [
      ['tile', 'library_600x900.jpg', 600, 900], ['tile', 'capsule_616x353.jpg', 616, 353],
      ['hero', 'library_hero.jpg', 3840, 1240], ['wide', 'header.jpg', 460, 215],
      ['wide', 'capsule_616x353.jpg', 616, 353], ['logo', 'logo.png', 0, 0]
    ];
    const available = await Promise.all(assets.map(async ([slot, file, width, height]) => {
      try {
        const url = base + file;
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(7000) });
        return response.ok && response.headers.get('content-type')?.startsWith('image/')
          ? { slot, url, width, height, tileIsSquare: false, source: 'Official Steam' } : null;
      } catch { return null; }
    }));
    return { appId, assets: available.filter(Boolean) };
  });
  ipcMain.handle('library:scan', (_event, options) => scanLibrary(options));
  ipcMain.handle('library:cached', () => readLibrarySnapshot());
  ipcMain.handle('settings:get', async () => {
    const settings = await readSettings();
    return { ...settings, steamId64: settings.steamId64 || await detectSteamId64() };
  });
  ipcMain.handle('steam:local-status', async () => {
    const [roots, steamId64, recentSteamId64, clientRunning] = await Promise.all([findSteamRoots(), detectSteamId64(), detectRecentSteamId64(), steamClientIsRunning()]);
    return { installed: roots.length > 0, accountDetected: Boolean(steamId64), steamId64, clientRunning, ready: clientRunning && Boolean(recentSteamId64) };
  });
  ipcMain.handle('steam:open-help', async (_event, destination) => {
    const urls = {
      privacy: 'https://steamcommunity.com/my/edit/settings',
      apiKey: 'https://steamcommunity.com/dev/apikey',
      sgdbApiKey: 'https://www.steamgriddb.com/profile/preferences/api',
      client: 'steam://open/games',
      xboxApiKey: 'https://xbl.io',
      epicHelper: 'https://github.com/legendary-gl/legendary#quickstart'
    };
    if (!urls[destination]) throw new Error('Unknown Steam help destination.');
    await shell.openExternal(urls[destination]);
    return true;
  });
  ipcMain.handle('achievements:open-trueachievements', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    await shell.openExternal(`https://www.trueachievements.com/searchresults.aspx?search=${encodeURIComponent(game.title)}`);
    return true;
  });
  ipcMain.handle('app:feedback', async () => { await shell.openExternal('https://github.com/ykyritsis/xbox-cloud-preview-on-pc/issues'); return true; });
  ipcMain.handle('app:fse-setup', async () => { await shell.openExternal('https://github.com/ashpynov/AnyFSE#readme'); return true; });
  ipcMain.handle('settings:save', async (_event, incoming) => {
    const existing = await readSettings();
    const allowed = {};
    if ('steamId64' in incoming) {
      const steamId64 = String(incoming.steamId64 || '').trim();
      if (steamId64 && !/^\d{17}$/.test(steamId64)) throw new Error('SteamID64 must be exactly 17 digits.');
      allowed.steamId64 = steamId64;
    }
    if ('steamGridDbKey' in incoming) allowed.steamGridDbKey = String(incoming.steamGridDbKey || '').trim();
    if ('steamApiKey' in incoming) allowed.steamApiKey = String(incoming.steamApiKey || '').trim();
    if ('xboxApiKey' in incoming) allowed.xboxApiKey = String(incoming.xboxApiKey || '').trim();
    const effectiveSteamApiKey = 'steamApiKey' in incoming ? allowed.steamApiKey : existing.steamApiKey;
    if ('showUninstalledSteam' in incoming) allowed.showUninstalledSteam = Boolean(incoming.showUninstalledSteam && effectiveSteamApiKey);
    if ('steamApiKey' in incoming && !effectiveSteamApiKey) allowed.showUninstalledSteam = false;
    if ('legendaryPath' in incoming) {
      const helper = String(incoming.legendaryPath || '').trim();
      if (helper && (path.basename(helper).toLowerCase() !== 'legendary.exe' || !await exists(helper))) throw new Error('Choose a valid Legendary executable.');
      allowed.legendaryPath = helper;
    }
    if ('showUninstalledEpic' in incoming) {
      const helper = await findLegendaryExecutable(allowed.legendaryPath ?? existing.legendaryPath);
      allowed.showUninstalledEpic = Boolean(incoming.showUninstalledEpic && helper);
    }
    if ('fullscreen' in incoming) allowed.fullscreen = Boolean(incoming.fullscreen);
    if ('soundEffects' in incoming) allowed.soundEffects = incoming.soundEffects !== false;
    if (typeof incoming.onboardingComplete === 'boolean') allowed.onboardingComplete = incoming.onboardingComplete;
    if (typeof incoming.avatarId === 'string') allowed.avatarId = incoming.avatarId.slice(0, 40);
    if (typeof incoming.avatarImage === 'string') {
      const image = incoming.avatarImage.trim();
      if (image.length > 1_000_000 || (image && !/^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(image))) throw new Error('Choose a PNG, JPEG, or WebP image under 750 KB after cropping.');
      allowed.avatarImage = image;
    }
    if ('steamBannerDismissed' in incoming) allowed.steamBannerDismissed = Boolean(incoming.steamBannerDismissed);
    if (typeof incoming.displayName === 'string') allowed.displayName = incoming.displayName.trim().slice(0, 32) || 'Player';
    if ('uiScale' in incoming) {
      allowed.uiScale = Math.max(0.65, Math.min(1.5, Number(incoming.uiScale) || SETTINGS_DEFAULTS.uiScale));
      allowed.uiScaleCustomized = true;
    }
    if ('tileRadius' in incoming) allowed.tileRadius = Math.max(0, Math.min(24, Number(incoming.tileRadius) || 0));
    if ('reducedMotion' in incoming) allowed.reducedMotion = Boolean(incoming.reducedMotion);
    if ('useRandomScreenshotBackground' in incoming) allowed.useRandomScreenshotBackground = Boolean(incoming.useRandomScreenshotBackground);
    if ('shuffleHomeScreenshots' in incoming) allowed.shuffleHomeScreenshots = Boolean(incoming.shuffleHomeScreenshots);
    const saved = await writeSettings(allowed);
    if ('xboxApiKey' in incoming && allowed.xboxApiKey !== existing.xboxApiKey) {
      xboxTitleHistoryCache = { at: 0, apiKey: '', xuid: '', titles: [] };
      xboxAchievementCache.clear();
    }
    if (mainWindow) {
      mainWindow.setFullScreen(saved.fullscreen);
      mainWindow.webContents.setZoomFactor(saved.uiScale || 1);
    }
    return saved;
  });
  ipcMain.handle('settings:preview-scale', (_event, value) => {
    const scale = Math.max(0.65, Math.min(1.5, Number(value) || SETTINGS_DEFAULTS.uiScale));
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.setZoomFactor(scale);
    return scale;
  });
  ipcMain.handle('epic:choose-helper', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose Legendary.exe', properties: ['openFile'], filters: [{ name: 'Legendary', extensions: ['exe'] }] });
    const selected = result.filePaths?.[0] || '';
    if (!selected) return '';
    if (path.basename(selected).toLowerCase() !== 'legendary.exe') throw new Error('Choose legendary.exe.');
    return selected;
  });
  ipcMain.handle('epic:helper-status', async (_event, configuredPath) => {
    const helperPath = await findLegendaryExecutable(String(configuredPath || ''));
    return { available: Boolean(helperPath), helperPath };
  });
  ipcMain.handle('settings:clear-custom-artwork', async () => {
    artworkScanEpoch++;
    const settings = await readSettings();
    const artwork = Object.fromEntries(Object.entries(settings.artwork || {}).filter(([, entry]) => !entry?.manual));
    await writeSettings({ artwork }, { replaceArtwork: true });
    gameDetailCache.clear();
    return Object.keys(settings.artwork || {}).length - Object.keys(artwork).length;
  });
  ipcMain.handle('settings:reset-all', async () => {
    artworkScanEpoch++;
    await artworkCacheTask.catch(() => {});
    await librarySnapshotWriteQueue;
    await fs.rm(librarySnapshotPath(), { force: true });
    await fs.rm(`${librarySnapshotPath()}.tmp`, { force: true });
    const cacheDirectory = path.resolve(path.dirname(settingsPath()), 'artwork-cache');
    if (path.dirname(cacheDirectory) !== path.resolve(path.dirname(settingsPath()))) throw new Error('Invalid artwork cache path.');
    await fs.rm(cacheDirectory, { recursive: true, force: true });
    await replaceSettings({ ...SETTINGS_DEFAULTS });
    currentLibrary = [];
    gameDetailCache.clear();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(SETTINGS_DEFAULTS.fullscreen);
      mainWindow.webContents.setZoomFactor(SETTINGS_DEFAULTS.uiScale);
    }
    return true;
  });
  ipcMain.handle('game:launch', async (_event, gameId, launchOptions) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    if (!game.installed) throw new Error('This game is not installed. Choose Download with Steam first.');
    const optionText = String(launchOptions ?? game.launchOptions ?? '').trim();
    if (optionText.length > 512 || /[\r\n\0]/.test(optionText)) throw new Error('Steam launch options must be a single line under 512 characters.');
    const parsedOptions = optionText.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, '')) || [];
    if (game.launchUri && game.provider === 'Steam' && game.appId && game.steamExecutable && await exists(game.steamExecutable)) {
      try {
        await launchExecutable(game.steamExecutable, ['-silent', '-applaunch', game.appId, ...parsedOptions], path.dirname(game.steamExecutable));
      } catch {
        const target = parsedOptions.length ? `steam://run/${encodeURIComponent(game.appId)}//${encodeURIComponent(optionText)}` : game.launchUri;
        await shell.openExternal(target);
      }
    } else if (game.launchUri) {
      const target = game.provider === 'Steam' && parsedOptions.length
        ? `steam://run/${encodeURIComponent(game.appId)}//${encodeURIComponent(optionText)}`
        : game.launchUri;
      await shell.openExternal(target);
    }
    else if (game.shortcutPath) {
      const error = await shell.openPath(game.shortcutPath);
      if (error) throw new Error(error);
    }
    else if (game.executable && await exists(game.executable)) await launchExecutable(game.executable, game.args);
    else throw new Error('The game executable could not be found.');
    const settings = await readSettings();
    const playHistory = [gameId, ...(settings.playHistory || []).filter((id) => id !== gameId)].slice(0, 40);
    const playCounts = { ...(settings.playCounts || {}), [gameId]: Number(settings.playCounts?.[gameId] || 0) + 1 };
    await writeSettings({ playHistory, playCounts });
    return true;
  });
  ipcMain.handle('launcher:steam-big-picture', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game?.isLauncher || game.title !== 'Steam' || !game.executable || !await exists(game.executable)) throw new Error('Steam launcher was not found.');
    await launchExecutable(game.executable, ['-bigpicture'], path.dirname(game.executable));
    return true;
  });
  ipcMain.handle('game:action', async (_event, gameId, action) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    if (action === 'download' && game.provider === 'Steam' && game.appId && !game.installed) {
      await shell.openExternal(`steam://install/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'download' && game.provider === 'Epic Games' && game.epicOwned && !game.installed) {
      const launcher = currentLibrary.find(item => item.isLauncher && item.provider === 'Epic Games' && item.executable);
      if (!launcher || !await exists(launcher.executable)) throw new Error('Install this game from the Epic Games Launcher. The launcher was not found on this PC.');
      await launchExecutable(launcher.executable, [], path.dirname(launcher.executable));
      return true;
    }
    if (action === 'uninstall-steam' && game.provider === 'Steam' && game.appId && game.installed) {
      await shell.openExternal(`steam://uninstall/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'view-steam' && game.provider === 'Steam' && game.appId) {
      await shell.openExternal(`steam://store/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'view-steam-library' && game.provider === 'Steam' && game.appId) {
      await shell.openExternal(`steam://nav/games/details/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'open-steamdb' && game.provider === 'Steam' && game.appId) {
      await shell.openExternal(`https://steamdb.info/app/${encodeURIComponent(game.appId)}/`);
      return true;
    }
    if (action === 'open-folder') {
      const folder = game.installPath || (game.executable ? path.dirname(game.executable) : null);
      if (!folder || !await exists(folder)) throw new Error('The install folder could not be found.');
      const result = await shell.openPath(folder);
      if (result) throw new Error(result);
      return true;
    }
    throw new Error('That action is not available for this game.');
  });
  ipcMain.handle('game:category:save', async (_event, gameId, isApp) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game || game.isLauncher) throw new Error('This item cannot be moved between Games and Apps.');
    const settings = await readSettings();
    await writeSettings({ gameCategoryOverrides: { ...(settings.gameCategoryOverrides || {}), [gameId]: Boolean(isApp) } });
    game.isApp = Boolean(isApp);
    return true;
  });
  ipcMain.handle('game:launch-options:save', async (_event, gameId, incoming) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game || game.provider !== 'Steam' || !game.appId) throw new Error('Steam launch options are only available for Steam games.');
    const value = String(incoming || '').trim();
    if (value.length > 512 || /[\r\n\0]/.test(value)) throw new Error('Launch options must be a single line under 512 characters.');
    const settings = await readSettings();
    const gameLaunchOptions = { ...(settings.gameLaunchOptions || {}), [gameId]: value };
    await writeSettings({ gameLaunchOptions });
    game.launchOptions = value;
    return true;
  });
  ipcMain.handle('artwork:search', (_event, query, gameId) => searchArtwork(String(query || '').trim(), String(gameId || '')));
  ipcMain.handle('artwork:catalog-choices', async (_event, title, source) => {
    const query = String(title || '').trim().slice(0, 160);
    if (!query || !['xbox', 'psn', 'ign'].includes(source)) return [];
    const artwork = source === 'xbox' ? await fetchXboxCatalogArtwork(query) : source === 'psn' ? await fetchPsnSquareArtwork(query) : await fetchIgnSquareArtwork(query);
    if (!artwork) return [];
    return [['tile', artwork.tile, true], ['hero', artwork.hero, false], ['wide', artwork.wide, false], ['logo', artwork.logo, false]]
      .filter(([, url]) => isAllowedArtworkUrl(url))
      .map(([slot, url, tileIsSquare]) => ({ slot, url, tileIsSquare, source: artwork.imageSource }));
  });
  ipcMain.handle('artwork:logo', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) return null;
    if (isAllowedArtworkUrl(game.artwork?.logo)) return game.artwork.logo;
    const settings = await readSettings();
    if (!settings.steamGridDbKey) return null;
    try {
      const sgdbId = game.artwork?.sgdbGameId;
      const result = sgdbId
        ? await fetchArtworkForSgdbGame({ id: sgdbId, name: game.title }, settings.steamGridDbKey)
        : await searchArtwork(game.title);
      if (!isAllowedArtworkUrl(result.logo)) return null;
      const nextArt = await artworkCache.cacheArtwork({ ...(game.artwork || {}), logo: result.logo, sgdbGameId: result.game?.id || sgdbId });
      game.artwork = nextArt;
      await writeSettings({ artwork: { ...(settings.artwork || {}), [game.id]: nextArt } });
      return nextArt.logo;
    } catch { return null; }
  });
  ipcMain.handle('news:get', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game || game.provider !== 'Steam' || !game.appId) return [];
    return fetchSteamNews(game.appId);
  });
  ipcMain.handle('game:details', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    return fetchGameDetails(game);
  });
  ipcMain.handle('steam:discovery', () => fetchSteamDiscovery());
  ipcMain.handle('steam:discovery-details', async (_event, appId) => {
    if (!/^\d{1,10}$/.test(String(appId))) throw new Error('Invalid Steam app ID.');
    const listings = await fetchSteamDiscovery();
    const game = [...listings.mostPlayed, ...listings.topSellers, ...listings.upcoming].find(item => item.appId === String(appId));
    if (!game) throw new Error('This game is no longer in a discovery list.');
    return fetchGameDetails(game);
  });
  ipcMain.handle('steam:open-store', async (_event, appId) => {
    if (!/^\d{1,10}$/.test(String(appId))) throw new Error('Invalid Steam app ID.');
    await shell.openExternal(`https://store.steampowered.com/app/${appId}/`);
    return true;
  });
  ipcMain.handle('game:owned-dlc', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    return fetchOwnedDlc(game);
  });
  ipcMain.handle('game:achievements', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    return fetchGameAchievements(game);
  });
  ipcMain.handle('game:achievement-reference:save', async (_event, gameId, value) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    const appId = String(value || '').trim();
    if (appId && !/^\d{1,10}$/.test(appId)) throw new Error('Enter a numeric Steam App ID.');
    const settings = await readSettings();
    const achievementReferenceAppIds = { ...(settings.achievementReferenceAppIds || {}) };
    if (appId) achievementReferenceAppIds[gameId] = appId;
    else delete achievementReferenceAppIds[gameId];
    await writeSettings({ achievementReferenceAppIds });
    game.achievementReferenceAppId = appId;
    gameDetailCache.delete(gameId);
    return appId;
  });
  ipcMain.handle('game:xbox-achievement-reference:save', async (_event, gameId, incoming) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    const titleId = String(incoming?.titleId || '').trim();
    const platform = String(incoming?.platform || 'auto').trim();
    if (titleId && !/^\d{1,12}$/.test(titleId)) throw new Error('Xbox Title ID must be numeric.');
    if (!['auto', 'xbox360', 'xbox'].includes(platform)) throw new Error('Choose an Xbox platform.');
    const settings = await readSettings();
    const xboxAchievementReferences = { ...(settings.xboxAchievementReferences || {}) };
    if (titleId) xboxAchievementReferences[gameId] = { titleId, platform };
    else delete xboxAchievementReferences[gameId];
    await writeSettings({ xboxAchievementReferences });
    game.xboxAchievementReference = titleId ? { titleId, platform } : null;
    gameDetailCache.delete(gameId);
    xboxAchievementCache.clear();
    return game.xboxAchievementReference;
  });
  ipcMain.handle('artwork:save', async (_event, gameId, selection) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    if (!selection || typeof selection !== 'object') throw new Error('Choose artwork first.');
    for (const field of ['tile', 'hero', 'logo', 'wide']) {
      if (selection[field] != null && !isAllowedArtworkUrl(selection[field])) throw new Error(`Unsupported ${field} artwork source.`);
    }
    const settings = await readSettings();
    const previous = settings.artwork?.[gameId] || {};
    const nextArtwork = await artworkCache.cacheArtwork({
      ...previous,
      tile: selection.tile || previous.tile || null,
      grid: selection.tile || previous.grid || previous.tile || null,
      tileIsSquare: selection.tileIsSquare == null ? Boolean(previous.tileIsSquare) : Boolean(selection.tileIsSquare),
      overlayLogo: selection.overlayLogo == null ? previous.overlayLogo === true : Boolean(selection.overlayLogo),
      logo: selection.logo || previous.logo || null,
      hero: selection.hero || previous.hero || selection.tile || previous.tile || null,
      wide: selection.wide || previous.wide || null,
      sgdbGameId: selection.sgdbGameId || previous.sgdbGameId || null,
      imageSource: ['playstation-store', 'ign', 'xbox-catalog', 'official-steam', 'steamgriddb-manual'].includes(selection.imageSource) ? selection.imageSource : 'steamgriddb-manual',
      artworkVersion: 3,
      manual: true
    });
    await writeSettings({ artwork: { ...(settings.artwork || {}), [gameId]: nextArtwork } });
    game.artwork = nextArtwork;
    return nextArtwork;
  });
  ipcMain.handle('artwork:refresh-one', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    const settings = await readSettings();
    const fresh = await artworkCache.cacheArtwork({ ...(await findArtwork(game.title, settings.steamGridDbKey, game.provider, game.installed !== false)), lastAttemptedAt: Date.now() });
    if (!fresh.tile && !fresh.hero) throw new Error('No matching artwork found from PlayStation, IGN, Xbox, or SteamGridDB.');
    game.artwork = fresh;
    if (game.controls === 'unknown') game.controls = fresh.controls || 'unknown';
    await writeSettings({ artwork: { ...(settings.artwork || {}), [gameId]: fresh } });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:artwork', [{ id: gameId, artwork: fresh }]);
    return fresh;
  });
  ipcMain.handle('news:open', async (_event, url) => {
    const target = new URL(String(url));
    if (target.protocol !== 'https:' || !['store.steampowered.com', 'steamcommunity.com'].includes(target.hostname)) throw new Error('Unsupported news link.');
    await shell.openExternal(target.toString());
    return true;
  });
  ipcMain.handle('game:add', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add a game',
      properties: ['openFile'],
      filters: [{ name: 'Windows applications', extensions: ['exe', 'bat', 'cmd'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const executable = result.filePaths[0];
    const customGame = {
      id: `custom-${Buffer.from(executable.toLowerCase()).toString('base64url')}`,
      title: path.basename(executable, path.extname(executable)),
      provider: 'PC',
      installPath: path.dirname(executable),
      executable,
      args: '',
      isApp: false
    };
    return { ...customGame, isCustom: true };
  });
  ipcMain.handle('game:bulk-add', async () => {
    const picked = await dialog.showOpenDialog(mainWindow, { title: 'Import games from a folder', properties: ['openDirectory'] });
    if (picked.canceled || !picked.filePaths[0]) return { added: 0, canceled: true };
    const root = picked.filePaths[0];
    const queue = [{ directory: root, depth: 0, gameTitle: '' }];
    const candidates = new Map();
    const ignored = /(unins|uninstall|setup|install|update|crash|report|redistributable|prereq|anticheat|launcherupdater)/i;
    let visited = 0;
    while (queue.length && visited < 800 && candidates.size < 300) {
      const { directory, depth, gameTitle } = queue.shift();
      visited++;
      let entries = [];
      try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { continue; }
      const launchers = entries.filter((entry) => entry.isFile() && /\.exe$/i.test(entry.name) && !ignored.test(entry.name));
      if (launchers.length) {
        const preferred = launchers.find((entry) => normalizeTitle(entry.name).includes(normalizeTitle(path.basename(directory)))) || launchers[0];
        const title = gameTitle || path.parse(preferred.name).name;
        if (!candidates.has(title)) candidates.set(title, { executable: path.join(directory, preferred.name), title });
      }
      if (depth < 4) for (const entry of entries) {
        if (entry.isDirectory() && !/(redist|support|prereq|directx|vcredist)/i.test(entry.name)) queue.push({ directory: path.join(directory, entry.name), depth: depth + 1, gameTitle: gameTitle || entry.name });
      }
      if (visited % 20 === 0 && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:progress', { percent: Math.min(25, Math.round(visited / 800 * 25)), message: `Searching folders… ${visited} checked` });
    }
    const settings = await readSettings();
    const customGames = [...(settings.customGames || [])];
    const known = new Set(customGames.map((game) => String(game.executable).toLowerCase()));
    let added = 0;
    for (const candidate of candidates.values()) {
      if (known.has(candidate.executable.toLowerCase())) continue;
      const id = `custom-${Buffer.from(candidate.executable.toLowerCase()).toString('base64url')}`;
      customGames.push({ id, title: candidate.title, provider: 'PC', installPath: path.dirname(candidate.executable), executable: candidate.executable, args: '', isCustom: true, isApp: false });
      known.add(candidate.executable.toLowerCase());
      added++;
    }
    await writeSettings({ customGames });
    return { added, scanned: visited, truncated: queue.length > 0 || candidates.size >= 300 };
  });
  ipcMain.handle('game:custom:save', async (_event, incoming) => {
    const title = String(incoming?.title || '').trim();
    if (!title || title.length > 160 || /[\r\n\0]/.test(title)) throw new Error('Enter a game name under 160 characters.');
    const executable = String(incoming?.executable || '');
    if (!/\.(exe|bat|cmd)$/i.test(executable) || !await exists(executable)) throw new Error('Choose an existing Windows executable.');
    const id = `custom-${Buffer.from(executable.toLowerCase()).toString('base64url')}`;
    if (incoming.id && incoming.id !== id) throw new Error('The custom game executable cannot be changed here.');
    artworkScanEpoch++;
    const settings = await readSettings();
    const previous = (settings.customGames || []).find((item) => item.id === id);
    const customGame = { ...previous, id, title, provider: 'PC', installPath: path.dirname(executable), executable, args: previous?.args || '', isCustom: true, isApp: Boolean(incoming.isApp) };
    const customGames = [...(settings.customGames || []).filter((item) => item.id !== id), customGame];
    let artwork = settings.artwork || {};
    const selection = incoming.artwork;
    if (selection && !isAllowedArtworkUrl(selection.url)) throw new Error('The selected artwork URL is not supported. Choose another image.');
    if (selection) {
      artwork = { ...artwork, [id]: {
        ...(artwork[id] || {}), tile: selection.url, grid: selection.url,
        tileIsSquare: Boolean(selection.tileIsSquare), overlayLogo: Boolean(selection.overlayLogo),
        logo: isAllowedArtworkUrl(selection.logo) ? selection.logo : artwork[id]?.logo || null,
        hero: isAllowedArtworkUrl(selection.hero) ? selection.hero : selection.url,
        wide: isAllowedArtworkUrl(selection.wide) ? selection.wide : artwork[id]?.wide || null,
        sgdbGameId: selection.sgdbGameId || null, imageSource: 'steamgriddb-manual', artworkVersion: 3, manual: true
      } };
    }
    await writeSettings({ customGames, artwork });
    gameDetailCache.delete(id);
    return customGame;
  });
  ipcMain.handle('app:minimize-to-taskbar', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return true;
  });
  ipcMain.handle('app:quit', () => app.quit());
}

async function createWindow() {
  const settings = await readSettings();
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1024,
    minHeight: 650,
    backgroundColor: '#080b0e',
    autoHideMenuBar: true,
    frame: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    fullscreen: settings.fullscreen,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
      offscreen: Boolean(process.env.NEBULA_CAPTURE_SET || process.env.NEBULA_REVIEW)
    }
  });
  mainWindow.once('ready-to-show', () => {
    if (!process.env.NEBULA_CAPTURE && !process.env.NEBULA_CAPTURE_SET && !process.env.NEBULA_REVIEW) mainWindow.show();
  });
  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.setZoomFactor(settings.uiScale || 1);
  if (process.env.NEBULA_CAPTURE_SET && process.env.NEBULA_DEMO === '1') {
    setTimeout(async () => {
      const output = process.env.NEBULA_CAPTURE_SET;
      await fs.mkdir(output, { recursive: true });
      for (const [name, script] of [['home', "showView('home')"], ['library', "showView('library')"], ['game-details', "openGameDetails('demo-1')"]]) {
        await mainWindow.webContents.executeJavaScript(script);
        await new Promise((resolve) => setTimeout(resolve, name === 'game-details' ? 6000 : 1300));
        console.log('Demo capture', name, await mainWindow.webContents.executeJavaScript('({view:state.view,home:homeView.hidden,library:libraryView.hidden,detail:gameDetailView.hidden})'));
        await fs.writeFile(path.join(output, `${name}.png`), (await mainWindow.webContents.capturePage()).toPNG());
      }
      if (process.env.NEBULA_SMOKE_IMPORT === '1') {
        const executable = process.execPath;
        const id = `custom-${Buffer.from(executable.toLowerCase()).toString('base64url')}`;
        const result = await mainWindow.webContents.executeJavaScript(`(async () => {
          const before = await window.launcher.getSettings();
          const url = before.artwork['demo-1']?.tile;
          if (!url) throw new Error('Demo artwork was not ready for the import test.');
          await window.launcher.saveCustomGame({ id: ${JSON.stringify(id)}, executable: ${JSON.stringify(executable)}, title: 'Import artwork smoke test', isApp: true, artwork: { url, tileIsSquare: true, overlayLogo: false } });
          const saved = await window.launcher.getSettings();
          const imported = saved.customGames.some(game => game.id === ${JSON.stringify(id)} && game.isApp);
          const artworkSaved = saved.artwork[${JSON.stringify(id)}]?.tile === url;
          const cleared = await window.launcher.clearCustomArtwork();
          const afterClear = await window.launcher.getSettings();
          const artworkCleared = !afterClear.artwork[${JSON.stringify(id)}];
          await window.launcher.resetLauncherData();
          const afterReset = await window.launcher.getSettings();
          return { imported, artworkSaved, cleared, artworkCleared, reset: !afterReset.onboardingComplete && afterReset.customGames.length === 0 && Object.keys(afterReset.artwork).length === 0 };
        })()`);
        console.log('Import artwork smoke test', result);
      }
      app.quit();
    }, Number(process.env.NEBULA_CAPTURE_DELAY || 20000));
  }
  if (process.env.NEBULA_CAPTURE) {
    setTimeout(async () => {
      if (process.env.NEBULA_CAPTURE_VIEW === 'library') await mainWindow.webContents.executeJavaScript("showView('library')");
      if (process.env.NEBULA_CAPTURE_VIEW === 'detail') await mainWindow.webContents.executeJavaScript("openGameDetails('demo-1')");
      if (process.env.NEBULA_CAPTURE_VIEW) await new Promise((resolve) => setTimeout(resolve, 1800));
      const image = await mainWindow.webContents.capturePage();
      await fs.writeFile(process.env.NEBULA_CAPTURE, image.toPNG());
      app.quit();
    }, Number(process.env.NEBULA_CAPTURE_DELAY || 1800));
  }
}

app.whenReady().then(async () => {
  registerIpc();
  if (process.env.NEBULA_SGDB_KEY) {
    const saved = await readSettings();
    if (!saved.steamGridDbKey) await writeSettings({ steamGridDbKey: process.env.NEBULA_SGDB_KEY });
  }
  await createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
