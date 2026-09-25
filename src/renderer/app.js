const state = {
  games: [],
  favoriteGameIds: [],
  customCollections: [],
  activeGameSession: null,
  selectedGameId: null,
  focusIndex: 0,
  focusables: [],
  previousButtons: [],
  lastAxisMove: 0,
  view: 'home',
  libraryTab: 'my-games',
  libraryCategory: 'games',
  ambientKey: '',
  homeAmbientRequestToken: 0,
  homeScreenshotCache: new Map(),
  lastHomeScreenshotByGame: new Map(),
  shuffleHomeScreenshots: true,
  optionsGameId: null,
  artworkGameId: null,
  artworkSearch: null,
  artworkChoice: null,
  artworkDraft: null,
  artworkSlot: 'tile',
  catalogArtwork: [],
  focusedElement: null,
  randomGameIds: [],
  trendingRanks: {},
  trendingStatus: 'needs-api-key',
  steamDiscovery: { mostPlayed: [], topSellers: [], upcoming: [], status: 'loading' },
  steamDiscoveryArtworkUpdates: new Map(),
  steamApiKeyConfigured: false,
  soundEffects: true,
  gamepadIndex: null,
  lastNotifiedGamepadIndex: null,
  steamStatus: 'disabled',
  steamBannerDismissed: false,
  steamLocalStatus: null,
  fullScreenImport: false,
  searchQuery: '',
  newsRequestToken: 0,
  newsPendingGameId: null,
  newsCache: new Map(),
  customDraft: null,
  customArtworkSearch: null,
  customArtworkChoice: null,
  resetKind: null,
  keyboardTarget: null,
  controllerClick: false,
  previousView: 'home',
  detailGameId: null,
  detailRequestToken: 0,
  detailBackdropLayer: 0,
  lastDetailScreenshotByGame: new Map(),
  useRandomScreenshotBackground: true,
  onboardingStep: 0,
  profileOriginal: null,
  displayName: 'Player',
  keyboardShift: false,
  galleryImages: [],
  galleryIndex: 0,
  librarySort: 'recent',
  installFilter: 'all',
  sourceFilter: 'all',
  steamOwnedCount: 0,
  steamId64: '',
  showUninstalledSteam: false,
  showUninstalledEpic: false,
  epicStatus: 'needs-helper',
  epicHelperPath: '',
  achievementItems: [],
  achievementFilter: 'all',
  achievementsExpanded: false,
  achievementProgressAvailable: false,
  settingsOriginal: { uiScale: 1, tileRadius: 8, reducedMotion: false, textScale: 1, highContrastFocus: false, steamGridDbKey: '' },
  settingsSaved: false
};

function topmostOpenDialog() {
  const focusedDialog = document.activeElement?.closest('dialog[open]');
  if (focusedDialog) return focusedDialog;
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  return dialogs[dialogs.length - 1] || null;
}

function navigateBack() {
  if (!launchOverlay.hidden) return;
  playUiSound('back');
  const modal = topmostOpenDialog();
  if (modal) {
    if (modal === onboardingDialog) { if (state.onboardingStep > 0) showOnboardingStep(state.onboardingStep - 1); }
    else if (modal === powerDialog && !powerConfirm.hidden) showPowerChoices();
    else modal.close();
    return;
  }
  if (!searchPopover.hidden) { searchPopover.hidden = true; setFocusedElement(document.querySelector('[data-action="toggle-search"]')); }
  else if (!navPanel.hidden) closeNav();
  else if (state.view === 'detail') showView(state.previousView);
  else if (state.view === 'library') showView('home');
}

const ambient = document.querySelector('#ambient');
const heroTitle = document.querySelector('#hero-title');
const heroSubtitle = document.querySelector('#hero-subtitle');
const heroProvider = document.querySelector('#hero-provider');
const heroPlay = document.querySelector('#hero-play');
const recentRow = document.querySelector('#recent-row');
const newsShelf = document.querySelector('#news-shelf');
const newsRow = document.querySelector('#news-row');
const newsSubtitle = document.querySelector('#news-subtitle');
const logoRequested = new Set();
const homeCollections = document.querySelector('#home-collections');
const favoritesShelf = document.querySelector('#favorites-shelf');
const favoritesRow = document.querySelector('#favorites-row');
const steamDiscoveryRows = { mostPlayed: document.querySelector('#steam-players-row'), topSellers: document.querySelector('#steam-sellers-row'), upcoming: document.querySelector('#steam-upcoming-row') };
const trendingShelf = document.querySelector('#trending-shelf');
const trendingRow = document.querySelector('#trending-row');
const trendingNote = document.querySelector('#trending-note');
const mostPlayedShelf = document.querySelector('#most-played-shelf');
const mostPlayedRow = document.querySelector('#most-played-row');
const recentlyUpdatedRow = document.querySelector('#recently-updated-row');
const randomRow = document.querySelector('#random-row');
const recentlyPlayedShelf = document.querySelector('#recently-played-shelf');
const recentlyPlayedRow = document.querySelector('#recently-played-row');
const homeView = document.querySelector('#home-view');
const controllerPrompts = document.querySelector('#controller-prompts');
const promptA = document.querySelector('#prompt-a');
const promptB = document.querySelector('#prompt-b');
const promptX = document.querySelector('#prompt-x');
const promptY = document.querySelector('#prompt-y');
const promptMenu = document.querySelector('#prompt-menu');
const controllerReadyShelf = document.querySelector('#controller-ready-shelf');
const controllerReadyRow = document.querySelector('#controller-ready-row');
const multiplayerShelf = document.querySelector('#multiplayer-shelf');
const multiplayerRow = document.querySelector('#multiplayer-row');
const singlePlayerShelf = document.querySelector('#single-player-shelf');
const singlePlayerRow = document.querySelector('#single-player-row');
const libraryView = document.querySelector('#library-view');
const libraryGrid = document.querySelector('#library-grid');
const libraryCount = document.querySelector('#library-count');
const navPanel = document.querySelector('#nav-panel');
const brandButton = document.querySelector('.brand');
const emptyState = document.querySelector('#empty-state');
const settingsDialog = document.querySelector('#settings-dialog');
const collectionsDialog = document.querySelector('#collections-dialog');
const jumpLogo = document.querySelector('#jump-logo');
const toast = document.querySelector('#toast');
const controllerStatusDialog = document.querySelector('#controller-status-dialog');
const powerDialog = document.querySelector('#power-dialog');
const powerChoices = document.querySelector('#power-choices');
const powerConfirm = document.querySelector('#power-confirm');
let selectedPowerAction = null;
let powerActionPending = false;
const achievementDialog = document.querySelector('#achievement-dialog');
const ambientNext = document.querySelector('#ambient-next');
const gameOptionsDialog = document.querySelector('#game-options-dialog');
const steamLaunchDialog = document.querySelector('#steam-launch-dialog');
const artworkDialog = document.querySelector('#artwork-dialog');
const artworkResults = document.querySelector('#artwork-results');
const artworkGames = document.querySelector('#artwork-games');
const artworkStatus = document.querySelector('#artwork-status');
const artworkQuery = document.querySelector('#artwork-query');
const useArtwork = document.querySelector('#use-artwork');
const launchOverlay = document.querySelector('#launch-overlay');
const launchArt = document.querySelector('#launch-art');
const launchingGame = document.querySelector('#launching-game');
const launchGameLogo = document.querySelector('#launch-game-logo');
const librarySearch = document.querySelector('#library-search');
const detailLogo = document.querySelector('#detail-logo');
const detailTitle = document.querySelector('#detail-title');
const galleryDialog = document.querySelector('#gallery-dialog');
const galleryImage = document.querySelector('#gallery-image');
const galleryBackdrop = document.querySelector('#gallery-backdrop');
const galleryTitle = document.querySelector('#gallery-title');
const galleryThumbnails = document.querySelector('#gallery-thumbnails');
const gameDetailView = document.querySelector('#game-detail-view');
const searchPopover = document.querySelector('#search-popover');
const customGameDialog = document.querySelector('#custom-game-dialog');
const customGameName = document.querySelector('#custom-game-name');
const customArtworkQueryLabel = document.querySelector('#custom-artwork-query-label');
const resetConfirmDialog = document.querySelector('#reset-confirm-dialog');
const customArtworkGames = document.querySelector('#custom-artwork-games');
const customArtworkResults = document.querySelector('#custom-artwork-results');
const customArtworkStatus = document.querySelector('#custom-artwork-status');
const keyboardDialog = document.querySelector('#controller-keyboard-dialog');
const newsPreviewDialog = document.querySelector('#news-preview-dialog');
const keyboardKeys = document.querySelector('#keyboard-keys');
const keyboardPreview = document.querySelector('#keyboard-preview');
let visibleAmbient = ambient;
let audioContext = null;
const avatarDialog = document.querySelector('#avatar-dialog');
const onboardingDialog = document.querySelector('#onboarding-dialog');
const scanProgress = document.querySelector('#scan-progress');
const importingScreen = document.querySelector('#importing-screen');
const startupLibrarySnapshot = window.launcher.getCachedLibrary().catch(() => null);
const avatarPresets = [
  ...['21058', '21038', '21046', '21026', '21047', '20000', '21040', '21045', '21019', '21050', '21044', '21006'].map((number, index) => ({ id: `360-original-${index + 1}`, group: 'Xbox 360 originals', label: `Original ${index + 1}`, url: `https://assets.xboxgamer.pics/titles/fffe07d1/${number}.png` })),
  ...[
    'https://live.staticflickr.com/3748/12110838883_8577c69393_z.jpg',
    'https://live.staticflickr.com/5534/12110922234_3b5072ec78_z.jpg',
    'https://live.staticflickr.com/3741/12111196666_c1bae4fa61_z.jpg',
    'https://live.staticflickr.com/2852/12110838863_b170342b32_z.jpg',
    'https://live.staticflickr.com/5518/12110536055_6e12210b4d_z.jpg',
    'https://live.staticflickr.com/5500/12111195906_33def93f4e_z.jpg'
  ].map((url, index) => ({ id: `one-contest-${index + 1}`, group: 'Xbox One community originals', label: `Xbox One ${index + 1}`, url })),
  { id: 'one-orbit', group: 'Offline presets', label: 'Orbit', glyph: '◎', colors: '#08764b,#0b1e2a' },
  { id: 'one-spark', group: 'Offline presets', label: 'Spark', glyph: '✦', colors: '#165ac7,#121532' },
  { id: 'one-peak', group: 'Offline presets', label: 'Peak', glyph: '▲', colors: '#7541ae,#1b1646' }
];
let selectedAvatarId = 'one-orbit';
let customAvatarData = '';
let customArtworkSearchSequence = 0;
let customArtworkSearchTimer = null;

function avatarMarkup(preset) {
  if (preset?.id === 'custom-uploaded' && customAvatarData) return `<img class="custom-avatar-image" src="${customAvatarData}" alt="Uploaded gamerpic" />`;
  return preset.url ? `<span class="avatar-picture"><span class="avatar-glyph" style="background:linear-gradient(140deg,#87c721,#103a26)">X</span><img src="${preset.url}" alt="" /></span>` : `<span class="avatar-glyph" style="background:linear-gradient(140deg,${preset.colors})">${preset.glyph}</span>`;
}

function renderAvatarChoices() {
  const presets = customAvatarData
    ? [{ id: 'custom-uploaded', group: 'Your gamerpic', label: 'Uploaded image' }, ...avatarPresets]
    : avatarPresets;
  for (const container of [document.querySelector('#avatar-choices'), document.querySelector('#onboard-avatar-choices')]) {
    container.innerHTML = presets.map((preset, index) => `${index === 0 || presets[index - 1].group !== preset.group ? `<strong class="avatar-group">${preset.group}</strong>` : ''}<button class="avatar-choice focusable${selectedAvatarId === preset.id ? ' selected' : ''}" type="button" data-action="choose-avatar" data-avatar-id="${preset.id}" aria-label="${preset.group}: ${preset.label}">${avatarMarkup(preset)}<span>${preset.label}</span></button>`).join('');
  }
  const selected = presets.find((preset) => preset.id === selectedAvatarId) || avatarPresets.find((preset) => preset.id === 'one-orbit');
  document.querySelector('#profile-avatar').innerHTML = avatarMarkup(selected);
  const profileAvatar = document.querySelector('#profile-large-avatar');
  if (profileAvatar) profileAvatar.innerHTML = avatarMarkup(selected);
  document.querySelectorAll('.avatar-picture img').forEach((image) => image.addEventListener('error', () => image.remove(), { once: true }));
}

function showOnboardingStep(step) {
  state.onboardingStep = Math.max(0, Math.min(2, step));
  document.querySelectorAll('[data-onboarding-step]').forEach((panel) => { panel.hidden = Number(panel.dataset.onboardingStep) !== state.onboardingStep; });
  document.querySelectorAll('[data-onboarding-indicator]').forEach((indicator) => {
    const index = Number(indicator.dataset.onboardingIndicator);
    indicator.classList.toggle('active', index === state.onboardingStep);
    indicator.classList.toggle('complete', index < state.onboardingStep);
    if (index === state.onboardingStep) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
  });
  document.querySelector('#onboarding-step-label').textContent = `Step ${state.onboardingStep + 1} of 3`;
  document.querySelector('#onboard-back').hidden = state.onboardingStep === 0;
  document.querySelector('#onboard-next').hidden = state.onboardingStep === 2;
  document.querySelector('#onboard-finish').hidden = state.onboardingStep !== 2;
  refreshFocusables();
  const target = state.onboardingStep === 1 ? document.querySelector('#onboard-name')
    : state.onboardingStep === 2 ? document.querySelector('#onboard-finish')
      : document.querySelector('#onboard-next');
  if (target && onboardingDialog.open) setTimeout(() => setFocusedElement(target, { scroll: false }), 0);
}

function showSettingsPage(page) {
  document.querySelectorAll('[data-settings-page]').forEach((element) => { element.hidden = element.dataset.settingsPage !== page; });
  document.querySelectorAll('[data-settings-tab]').forEach((button) => {
    const active = button.dataset.settingsTab === page;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const headings = { services: ['Library', 'Your installed games, launchers, and optional connections.'], experience: ['General', 'The essentials for playing on this PC.'], personalization: ['Appearance', 'Make the interface comfortable on your screen.'], data: ['Data & help', 'Manage this launcher and find setup guidance.'] };
  const [title, description] = headings[page] || headings.experience;
  document.querySelector('.settings-title h2').textContent = title;
  document.querySelector('.settings-title p').textContent = description;
  document.querySelector('.settings-scroll').scrollTop = 0;
  refreshFocusables();
}

let activityTimer = null;
function showActivity(title, message, percent = null, duration = 0, kind = '') {
  clearTimeout(activityTimer);
  scanProgress.hidden = false;
  scanProgress.dataset.kind = kind;
  scanProgress.querySelector('.scan-progress-top strong').textContent = title;
  document.querySelector('#scan-percent').textContent = percent === null ? '' : `${percent}%`;
  scanProgress.querySelector('.scan-track').hidden = percent === null;
  document.querySelector('#scan-fill').style.width = `${percent ?? 0}%`;
  document.querySelector('#scan-message').textContent = message;
  if (duration) activityTimer = setTimeout(updateConnectivityActivity, duration);
}

function updateConnectivityActivity() {
  if (navigator.onLine) scanProgress.hidden = true;
  else showActivity('Offline mode', 'Your cached library and artwork remain available. Online metadata may be limited.', null, 0, 'offline');
}

window.launcher.onLibraryProgress(({ percent, message }) => {
  showActivity(state.backgroundLibraryRefresh ? 'Updating your library' : 'Importing your library', message, percent, percent >= 100 ? 1800 : 0);
  if (state.fullScreenImport) {
    document.querySelector('#importing-percent').textContent = `${percent}%`;
    document.querySelector('#importing-fill').style.width = `${percent}%`;
    document.querySelector('#importing-message').textContent = message;
  }
});
window.addEventListener('online', updateConnectivityActivity);
window.addEventListener('offline', updateConnectivityActivity);
function applyLibraryResult(result, preserveFocus = false) {
  const focusedBeforeRefresh = preserveFocus ? document.activeElement : null;
  const focusLocation = focusedBeforeRefresh?.classList?.contains('focusable') ? {
    containerId: focusedBeforeRefresh.parentElement?.id,
    gameId: focusedBeforeRefresh.dataset.gameId,
    appId: focusedBeforeRefresh.dataset.appId,
    action: focusedBeforeRefresh.dataset.action
  } : null;
  state.games = result.games || [];
  state.steamStatus = result.steamStatus || 'disabled';
  state.steamOwnedCount = Number(result.steamOwnedCount) || 0;
  state.steamId64 = result.steamId64 || '';
  state.showUninstalledSteam = result.showUninstalledSteam === true;
  state.showUninstalledEpic = result.showUninstalledEpic === true;
  state.epicStatus = result.epicStatus || 'needs-helper';
  state.epicOwnedCount = Number(result.epicOwnedCount) || 0;
  state.epicHelperPath = result.epicHelperPath || '';
  state.steamApiKeyConfigured = result.steamApiKeyConfigured === true;
  state.trendingRanks = {};
  state.trendingStatus = state.steamApiKeyConfigured ? 'loading' : 'needs-api-key';
  renderSteamConnectionStatus();
  renderEpicConnectionStatus();
  renderLibrary();
  if (focusLocation && !focusedBeforeRefresh.isConnected && !topmostOpenDialog()) {
    const container = focusLocation.containerId ? document.getElementById(focusLocation.containerId) : document;
    const candidates = [...(container || document).querySelectorAll('.focusable')];
    const replacement = candidates.find((element) =>
      element.dataset.action === focusLocation.action &&
      (focusLocation.gameId ? element.dataset.gameId === focusLocation.gameId : true) &&
      (focusLocation.appId ? element.dataset.appId === focusLocation.appId : true) &&
      element.offsetParent !== null
    ) || candidates.find((element) => element.offsetParent !== null);
    if (replacement) {
      state.focusedElement = replacement;
      replacement.classList.add('focused');
      replacement.focus({ preventScroll: true });
      refreshFocusables();
    }
  }
  if (!state.steamDiscoveryRequested) {
    state.steamDiscoveryRequested = true;
    window.launcher.getSteamDiscovery().then((discovery) => {
      state.steamDiscovery = discovery;
      for (const item of Object.values(discovery).filter(Array.isArray).flat()) {
        const artwork = state.steamDiscoveryArtworkUpdates.get(item.appId);
        if (artwork) item.artwork = artwork;
      }
      renderHomeCollections();
      refreshFocusables();
    }).catch(() => {
      state.steamDiscovery = { mostPlayed: [], topSellers: [], upcoming: [], status: 'unavailable' };
      renderHomeCollections();
    });
  }
  if (settingsDialog.open) renderSettingsLauncherSummary();
}

function renderSettingsLauncherSummary() {
  const launchers = state.games.filter(game => game.isLauncher);
  document.querySelector('#settings-launcher-summary').innerHTML = launchers.length
    ? `<span class="settings-connected-dot"></span><strong>${launchers.length} game launcher${launchers.length === 1 ? '' : 's'} detected</strong><button class="focusable" type="button" data-action="settings-open-apps">View apps ›</button>`
    : '<strong>No game launchers detected yet</strong><span>Scan again or add an app manually.</span>';
}
window.launcher.onLibraryInitial((result) => applyLibraryResult(result, state.backgroundLibraryRefresh));
window.launcher.onSteamDiscoveryArtwork(({ appId, artwork }) => {
  state.steamDiscoveryArtworkUpdates.set(appId, artwork);
  for (const item of Object.values(state.steamDiscovery).filter(Array.isArray).flat()) if (item.appId === appId) item.artwork = artwork;
  document.querySelectorAll(`.steam-discovery-card[data-app-id="${CSS.escape(appId)}"]`).forEach(cardElement => {
    const item = Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(game => game.appId === appId);
    const owned = state.games.find(game => game.provider === 'Steam' && String(game.appId) === appId);
    if (item) {
      const artGame = owned?.artwork?.manual ? owned : item;
      cardElement.querySelector('.steam-discovery-art').innerHTML = gameArt(artGame);
      cardElement.classList.toggle('no-cover', !artGame.artwork?.tile);
    }
  });
});
window.launcher.onLibraryTrending((result) => {
  state.trendingRanks = result.ranks || {};
  state.trendingStatus = result.status || 'unavailable';
  renderHomeCollections();
});
window.launcher.onLibraryArtwork((changes) => {
  for (const change of changes) {
    const game = state.games.find((item) => item.id === change.id);
    if (!game) continue;
    game.artwork = change.artwork;
    if (game.controls === 'unknown') game.controls = change.artwork?.controls || 'unknown';
    document.querySelectorAll(`.game-card[data-game-id="${CSS.escape(game.id)}"]`).forEach((cardElement) => {
      const oldArt = cardElement.querySelector(':scope > img, :scope > .art-fallback');
      if (oldArt) oldArt.outerHTML = gameArt(game);
      const oldControl = cardElement.querySelector(':scope > .control-badge');
      if (oldControl) oldControl.outerHTML = controlBadge(game);
    });
    if (game.id === state.selectedGameId) selectGame(game.id, false, null, false);
  }
  const collage = document.querySelector('.library-collage');
  if (collage) collage.innerHTML = state.games.filter((game) => !game.isApp && game.installed !== false).slice(0, 4).map((game) => `<span class="library-collage-art">${gameArt(game)}</span>`).join('');
  renderHomeCollections();
  updateControllerPrompts();
});
document.addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.dataset.artGameId) return;
  const game = state.games.find((item) => item.id === image.dataset.artGameId) || Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(item => item.id === image.dataset.artGameId);
  if (!game) return;
  const candidates = game.artwork?.coverCandidates || [];
  const next = Number(image.dataset.coverIndex || 0) + 1;
  if (candidates[next]?.tile) {
    image.dataset.coverIndex = String(next);
    image.src = candidates[next].tile;
  } else {
    image.replaceWith(Object.assign(document.createElement('span'), { className: 'art-fallback broken-cover', textContent: game.title }));
  }
}, true);

function playUiSound(kind = 'navigate') {
  if (!state.soundEffects) return;
  const presets = {
    navigate: [{ hz: 460, duration: .045, gain: .035 }],
    confirm: [{ hz: 560, duration: .065, gain: .05 }, { hz: 820, delay: .055, duration: .085, gain: .045 }],
    back: [{ hz: 610, duration: .05, gain: .035 }, { hz: 430, delay: .045, duration: .075, gain: .03 }],
    launch: [{ hz: 392, duration: .09, gain: .04 }, { hz: 523, delay: .085, duration: .09, gain: .045 }, { hz: 659, delay: .17, duration: .1, gain: .045 }, { hz: 784, delay: .265, duration: .17, gain: .05 }]
  };
  try {
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    const start = audioContext.currentTime;
    for (const note of presets[kind] || presets.navigate) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + (note.delay || 0);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.hz, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(note.gain, at + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, at + note.duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + note.duration + .015);
    }
  } catch { /* Audio can be unavailable in a remote desktop session. */ }
}

function hashHue(text) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0) * 7, 0) % 360;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function fallbackWordmark(title) {
  const safe = escapeHtml(title.slice(0, 30));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="180" viewBox="0 0 900 180"><text x="450" y="115" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${title.length > 20 ? 48 : 68}" font-weight="900" letter-spacing="2">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function applyAmbientImage(game, image, kind) {
  const ambientKey = `${game.id}:${kind}:${image || hashHue(game.title)}`;
  if (state.ambientKey === ambientKey) return;
  state.ambientKey = ambientKey;
  const target = visibleAmbient === ambient ? ambientNext : ambient;
  target.style.backgroundImage = image
    ? `linear-gradient(118deg, rgba(3,9,14,.3), rgba(3,9,14,.08)), url("${image.replaceAll('"', '%22')}")`
    : `radial-gradient(circle at 78% 7%, hsla(${hashHue(game.title)}, 72%, 48%, .55), transparent 34%), linear-gradient(118deg, #06243a, #101820 66%, #07090c)`;
  target.classList.add('ambient-active');
  visibleAmbient.classList.remove('ambient-active');
  visibleAmbient = target;
}

function pickNewScreenshot(images, gameId, previousByGame) {
  const previous = previousByGame.get(gameId);
  const choices = images.length > 1 ? images.filter((image) => image !== previous) : images;
  const image = choices[Math.floor(Math.random() * choices.length)] || images[0];
  if (image) previousByGame.set(gameId, image);
  return image;
}

function updateAmbient(game, force = false) {
  const requestToken = ++state.homeAmbientRequestToken;
  const fallback = game.artwork?.hero || game.artwork?.tile || game.artwork?.grid;
  const cachedScreenshots = state.homeScreenshotCache.get(game.id) || [];
  if (state.shuffleHomeScreenshots && cachedScreenshots.length) {
    applyAmbientImage(game, pickNewScreenshot(cachedScreenshots, game.id, state.lastHomeScreenshotByGame), 'screenshot');
    return;
  }
  if (force) state.ambientKey = '';
  applyAmbientImage(game, fallback, 'artwork');
  if (!state.shuffleHomeScreenshots) return;
  window.launcher.getGameDetails(game.id).then((details) => {
    const screenshots = [...new Set((details.screenshots || []).filter(Boolean))];
    state.homeScreenshotCache.set(game.id, screenshots);
    if (!screenshots.length || requestToken !== state.homeAmbientRequestToken || state.selectedGameId !== game.id || !state.shuffleHomeScreenshots) return;
    applyAmbientImage(game, pickNewScreenshot(screenshots, game.id, state.lastHomeScreenshotByGame), 'screenshot');
  }).catch(() => {});
}

function providerBadge(provider) {
  if (provider === 'Steam') {
    return '<span class="provider-mark steam-mark" title="Steam" aria-label="Steam"><img src="assets/steam.svg" alt="" /></span>';
  }
  if (provider === 'Epic Games') return '<span class="provider-mark epic-mark" title="Epic Games" aria-label="Epic Games">EPIC</span>';
  if (provider === 'Xbox PC') return '<span class="provider-mark xbox-mark" title="Xbox PC" aria-label="Xbox PC"><img src="assets/xbox.svg" alt="" /></span>';
  if (provider === 'Ubisoft Connect') return '<span class="provider-mark pc-mark" title="Ubisoft Connect" aria-label="Ubisoft Connect">UBI</span>';
  if (provider === 'EA app') return '<span class="provider-mark pc-mark" title="EA app" aria-label="EA app">EA</span>';
  if (provider === 'Battle.net') return '<span class="provider-mark pc-mark" title="Battle.net" aria-label="Battle.net">B.NET</span>';
  return `<span class="provider-mark pc-mark" title="${escapeHtml(provider)}" aria-label="${escapeHtml(provider)}">PC</span>`;
}

function gameArt(game, className = '', featured = false) {
  const url = featured
    ? (game.artwork?.hero || game.artwork?.wide || game.artwork?.tile)
    : (game.artwork?.tile || game.artwork?.grid);
  // A vertical/wide asset is still useful as a backdrop, but the launcher keeps
  // every library tile square and places the title logo over that backdrop.
  const showCenteredLogo = game.artwork?.overlayLogo === true && game.artwork?.logo;
  const fallbackTile = !featured && url && (game.artwork?.tileIsSquare !== true || (showCenteredLogo && game.artwork?.overlayLogo));
  if (url && !fallbackTile) return `<img class="${className}" src="${escapeHtml(url)}" data-art-game-id="${escapeHtml(game.id)}" data-cover-index="0" alt="" loading="${featured ? 'eager' : 'lazy'}" decoding="async" draggable="false">`;
  if (featured && url) return `<img class="${className}" src="${escapeHtml(url)}" alt="" decoding="async" draggable="false">`;
  return `<span class="art-fallback" style="--hue:${hashHue(game.title)}">
    ${url ? `<img class="fallback-art" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}
    <span class="fallback-scrim"></span>
    ${showCenteredLogo ? `<img class="tile-logo" src="${escapeHtml(game.artwork.logo)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="fallback-title">${escapeHtml(game.title)}</span>`}
  </span>`;
}

function controlBadge(game) {
  const support = game.controls || 'unknown';
  const labels = { controller: 'Controller', partial: 'Partial controller support', kbm: 'Keyboard and mouse only', unknown: 'Input support not detected' };
  const label = labels[support] || labels.unknown;
  const icon = support === 'kbm'
    ? '<img src="assets/keyboard.svg" alt="" />'
    : '<img src="assets/controller.svg" alt="" />';
  return `<span class="control-badge control-${escapeHtml(support)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon}</span>`;
}

function card(game, index = 0) {
  if (game.isApp) {
    const icon = game.isXboxLauncher ? '<img src="assets/xbox.svg" alt="" />' : game.launcherIcon ? `<img src="${escapeHtml(game.launcherIcon)}" alt="" />` : game.artwork?.tile ? `<img src="${escapeHtml(game.artwork.tile)}" alt="" loading="lazy" />` : providerBadge(game.provider);
    return `<button class="app-list-card focusable" type="button" role="listitem" data-action="select-app" data-game-id="${escapeHtml(game.id)}" aria-label="Open ${escapeHtml(game.title)} options"><span class="app-list-icon">${icon}</span><span class="app-list-copy"><strong>${escapeHtml(game.title)}</strong><small>${game.isLauncher ? 'Game launcher' : 'App'} · ${escapeHtml(game.provider)}</small></span><span class="app-list-chevron" aria-hidden="true">›</span></button>`;
  }
  const installClass = game.installed === false ? ' not-installed' : '';
  return `<button class="game-card focusable${installClass}" style="--tile-index:${Math.min(index, 8)}" role="listitem" data-game-id="${escapeHtml(game.id)}" data-action="select-game" aria-label="${escapeHtml(game.title)}, ${escapeHtml(game.provider)}${game.installed === false ? ', not installed' : ''}" title="${escapeHtml(game.title)}${game.installed === false ? ' · Not installed' : ''} · Right click or press Y for options">
    ${gameArt(game)}
    ${providerBadge(game.provider)}
    ${controlBadge(game)}
    ${game.installed === false ? '<span class="install-state">NOT INSTALLED</span>' : ''}
  </button>`;
}

function updateControllerPrompts() {
  const selectedGame = state.games.find((game) => game.id === state.selectedGameId);
  const hasGames = state.games.some((game) => !game.isApp);
  const hasHomeGames = state.games.some((game) => !game.isApp && game.installed !== false);
  const visible = state.view === 'home' ? hasHomeGames : ['library', 'detail'].includes(state.view) && hasGames;
  controllerPrompts.hidden = !visible;
  const setPrompt = (element, show, label) => {
    element.hidden = !show;
    element.querySelector('span').textContent = label;
  };
  setPrompt(promptA, Boolean(selectedGame), state.view === 'detail' && selectedGame?.installed !== false ? 'Play' : state.view === 'detail' && selectedGame ? 'Install' : 'Open');
  const navOpen = !navPanel.hidden;
  setPrompt(promptB, state.view !== 'home' || navOpen, navOpen ? 'Close' : state.view === 'library' ? 'Home' : 'Back');
  setPrompt(promptX, state.view !== 'detail', 'Scan');
  setPrompt(promptY, Boolean(selectedGame), 'Options');
  setPrompt(promptMenu, true, 'Settings');
}

function libraryCard(games) {
  const collage = games.map((game) => `<span class="library-collage-art">${gameArt(game)}</span>`).join('');
  return `<button class="library-card focusable" data-action="library" aria-label="Open full library">
    <span class="library-collage">${collage || '<span class="library-collage-empty">+</span>'}</span>
    <span class="library-card-scrim"></span>
    <span class="library-card-label"><strong>Library</strong><span>View all games</span></span>
  </button>`;
}

function renderLibraryView() {
  libraryView.classList.toggle('show-apps', state.libraryCategory === 'apps');
  const categorySource = state.libraryCategory === 'apps'
    ? state.games.filter((game) => game.isApp)
    : state.libraryCategory === 'games'
      ? state.games.filter((game) => !game.isApp)
      : state.games;
  const filtered = categorySource.filter((game) => (!state.searchQuery || game.title.toLowerCase().includes(state.searchQuery))
    && (state.installFilter === 'all' || (game.installed !== false) === (state.installFilter === 'installed'))
    && (state.sourceFilter === 'all' || game.provider === state.sourceFilter)
    && matchesCollection(game, state.collectionFilter || 'all'));
  const source = filtered.filter((game) => state.libraryTab === 'play-history' ? (game.playCount || 0) > 0
    : state.libraryTab === 'my-games' ? game.installed !== false || game.steamOwned || game.epicOwned : true);
  if (state.librarySort === 'name') source.sort((a, b) => a.title.localeCompare(b.title));
  else if (state.librarySort === 'provider') source.sort((a, b) => a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title));
  else if (state.librarySort === 'playtime') source.sort((a, b) => (b.steamPlaytimeMinutes || 0) - (a.steamPlaytimeMinutes || 0) || a.title.localeCompare(b.title));
  else if (state.libraryTab === 'play-history') source.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  const categoryName = state.libraryCategory === 'apps' ? 'Apps' : state.libraryCategory === 'games' ? 'Games' : 'Full library';
  libraryCount.textContent = `${source.length} ${state.libraryCategory === 'apps' ? 'app' : state.libraryCategory === 'games' ? 'game' : 'item'}${source.length === 1 ? '' : 's'}`;
  document.querySelector('#library-heading').textContent = state.libraryTab === 'play-history' ? 'Play history' : categoryName;
  libraryGrid.innerHTML = source.length
    ? source.map((game, index) => card(game, index)).join('')
    : '<p class="library-no-results">No items match these filters.</p>';
  libraryGrid.classList.toggle('dense-results', source.length > 28);
  libraryGrid.classList.toggle('apps-grid', state.libraryCategory === 'apps');
  document.querySelectorAll('.library-tab').forEach((tab) => {
    const active = tab.dataset.tab === state.libraryTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    if (!chip.dataset.category) return;
    const active = chip.dataset.category === state.libraryCategory;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-action="library-install-filter"]').forEach((chip) => {
    const active = chip.dataset.installed === state.installFilter;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
}

function renderSteamConnectionStatus() {
  const messages = {
    disabled: 'Installed Steam games are linked. Account library features are optional.',
    ready: `${state.steamOwnedCount} Steam games visible to the API${state.showUninstalledSteam ? ' · uninstalled titles are included below' : ' · enable uninstalled games in Settings'}.`,
    'needs-api-key': 'Add a Steam Web API key in Settings to show uninstalled games.',
    'needs-steam-id': 'SteamID64 not detected. Sign in to the Steam client or enter it in Settings.',
    'invalid-api-key': 'Steam rejected this API key. Check or replace it in Settings.',
    'private-library': 'Steam returned no visible library. Check your profile’s Game details privacy setting.',
    'steam-error': 'Steam library request failed. Check the key, SteamID64, connection, and try again.'
  };
  const message = messages[state.steamStatus] || 'Steam library status unavailable.';
  document.querySelector('#steam-connection-text').textContent = message;
  document.querySelector('#settings-steam-status').textContent = message;
  document.querySelector('#steam-connection-banner').hidden = state.steamBannerDismissed;
}

function renderEpicConnectionStatus() {
  const status = document.querySelector('#settings-epic-status');
  const badge = document.querySelector('#settings-epic-badge');
  if (!status || !badge) return;
  const messages = {
    ready: `${state.epicOwnedCount || 0} Epic titles found in the signed-in account library.`,
    available: 'Legendary is available. Turn on uninstalled games to load your Epic account library.',
    'needs-helper': 'Install or select Legendary (included with Heroic) to read uninstalled Epic games.',
    'sign-in-required': 'Legendary is installed but could not read the library. Sign in there, then scan again.'
  };
  status.textContent = messages[state.epicStatus] || 'Epic account library status unavailable.';
  badge.textContent = state.epicStatus === 'ready' ? 'Connected' : state.epicStatus === 'available' ? 'Ready' : 'Setup needed';
}

async function refreshEpicHelperStatus() {
  const configuredPath = document.querySelector('#legendary-path').value.trim();
  const result = await window.launcher.getEpicHelperStatus(configuredPath);
  const toggle = document.querySelector('#show-uninstalled-epic-toggle');
  toggle.disabled = !result.available;
  if (!result.available) toggle.checked = false;
  document.querySelector('#settings-epic-status').textContent = result.available
    ? state.epicStatus === 'ready' && state.showUninstalledEpic ? `${state.epicOwnedCount || 0} Epic titles found in your account library.` : 'Legendary found. Sign in through Legendary or Heroic, then enable uninstalled games.'
    : 'Choose Legendary.exe to enable the uninstalled Epic library.';
  document.querySelector('#settings-epic-badge').textContent = result.available ? state.epicStatus === 'ready' && state.showUninstalledEpic ? 'Connected' : 'Ready' : 'Setup needed';
}

function renderSteamLocalStatus(target = '#onboard-steam-status') {
  const element = document.querySelector(target);
  if (!element) return;
  const status = state.steamLocalStatus;
  const locallyLinked = Boolean(status?.installed || status?.accountDetected || status?.ready);
  element.classList.toggle('steam-status-ready', locallyLinked);
  const check = document.querySelector('#onboard-steam-check');
  if (check && target === '#onboard-steam-status') {
    check.hidden = !locallyLinked;
    check.setAttribute('aria-label', locallyLinked ? 'Steam detected; installed games are linked automatically' : 'Steam not detected');
  }
  if (!status) { element.textContent = 'Checking this PC for Steam…'; return; }
  if (status.ready) element.textContent = 'Steam is connected on this PC. Installed games link automatically.';
  else if (status.clientRunning && status.accountDetected) element.textContent = 'Steam detected. Installed games link automatically; account details are optional.';
  else if (status.accountDetected) element.textContent = 'Steam account found. Installed games link automatically; no SteamID is needed for local games.';
  else if (status.installed) element.textContent = 'Steam found on this PC. Installed games link automatically; no sign-in is needed here.';
  else element.textContent = 'Steam desktop app not detected. Other installed games can still be imported.';
}

async function refreshSteamLocalStatus() {
  try {
    state.steamLocalStatus = await window.launcher.getSteamLocalStatus();
    renderSteamLocalStatus();
    renderSteamLocalStatus('#settings-steam-local-status');
  } catch { /* Steam status is optional; local installed-game scanning still works. */ }
}

function updateUninstalledRequirement(keyInputId, checkboxId, noteId = '') {
  const key = document.querySelector(`#${keyInputId}`).value.trim();
  const checkbox = document.querySelector(`#${checkboxId}`);
  checkbox.disabled = !key;
  if (!key) checkbox.checked = false;
  const note = noteId && document.querySelector(`#${noteId}`);
  if (note) note.textContent = key ? 'Steam API key added — account library can be queried.' : 'Add a Steam Web API key to enable this.';
}

function matchesCollection(game, collection) {
  const categories = (game.steamCategories || []).join(' ');
  if (collection === 'favorites') return state.favoriteGameIds.includes(game.id);
  if (collection.startsWith('custom:')) return state.customCollections.find((item) => item.id === collection.slice(7))?.gameIds.includes(game.id) || false;
  if (collection === 'controller') return ['controller', 'partial'].includes(game.controls);
  if (collection === 'solo') return /single-player/i.test(categories);
  if (collection === 'multiplayer') return /multi.?player|co-op|coop|split screen|online pvp|online pve/i.test(categories);
  if (collection === 'installed') return game.installed !== false;
  return true;
}

function showProfilePage(page) {
  document.querySelectorAll('[data-profile-page]').forEach(panel => panel.hidden = panel.dataset.profilePage !== page);
  document.querySelectorAll('[data-action="profile-tab"]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === page);
    tab.setAttribute('aria-selected', String(tab.dataset.page === page));
  });
  refreshFocusables();
}

function renderHomeCollections() {
  const steamGames = state.games.filter((game) => game.provider === 'Steam' && !game.isApp && (!state.searchQuery || game.title.toLowerCase().includes(state.searchQuery)));
  const homeGames = state.games.filter((game) => !game.isApp && game.installed !== false && (!state.searchQuery || game.title.toLowerCase().includes(state.searchQuery)));
  const favoriteGames = homeGames.filter((game) => state.favoriteGameIds.includes(game.id));
  favoritesShelf.hidden = favoriteGames.length === 0;
  favoritesRow.innerHTML = favoriteGames.slice(0, 12).map((game, index) => card(game, index)).join('');
  homeCollections.hidden = false;
  for (const [key, row] of Object.entries(steamDiscoveryRows)) {
    const items = state.steamDiscovery[key] || [];
    row.closest('section').hidden = items.length === 0 && state.steamDiscovery.status !== 'loading';
    row.innerHTML = items.length ? items.map(item => {
      const owned = state.games.find(game => game.provider === 'Steam' && String(game.appId) === item.appId);
      const target = owned || item;
      const artGame = owned?.artwork?.manual ? owned : item;
      const caption = key === 'mostPlayed'
        ? Number.isFinite(item.currentPlayers) && item.currentPlayers >= 0
          ? `${Intl.NumberFormat('en').format(item.currentPlayers)} playing now`
          : 'Player count unavailable'
        : owned ? 'In your library' : 'View on Steam';
      return `<button class="steam-discovery-card focusable${artGame.artwork?.tile ? '' : ' no-cover'}" type="button" data-action="discovery-game" data-game-id="${escapeHtml(target.id)}" data-app-id="${escapeHtml(item.appId)}" aria-label="${escapeHtml(item.title)}, ${escapeHtml(caption)}${owned ? ', in your library' : ''}"><span class="steam-discovery-art">${gameArt(artGame)}</span><span class="steam-discovery-rank">#${item.rank}</span><span class="steam-discovery-caption"><strong>${escapeHtml(item.title)}</strong><small>${caption}</small></span></button>`;
    }).join('') : '<p class="discovery-loading">Loading Steam charts…</p>';
  }
  for (const shelf of [trendingShelf, mostPlayedShelf, controllerReadyShelf, multiplayerShelf, singlePlayerShelf, recentlyPlayedShelf]) shelf.hidden = true;
  const collections = [
    ...state.customCollections.map((item) => [`custom:${item.id}`, item.name, 'Your collection']),
    ['favorites','Favorites','Your picks'],['controller','Controller ready','Pick up and play'],['solo','Single player','A world of your own'],['multiplayer','Play together','Better with company'],['installed','Ready to play','Installed on this PC']
  ];
  document.querySelector('#category-discovery').innerHTML = collections.map(([id,title,subtitle]) => {
    const games = homeGames.filter(game => matchesCollection(game,id));
    if (!games.length) return '';
    const art = games.find(game => game.artwork?.hero || game.artwork?.wide)?.artwork;
    return `<button class="category-card focusable" data-action="browse-collection" data-collection="${id}">${art ? `<img src="${escapeHtml(art.hero || art.wide)}" loading="lazy" alt="" />` : ''}<span><strong>${title}</strong><small>${subtitle} · ${games.length} games</small></span><b aria-hidden="true">›</b></button>`;
  }).join('');
  const recentlyPlayed = state.games.filter((game) => !game.isApp && game.playCount > 0 && (!state.searchQuery || game.title.toLowerCase().includes(state.searchQuery))).slice(0, 6);
  recentlyPlayedShelf.hidden = true;
  recentlyPlayedRow.innerHTML = recentlyPlayed.map((game, index) => card(game, index)).join('');
  trendingShelf.hidden = !state.steamApiKeyConfigured;
  trendingRow.innerHTML = [...steamGames]
    .filter((game) => Number(state.trendingRanks[game.id]) > 0)
    .sort((a, b) => state.trendingRanks[a.id] - state.trendingRanks[b.id])
    .slice(0, 5).map((game, index) => card(game, index)).join('');
  trendingNote.textContent = state.trendingStatus === 'ready'
    ? trendingRow.childElementCount ? 'Your library, ranked by current player counts across Steam' : 'No games in your visible Steam library appear in Steam’s current popularity chart'
    : state.trendingStatus === 'unavailable'
      ? 'Steam’s current popularity chart is unavailable right now'
      : 'Loading Steam’s current player rankings…';
  const steamPlaytime = [...steamGames].filter((game) => Number(game.steamPlaytimeMinutes) > 0)
    .sort((a, b) => Number(b.steamPlaytimeMinutes) - Number(a.steamPlaytimeMinutes)).slice(0, 5);
  mostPlayedShelf.hidden = !state.steamApiKeyConfigured || steamPlaytime.length === 0;
  mostPlayedRow.innerHTML = steamPlaytime.map((game, index) => card(game, index)).join('');
  const controllerReady = homeGames.filter((game) => ['controller', 'partial'].includes(game.controls));
  controllerReadyShelf.hidden = controllerReady.length === 0;
  controllerReadyRow.innerHTML = controllerReady.slice(0, 8).map((game, index) => card(game, index)).join('');
  const includesCategory = (game, pattern) => (game.steamCategories || []).some((category) => pattern.test(category));
  const multiplayerGames = homeGames.filter((game) => includesCategory(game, /multi.?player|co-op|coop|split screen|remote play together|online pvp|online pve/i));
  multiplayerShelf.hidden = multiplayerGames.length === 0;
  multiplayerRow.innerHTML = multiplayerGames.slice(0, 8).map((game, index) => card(game, index)).join('');
  const singlePlayerGames = homeGames.filter((game) => includesCategory(game, /^single-player$/i));
  singlePlayerShelf.hidden = singlePlayerGames.length === 0;
  singlePlayerRow.innerHTML = singlePlayerGames.slice(0, 8).map((game, index) => card(game, index)).join('');
  recentlyUpdatedRow.innerHTML = [...steamGames]
    .filter((game) => game.addedAt)
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 5).map((game, index) => card(game, index)).join('');
  const ids = new Set(homeGames.map((game) => game.id));
  state.randomGameIds = state.randomGameIds.filter((id) => ids.has(id));
  const pool = homeGames.filter((game) => !state.randomGameIds.includes(game.id));
  while (state.randomGameIds.length < Math.min(5, homeGames.length) && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    state.randomGameIds.push(pool.splice(index, 1)[0].id);
  }
  randomRow.innerHTML = state.randomGameIds.slice(0, 5)
    .map((id) => homeGames.find((game) => game.id === id))
    .filter(Boolean).map((game, index) => card(game, index)).join('');
  recentlyUpdatedRow.closest('section').hidden = true;
  randomRow.closest('section').hidden = true;
  for (const shelf of [trendingShelf, mostPlayedShelf, controllerReadyShelf, multiplayerShelf, singlePlayerShelf]) shelf.hidden = true;
  for (const [row, collection] of [[controllerReadyRow,'controller'],[multiplayerRow,'multiplayer'],[singlePlayerRow,'solo']]) {
    const heading = row.closest('section').querySelector('.section-heading');
    if (!heading.querySelector('button')) heading.insertAdjacentHTML('beforeend', `<button class="shelf-see-all focusable" data-action="browse-collection" data-collection="${collection}">See all <span aria-hidden="true">›</span></button>`);
  }
}

function renderLibrary() {
  renderCollectionOptions();
  const homeGames = state.games.filter((game) => !game.isApp && (game.installed !== false || state.searchQuery) && (!state.searchQuery || game.title.toLowerCase().includes(state.searchQuery)));
  const hasGames = homeGames.length > 0;
  const hasApps = state.games.some((game) => game.isApp);
  const hasItems = state.games.length > 0;
  if (!hasGames && hasApps && state.view === 'home' && !state.searchQuery) state.libraryCategory = 'apps';
  document.querySelector('main').hidden = !hasItems;
  emptyState.hidden = hasGames || state.view === 'library';
  if (!hasGames && hasItems) {
    emptyState.querySelector('h2').textContent = state.searchQuery ? 'No matching games' : 'No installed games on Home';
    emptyState.querySelector('p').textContent = state.searchQuery
      ? 'Try another title, or open Library to browse all games and apps.'
      : 'Open Library to browse your full Steam collection, including games that are not installed.';
  } else {
    emptyState.querySelector('h2').textContent = 'No games found yet';
    emptyState.querySelector('p').textContent = 'We scan Steam and Epic Games automatically. You can also add any Windows game manually.';
  }
  const visibleHomeGames = homeGames.slice(0, 7);
  const libraryPreviewGames = homeGames.slice(visibleHomeGames.length, visibleHomeGames.length + 4);
  recentRow.innerHTML = hasGames
    ? visibleHomeGames.map((game, index) => card(game, index)).join('') + libraryCard(libraryPreviewGames)
    : '';
  renderHomeCollections();
  renderLibraryView();
  if (hasGames && !state.games.some((game) => game.id === state.selectedGameId)) selectGame(homeGames[0].id, false);
  else if (!hasGames && hasApps && state.view === 'home' && !state.searchQuery) showView('library');
  if (state.selectedGameId) {
    const selectedCard = [...document.querySelectorAll('.game-card[data-game-id]')]
      .find((element) => element.dataset.gameId === state.selectedGameId && element.offsetParent !== null);
    if (selectedCard) selectGame(state.selectedGameId, false, selectedCard, false);
  }
  updateControllerPrompts();
  refreshFocusables();
}

function renderCollectionOptions() {
  const select = document.querySelector('#library-collection');
  const selected = state.collectionFilter || 'all';
  select.querySelectorAll('option[data-custom-collection]').forEach((option) => option.remove());
  for (const collection of state.customCollections) {
    const option = document.createElement('option');
    option.value = `custom:${collection.id}`;
    option.textContent = collection.name;
    option.dataset.customCollection = 'true';
    select.append(option);
  }
  if (![...select.options].some((option) => option.value === selected)) state.collectionFilter = 'all';
  select.value = state.collectionFilter || 'all';
}

function renderCollectionsDialog() {
  const game = state.games.find((item) => item.id === state.optionsGameId);
  if (!game) return;
  document.querySelector('#collections-subtitle').textContent = `Choose where ${game.title} appears.`;
  const list = document.querySelector('#collections-list');
  list.innerHTML = state.customCollections.length ? state.customCollections.map((collection) => {
    const included = collection.gameIds.includes(game.id);
    return `<div class="collection-list-row"><button class="collection-member focusable" type="button" data-action="collection-membership" data-collection-id="${escapeHtml(collection.id)}" aria-pressed="${included}"><span class="collection-check">${included ? '✓' : ''}</span><span><strong>${escapeHtml(collection.name)}</strong><small>${collection.gameIds.length} game${collection.gameIds.length === 1 ? '' : 's'}</small></span></button><button class="collection-delete focusable" type="button" data-action="collection-delete" data-collection-id="${escapeHtml(collection.id)}" aria-label="Delete ${escapeHtml(collection.name)} collection">×</button></div>`;
  }).join('') : '<p class="surface-empty">No collections yet. Create one below and this game will be added to it.</p>';
  refreshFocusables();
}

function renderGameSessionAction() {
  const activeId = state.activeGameSession?.gameId;
  const detailGame = state.games.find((item) => item.id === state.detailGameId);
  const detailButton = document.querySelector('#detail-play');
  if (detailGame && detailGame.installed !== false && detailGame.id === activeId) {
    detailButton.innerHTML = `<span class="detail-action-icon" aria-hidden="true">↩</span><strong>${state.activeGameSession.verified ? 'Return to game' : 'Return to last game'}</strong>`;
    detailButton.dataset.returnGame = 'true';
  } else {
    detailButton.removeAttribute('data-return-game');
    if (detailGame) detailButton.innerHTML = detailGame.installed === false
      ? '<span class="detail-action-icon" aria-hidden="true">↓</span><strong>Install</strong>'
      : '<span class="detail-action-icon" aria-hidden="true">▶</span><strong>Play</strong>';
  }
  const optionsReturn = document.querySelector('#options-return');
  const optionsPlay = gameOptionsDialog.querySelector('[data-action="options-launch"]');
  const isCurrent = Boolean(activeId && state.optionsGameId === activeId);
  optionsReturn.hidden = !isCurrent;
  optionsPlay.hidden = isCurrent || state.games.find((item) => item.id === state.optionsGameId)?.installed === false;
  optionsReturn.querySelector('strong').textContent = state.activeGameSession?.verified ? 'Return to game' : 'Return to last game';
}

async function refreshActiveGameSession() {
  try { state.activeGameSession = await window.launcher.getActiveGameSession(); }
  catch { state.activeGameSession = null; }
  renderGameSessionAction();
}

function renderSelectedGameNews(game) {
  const requestToken = ++state.newsRequestToken;
  const eligible = game?.provider === 'Steam' && /^\d+$/.test(String(game.appId || '')) && !game.isApp && game.id === state.detailGameId;
  newsShelf.hidden = true;
  newsRow.innerHTML = '';
  newsRow.classList.remove('news-changing');
  state.newsPendingGameId = null;
  if (!eligible) return;
  state.newsPendingGameId = game.id;
  newsSubtitle.textContent = `${game.title} · Steam updates`;
  const cached = state.newsCache.get(game.id);
  const newsPromise = cached && Date.now() - cached.at < 5 * 60 * 1000
    ? Promise.resolve(cached.items)
    : window.launcher.getGameNews(game.id).then((items) => {
      state.newsCache.set(game.id, { at: Date.now(), items });
      return items;
    });
  newsPromise.then((items) => {
    if (requestToken !== state.newsRequestToken || state.detailGameId !== game.id || state.view !== 'detail') return;
    state.newsPendingGameId = null;
    if (!items.length) { newsShelf.hidden = true; newsRow.innerHTML = ''; return; }
    const steamHeader = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(game.appId)}/header.jpg`;
    const fallbackArt = game.artwork?.wide || game.artwork?.hero || game.artwork?.tile || '';
    const markup = items.length ? items.map((item, index) => {
      const subtitle = String(item.contents || '').slice(0, 90) || 'Read the latest update';
      return `<button class="news-card focusable" role="listitem" data-action="open-news" data-news-index="${index}" aria-label="${escapeHtml(item.title)}">
        <img class="news-card-art" src="${escapeHtml(steamHeader)}" data-fallback="${escapeHtml(fallbackArt)}" alt="" loading="lazy" />
        <span class="news-card-shade"></span><span class="news-card-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(subtitle)}</span></span>
      </button>`;
    }).join('') : '<p class="news-loading">No recent English-language Steam news for this game.</p>';
    newsRow.classList.add('news-changing');
    setTimeout(() => {
      if (requestToken !== state.newsRequestToken) return;
      newsRow.innerHTML = markup;
      newsShelf.hidden = false;
      newsRow.querySelectorAll('.news-card-art').forEach((image) => image.addEventListener('error', () => {
        if (image.dataset.fallback && image.src !== image.dataset.fallback) image.src = image.dataset.fallback;
        else image.hidden = true;
      }));
      requestAnimationFrame(() => newsRow.classList.remove('news-changing'));
      refreshFocusables();
    }, 180);
  }).catch(() => {
    if (requestToken === state.newsRequestToken) {
      state.newsPendingGameId = null;
      newsShelf.hidden = true;
      newsRow.innerHTML = '';
      newsRow.classList.remove('news-changing');
    }
  });
}

function selectGame(id, moveFocus = true, selectedElement = null, refreshNews = true) {
  const game = state.games.find((item) => item.id === id);
  if (!game) return;
  const changed = state.selectedGameId !== id;
  state.selectedGameId = id;
  heroTitle.textContent = game.title;
  heroSubtitle.textContent = game.installed === false ? `Not installed · ${game.provider}` : `Installed with ${game.provider}`;
  heroProvider.textContent = game.provider.toUpperCase();
  heroPlay.hidden = false;
  if (game.artwork?.logo) {
    jumpLogo.innerHTML = `<img src="${escapeHtml(game.artwork.logo)}" alt="" draggable="false">`;
    jumpLogo.hidden = false;
  } else {
    jumpLogo.innerHTML = '';
    jumpLogo.hidden = true;
    if (!logoRequested.has(id) && game.artwork?.tile) {
      logoRequested.add(id);
      window.launcher.getGameLogo(id).then((logo) => {
        if (!logo) return;
        game.artwork ||= {};
        game.artwork.logo = logo;
        if (state.selectedGameId === id) {
          jumpLogo.innerHTML = `<img src="${escapeHtml(logo)}" alt="" draggable="false">`;
          jumpLogo.hidden = false;
        }
      }).catch(() => {});
    }
  }
  if (changed) updateAmbient(game);
  document.querySelectorAll('.game-card.selected').forEach((element) => element.classList.remove('selected'));
  if (selectedElement?.classList.contains('game-card')) selectedElement.classList.add('selected');
  if (refreshNews && state.view === 'detail' && (changed || (!state.newsCache.has(id) && state.newsPendingGameId !== id))) renderSelectedGameNews(game);
  if (moveFocus) {
    const matchingCard = [...document.querySelectorAll('.game-card[data-game-id]')].find((element) => element.dataset.gameId === id);
    if (matchingCard) setFocusedElement(matchingCard);
  }
  updateControllerPrompts();
}

function refreshFocusables() {
  const activeDialog = topmostOpenDialog();
  const scope = activeDialog || (!navPanel.hidden ? navPanel : document);
  state.focusables = [...scope.querySelectorAll('.focusable')].filter((element) => !element.hidden && !element.disabled && !element.closest('[inert]') && element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden');
  const currentIndex = state.focusables.indexOf(state.focusedElement);
  const activeIndex = state.focusables.indexOf(document.activeElement);
  if (currentIndex >= 0) state.focusIndex = currentIndex;
  else if (activeIndex >= 0) state.focusIndex = activeIndex;
  else if (state.focusIndex >= state.focusables.length) state.focusIndex = 0;
}

function setFocusedElement(element, { scroll = true } = {}) {
  const activeDialog = topmostOpenDialog();
  if (!element || (activeDialog && !activeDialog.contains(element))) return;
  refreshFocusables();
  if (state.focusedElement !== element) playUiSound('navigate');
  state.focusedElement = element;
  state.focusables.forEach((item) => item.classList.remove('focused'));
  const index = state.focusables.indexOf(element);
  if (index >= 0) state.focusIndex = index;
  element.classList.add('focused');
  element.focus({ preventScroll: true });
  if (!scroll) return;
  element.scrollIntoView({ behavior: 'smooth', block: element.closest('#random-row') ? 'center' : 'nearest', inline: 'center' });
  const mainScroller = document.querySelector('main');
  if (mainScroller.contains(element)) {
    const bounds = mainScroller.getBoundingClientRect();
    const focused = element.getBoundingClientRect();
    if (focused.top < bounds.top + 88) mainScroller.scrollBy({ top: focused.top - bounds.top - 110, behavior: 'smooth' });
    else if (focused.bottom > bounds.bottom - 34) mainScroller.scrollBy({ top: focused.bottom - bounds.bottom + 90, behavior: 'smooth' });
  }
  if (element.classList.contains('game-card') && element.dataset.gameId) selectGame(element.dataset.gameId, false, element);
}

function moveFocus(direction) {
  refreshFocusables();
  const current = state.focusables[state.focusIndex];
  if (!current) return;
  if (direction === 'down' && current.closest('#steam-upcoming-row')) {
    const browse = document.querySelector('#category-discovery .focusable');
    if (browse) { setFocusedElement(browse); return; }
  }
  const origin = current.getBoundingClientRect();
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best = null;
  let bestScore = Infinity;

  for (const candidate of state.focusables) {
    if (candidate === current) continue;
    const rect = candidate.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    const valid = direction === 'left' ? dx < -10 : direction === 'right' ? dx > 10 : direction === 'up' ? dy < -10 : dy > 10;
    if (!valid) continue;
    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.8;
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  if (best) setFocusedElement(best);
  else if (topmostOpenDialog()) {
    const choices = state.focusables;
    if (!choices.length) return;
    const edge = choices.reduce((chosen, item) => {
      const rect = item.getBoundingClientRect();
      const saved = chosen.getBoundingClientRect();
      if (direction === 'left' && rect.left < saved.left) return item;
      if (direction === 'right' && rect.right > saved.right) return item;
      if (direction === 'up' && rect.top < saved.top) return item;
      if (direction === 'down' && rect.bottom > saved.bottom) return item;
      return chosen;
    });
    if (edge !== current) setFocusedElement(edge);
  } else if (direction === 'up' || direction === 'down') document.querySelector('main').scrollBy({ top: direction === 'up' ? -window.innerHeight * .68 : window.innerHeight * .68, behavior: 'smooth' });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.toggle('controller-toast', /^Controller (connected|disconnected)/i.test(message));
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function isUsableController(gamepad) {
  if (!gamepad?.connected) return false;
  const id = String(gamepad.id || '').toLowerCase();
  // Windows can expose headset media controls through the Gamepad API. They
  // are connected devices, but do not have a game-controller input layout.
  if (/headset|headphones?|earbuds?|microphone|hands[- ]?free|audio|soundbar|media remote|volume control/.test(id)) return false;
  const buttonCount = gamepad.buttons?.length || 0;
  const axisCount = gamepad.axes?.length || 0;
  // Standard pads have many buttons; generic HID pads usually have at least
  // four buttons and two stick axes. This filters media remotes without
  // restricting Xbox, PlayStation, Switch, or third-party controllers.
  return buttonCount >= 8 || (buttonCount >= 4 && axisCount >= 2);
}

function getConnectedControllers() {
  try {
    return [...(navigator.getGamepads?.() || [])].filter(isUsableController);
  } catch {
    return [];
  }
}

function hasRecentControllerInput(gamepad) {
  return Boolean(gamepad?.buttons?.some((button) => button.pressed || button.value > .6)
    || gamepad?.axes?.some((axis) => Math.abs(axis) > .6));
}

function refreshControllerStatus() {
  const devices = getConnectedControllers();
  const button = document.querySelector('#controller-status-button');
  const dot = document.querySelector('#controller-status-dot');
  const title = document.querySelector('#controller-status-title');
  const copy = document.querySelector('#controller-status-copy');
  const list = document.querySelector('#controller-device-list');
  const connectButton = document.querySelector('#controller-connect-button');
  button?.classList.toggle('controller-ready', devices.length > 0);
  button?.setAttribute('aria-label', devices.length ? `Controller status: ${devices.length} connected` : 'Controller status: keyboard and mouse');
  button?.setAttribute('title', devices.length ? `${devices.length} controller${devices.length === 1 ? '' : 's'} connected` : 'Keyboard and mouse active · no controller detected');
  dot?.classList.toggle('connected', devices.length > 0);
  if (devices.length) {
    title.textContent = devices.length === 1 ? 'Controller connected' : `${devices.length} controllers connected`;
    copy.textContent = 'Controller input is ready. Use it to navigate your library and open games.';
    list.hidden = false;
    list.innerHTML = devices.map((gamepad) => `<div class="controller-device"><img src="assets/controller.svg" alt="" /><div><strong>${escapeHtml(gamepad.id || `Controller ${gamepad.index + 1}`)}</strong><span>${gamepad.mapping === 'standard' ? 'Standard controller layout · ready' : 'Connected · button layout may vary'}</span></div><i aria-label="Connected"></i></div>`).join('');
    connectButton.textContent = 'Refresh controller status';
  } else {
    title.textContent = 'Controller not detected';
    copy.textContent = 'Connect an Xbox, PlayStation, or compatible controller using USB or Bluetooth. You can keep using keyboard and mouse too.';
    list.hidden = true;
    list.innerHTML = '';
    connectButton.textContent = 'Connect my controller';
  }
  return devices;
}

function openControllerStatus() {
  refreshControllerStatus();
  controllerStatusDialog.showModal();
  setTimeout(() => setFocusedElement(document.querySelector('#controller-connect-button'), { scroll: false }), 0);
}

function openGameDetails(gameId) {
  const game = state.games.find((item) => item.id === gameId) || Object.values(state.steamDiscovery).filter(Array.isArray).flat().find((item) => item.id === gameId);
  if (!game) return;
  const discoveryOnly = game.discoveryOnly === true;
  if (state.view !== 'detail') state.previousView = state.view;
  state.detailGameId = game.id;
  if (!discoveryOnly) state.selectedGameId = game.id;
  searchPopover.hidden = true;
  const requestToken = ++state.detailRequestToken;
  showView('detail');
  if (discoveryOnly) { state.newsRequestToken++; state.newsPendingGameId = null; newsShelf.hidden = true; newsRow.innerHTML = ''; }
  else renderSelectedGameNews(game);
  const mainScroller = document.querySelector('main');
  mainScroller.style.scrollBehavior = 'auto';
  mainScroller.scrollTop = 0;
  gameDetailView.scrollTop = 0;
  requestAnimationFrame(() => mainScroller.style.removeProperty('scroll-behavior'));
  const image = game.artwork?.hero || game.artwork?.wide || game.artwork?.tile;
  const heroArt = document.querySelector('#detail-global-art');
  const alternateHeroArt = document.querySelector('#detail-global-art-next');
  const fallbackBackdrop = image
    ? `url("${image.replaceAll('"', '%22')}")`
    : `radial-gradient(circle at 38% 25%, hsla(${hashHue(game.title)}, 66%, 35%, .8), transparent 60%), #111820`;
  heroArt.style.backgroundImage = fallbackBackdrop;
  heroArt.classList.remove('active');
  alternateHeroArt.classList.remove('active');
  alternateHeroArt.style.backgroundImage = '';
  state.detailBackdropLayer = 0;
  requestAnimationFrame(() => {
    if (requestToken === state.detailRequestToken) heroArt.classList.add('active');
  });
  detailTitle.textContent = game.title;
  const showDetailLogo = (logo) => {
    if (!logo || state.detailGameId !== game.id) return;
    detailLogo.src = logo;
    detailLogo.hidden = false;
    detailTitle.hidden = true;
    detailLogo.onerror = () => { detailLogo.hidden = true; detailTitle.hidden = false; };
  };
  detailLogo.hidden = true;
  detailTitle.hidden = false;
  if (game.artwork?.logo) showDetailLogo(game.artwork.logo);
  else if (!discoveryOnly) window.launcher.getGameLogo(game.id).then((logo) => {
    if (requestToken !== state.detailRequestToken || !logo) return;
    game.artwork ||= {};
    game.artwork.logo = logo;
    showDetailLogo(logo);
  }).catch(() => {});
  document.querySelector('#detail-provider').innerHTML = `${providerBadge(game.provider)} ${escapeHtml(game.provider)}${game.provider === 'Steam' ? ' · PC' : ''}`;
  document.querySelector('#detail-byline').textContent = game.provider;
  document.querySelector('#detail-description').textContent = 'Loading game details…';
  document.querySelector('#detail-full-description').textContent = 'Game details are loading…';
  document.querySelector('#detail-publisher').textContent = 'Not available';
  document.querySelector('#detail-developer').textContent = 'Not available';
  document.querySelector('#detail-release-date').textContent = 'Not available';
  document.querySelector('#detail-metadata-source').textContent = '';
  document.querySelector('#detail-overview-grid').innerHTML = '<p class="detail-overview-loading">Gathering game information…</p>';
  document.querySelector('#detail-full-description').classList.add('clamped');
  document.querySelector('#detail-description-more').hidden = true;
  document.querySelector('#detail-description-more').textContent = 'View more';
  document.querySelector('#detail-rating').textContent = '';
  const playButton = document.querySelector('#detail-play');
  playButton.innerHTML = discoveryOnly ? '<span class="detail-action-icon" aria-hidden="true">↗</span><strong>View on Steam</strong>' : game.installed === false ? '<span class="detail-action-icon" aria-hidden="true">↓</span><strong>Install</strong>' : '<span class="detail-action-icon" aria-hidden="true">▶</span><strong>Play</strong>';
  if (discoveryOnly) playButton.removeAttribute('data-return-game');
  else renderGameSessionAction();
  playButton.classList.toggle('install-action', game.installed === false && !discoveryOnly);
  document.querySelector('#detail-options-button').hidden = discoveryOnly;
  state.galleryImages = [];
  document.querySelector('#detail-gallery').innerHTML = '<p>Loading screenshots…</p>';
  for (const id of ['detail-platforms', 'detail-inputs', 'detail-capabilities']) document.querySelector(`#${id}`).innerHTML = '';
  document.querySelector('#detail-dlc-note').textContent = 'Checking available ownership information…';
  document.querySelector('#detail-dlc-grid').innerHTML = '';
  document.querySelector('#detail-achievements-note').textContent = 'Checking achievements…';
  const achievementArt = document.querySelector('#achievement-game-art');
  achievementArt.innerHTML = game.artwork?.tile ? `<img src="${escapeHtml(game.artwork.tile)}" alt="" loading="lazy" />` : '<span aria-hidden="true">◇</span>';
  achievementArt.querySelector('img')?.addEventListener('error', () => { achievementArt.innerHTML = '<span aria-hidden="true">◇</span>'; }, { once: true });
  document.querySelector('#detail-achievements-grid').innerHTML = '';
  state.achievementItems = [];
  state.achievementFilter = 'all';
  state.achievementsExpanded = false;
  document.querySelector('#achievement-filters').hidden = true;
  document.querySelector('#achievement-progress').hidden = true;
  document.querySelector('#achievement-more').hidden = true;
  document.querySelector('#achievement-trueachievements').hidden = true;
  document.querySelector('#achievement-progress-label').textContent = '';
  document.querySelector('#achievement-source-label').textContent = '';
  if (discoveryOnly) {
    document.querySelector('#detail-achievements-note').textContent = 'Open this game on Steam to see its achievements.';
    document.querySelector('#detail-dlc-note').textContent = 'Open this game on Steam to browse add-ons.';
  } else window.launcher.getGameAchievements(game.id).then((result) => {
    if (requestToken !== state.detailRequestToken) return;
    state.achievementItems = result.items || [];
    state.achievementProgressAvailable = Boolean(result.progressAvailable);
    document.querySelector('#achievement-source-label').textContent = result.source || (result.status === 'xbox-ready' ? 'Xbox' : state.achievementItems.length ? 'Steam Community' : '');
    document.querySelector('#achievement-trueachievements').hidden = state.achievementItems.length > 0;
    const achievementStatusCopy = {
      'reference-only': 'Steam edition achievement catalog · view only; this PC copy’s unlocks are not linked',
      'catalog-only': '',
      'none-listed': 'No achievements listed for this Steam game.',
      'needs-steam-account': 'Add a Steam Web API key and SteamID64 in Settings to load achievements.',
      'xbox-ready': `${result.platform || 'Xbox'} achievement catalog · ${result.progressAvailable ? 'progress from your Xbox account' : 'catalog only'}`,
      'xbox-no-match': 'No Xbox title matched. Add an OpenXBL key or enter an Xbox Title ID in Game Options.',
      'xbox-unavailable': 'Xbox lookup failed. Check the OpenXBL key and connection.',
      'no-reference': 'No compatible achievement catalog found. Add an optional OpenXBL key in Settings to check your Xbox account.',
      unsupported: 'Achievement lists for this source need a separate authenticated platform integration.'
    };
    document.querySelector('#detail-achievements-note').textContent = result.status === 'ready'
      ? result.progressAvailable ? 'Your Steam achievement progress' : 'Achievement artwork and descriptions · personal progress unavailable'
      : achievementStatusCopy[result.status] ?? 'Achievements could not be loaded.';
    renderAchievements();
  }).catch(() => {
    if (requestToken !== state.detailRequestToken) return;
    document.querySelector('#detail-achievements-note').textContent = 'Achievements could not be loaded.';
    document.querySelector('#achievement-trueachievements').hidden = false;
  });
  setTimeout(() => setFocusedElement(playButton, { scroll: false }), 0);
  (discoveryOnly ? window.launcher.getSteamDiscoveryDetails(game.appId) : window.launcher.getGameDetails(game.id)).then((details) => {
    if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
    document.querySelector('#detail-byline').textContent = [details.publisher || details.developer || game.provider, details.genres?.[0]].filter(Boolean).join(' · ');
    document.querySelector('#detail-description').textContent = details.description || `Play ${game.title} from your ${game.provider} library.`;
    document.querySelector('#detail-publisher').textContent = details.publisher || 'Not available';
    document.querySelector('#detail-developer').textContent = details.developer || 'Not available';
    document.querySelector('#detail-release-date').textContent = details.releaseDate || 'Not available';
    const fullDescription = details.fullDescription || details.description || `Play ${game.title} from your ${game.provider} library.`;
    const fullDescriptionNode = document.querySelector('#detail-full-description');
    const descriptionMore = document.querySelector('#detail-description-more');
    fullDescriptionNode.textContent = fullDescription;
    fullDescriptionNode.classList.toggle('clamped', fullDescription.length > 360);
    descriptionMore.hidden = fullDescription.length <= 360;
    document.querySelector('#detail-rating').textContent = details.ageRating ? `Age rating ${details.ageRating}` : '';
    const images = [...new Set((details.screenshots || []).filter(Boolean))];
    state.galleryImages = images;
    state.homeScreenshotCache.set(game.id, images);
    if (state.useRandomScreenshotBackground && images.length) {
      const screenshot = pickNewScreenshot(images, game.id, state.lastDetailScreenshotByGame);
      const currentLayer = state.detailBackdropLayer === 0 ? heroArt : alternateHeroArt;
      const nextLayer = state.detailBackdropLayer === 0 ? alternateHeroArt : heroArt;
      nextLayer.style.backgroundImage = `url("${screenshot.replaceAll('"', '%22')}")`;
      requestAnimationFrame(() => {
        if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
        nextLayer.classList.add('active');
        currentLayer.classList.remove('active');
        state.detailBackdropLayer = state.detailBackdropLayer === 0 ? 1 : 0;
      });
    }
    document.querySelector('#detail-gallery').innerHTML = images.length
      ? images.map((url, index) => `<button class="detail-gallery-item focusable" type="button" data-action="detail-gallery-select" data-gallery-index="${index}" aria-label="View screenshot ${index + 1}"><img src="${escapeHtml(url)}" alt="Screenshot ${index + 1} of ${escapeHtml(game.title)}" loading="lazy" /></button>`).join('')
      : '<p>No screenshots available from this game’s store listing.</p>';
    document.querySelector('#detail-rating').textContent = [details.ageRating ? `Age rating ${details.ageRating}` : '', details.metacriticScore ? `Metacritic ${Number(details.metacriticScore)}` : ''].filter(Boolean).join(' · ');
    const playModes = (details.categories || []).filter((category) => /^(single-player|multi-player|online co-op|local co-op|shared\/split screen co-op|Xbox online co-op|Xbox online multiplayer)/i.test(category)).slice(0, 2).join(' · ');
    const overviewFacts = [
      { label: 'Genre', value: (details.genres || []).slice(0, 2).join(' · ') },
      { label: 'Play modes', value: playModes },
      { label: 'Input', value: details.controllerSupport === 'controller' ? 'Full controller support' : details.controllerSupport === 'partial' ? 'Partial controller support' : details.controllerSupport === 'kbm' ? 'Keyboard and mouse' : '' },
      { label: 'Achievements', value: details.achievementCount ? `${details.achievementCount} available` : '' },
      { label: 'Released', value: details.releaseDate }
    ].filter((fact) => fact.value).slice(0, 4);
    if (overviewFacts.length < 4) overviewFacts.push({ label: 'Library', value: game.provider });
    if (overviewFacts.length < 4) overviewFacts.push({ label: 'Playable on', value: (details.playableOn || ['PC']).join(' · ') });
    if (overviewFacts.length < 4 && !discoveryOnly) overviewFacts.push({ label: 'Status', value: game.installed === false ? 'Not installed' : 'Ready to play' });
    document.querySelector('#detail-metadata-source').textContent = details.metadataSource && details.metadataSource !== 'Local library' ? `Details from ${details.metadataSource}` : 'Your library';
    document.querySelector('#detail-overview-grid').innerHTML = overviewFacts.length
      ? overviewFacts.map((fact) => `<div class="detail-overview-fact"><span>${escapeHtml(fact.label)}</span><strong>${escapeHtml(fact.value)}</strong></div>`).join('')
      : '<p class="detail-overview-loading">More details aren’t available for this edition yet.</p>';
    const pills = (items) => items.map((label) => `<span class="detail-pill">${escapeHtml(label)}</span>`).join('');
    document.querySelector('#detail-platforms').innerHTML = pills(details.playableOn?.length ? details.playableOn : ['PC']);
    document.querySelector('#detail-inputs').innerHTML = pills(details.controllerSupport === 'controller' ? ['Controller', 'Keyboard and mouse'] : details.controllerSupport === 'partial' ? ['Partial controller', 'Keyboard and mouse'] : ['Keyboard and mouse']);
    document.querySelector('#detail-capabilities').innerHTML = pills(details.categories || []) || '<span class="detail-pill">No capability data available</span>';
    const dlcNote = document.querySelector('#detail-dlc-note');
    dlcNote.textContent = discoveryOnly ? 'View available add-ons on Steam.' : details.dlcStatus === 'needs-check' ? 'Loading add-ons listed by Steam…'
      : details.dlcStatus === 'none-listed' ? 'This store listing does not list DLC.'
        : 'No DLC listing is available for this game.';
    if (!discoveryOnly && details.dlcStatus === 'needs-check') window.launcher.getOwnedDlc(game.id).then((result) => {
      if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
      dlcNote.textContent = result.items?.length ? `Showing ${result.items.length}${result.total > result.items.length ? ` of ${result.total}` : ''} add-ons from Steam. “Owned” appears only when verified in your visible Steam library.` : 'No DLC listing is available for this game.';
      const dlcGrid = document.querySelector('#detail-dlc-grid');
      dlcGrid.innerHTML = (result.items || []).map((item) => `<div class="detail-dlc-item${item.image ? ' has-image' : ' no-image'}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" />` : ''}<div class="detail-dlc-copy"><strong>${escapeHtml(item.title)}</strong>${item.owned ? '<span class="dlc-owned">Owned</span>' : ''}</div></div>`).join('');
      dlcGrid.querySelectorAll('.detail-dlc-item img').forEach((image) => image.addEventListener('error', () => {
        image.closest('.detail-dlc-item')?.classList.replace('has-image', 'no-image');
        image.remove();
      }, { once: true }));
    }).catch(() => { if (requestToken === state.detailRequestToken) dlcNote.textContent = 'Could not load this game’s add-on list.'; });
    refreshFocusables();
  }).catch(() => {
    if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
    document.querySelector('#detail-description').textContent = `Play ${game.title} from your ${game.provider} library.`;
    document.querySelector('#detail-full-description').textContent = 'Game details are currently unavailable. Try opening this page again later.';
    document.querySelector('#detail-gallery').innerHTML = '<p>Screenshots are currently unavailable.</p>';
    document.querySelector('#detail-overview-grid').innerHTML = '<p class="detail-overview-loading">Game information is unavailable while offline.</p>';
    document.querySelector('#detail-dlc-note').textContent = 'Add-on details are currently unavailable.';
  });
}

function renderAchievements() {
  const items = state.achievementItems;
  const progressAvailable = state.achievementProgressAvailable;
  const unlockedCount = items.filter((item) => item.unlocked === true).length;
  const progress = document.querySelector('#achievement-progress');
  progress.hidden = !items.length || !progressAvailable;
  progress.querySelector('span').style.width = items.length ? `${Math.round(unlockedCount / items.length * 100)}%` : '0%';
  document.querySelector('#achievement-progress-label').textContent = items.length && progressAvailable ? `${unlockedCount} / ${items.length}` : '';
  document.querySelector('#achievement-filters').hidden = !items.length || !progressAvailable;
  document.querySelectorAll('.achievement-filter').forEach((button) => button.classList.toggle('active', button.dataset.filter === state.achievementFilter));
  const filtered = items.filter((item) => state.achievementFilter === 'all' || (state.achievementFilter === 'unlocked' ? item.unlocked === true : item.unlocked === false));
  const shown = state.achievementsExpanded ? filtered : filtered.slice(0, 12);
  document.querySelector('#detail-achievements-grid').innerHTML = shown.map((item) => {
    const status = item.unlocked === true ? 'Unlocked' : item.unlocked === false ? 'Locked' : Number.isFinite(item.rarity) ? `${item.rarity}% of players` : 'View-only catalog';
    const icon = item.unlocked === false ? item.lockedIcon || item.icon : item.icon || item.lockedIcon;
    const itemIndex = items.indexOf(item);
    return `<button type="button" class="detail-achievement focusable${item.unlocked === true ? ' unlocked' : ''}" data-action="achievement-open" data-achievement-index="${itemIndex}" aria-label="${escapeHtml(item.title)}, ${status}"><span class="achievement-art">${icon ? `<img src="${escapeHtml(icon)}" alt="" loading="lazy" decoding="async" />` : '<span class="achievement-fallback" aria-hidden="true">◇</span>'}</span><span class="achievement-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description || 'Hidden achievement')}</span><small>${escapeHtml(status)}</small></span><span class="achievement-chevron" aria-hidden="true">›</span></button>`;
  }).join('');
  document.querySelectorAll('.achievement-art img').forEach((image) => image.addEventListener('error', () => { image.parentElement.innerHTML = '<span class="achievement-fallback" aria-hidden="true">◇</span>'; }, { once: true }));
  const more = document.querySelector('#achievement-more');
  more.hidden = filtered.length <= 12;
  more.textContent = state.achievementsExpanded ? 'Show fewer' : `Show all ${filtered.length} achievements`;
  refreshFocusables();
}

function openAchievement(index) {
  const item = state.achievementItems[index];
  if (!item) return;
  const icon = item.unlocked === false ? item.lockedIcon || item.icon : item.icon || item.lockedIcon;
  const art = document.querySelector('#achievement-detail-art');
  art.innerHTML = icon ? `<img src="${escapeHtml(icon)}" alt="" />` : '<span aria-hidden="true">◇</span>';
  const image = art.querySelector('img');
  if (image) image.onerror = () => { art.innerHTML = '<span aria-hidden="true">◇</span>'; };
  document.querySelector('#achievement-detail-title').textContent = item.title;
  const achievementGame = state.games.find((game) => game.id === state.detailGameId);
  document.querySelector('#achievement-detail-game').textContent = [achievementGame?.title || 'Achievement', document.querySelector('#achievement-source-label').textContent].filter(Boolean).join(' · ');
  document.querySelector('#achievement-detail-description').textContent = item.description || 'This achievement has a hidden description.';
  const status = document.querySelector('#achievement-detail-status');
  status.textContent = item.unlocked === true ? '✓ Unlocked' : item.unlocked === false ? 'Locked · Keep playing' : Number.isFinite(item.rarity) ? `${item.rarity}% of Steam players unlocked this · Your progress is not linked` : 'Catalog entry · Your progress is not linked';
  status.classList.toggle('unlocked', item.unlocked === true);
  achievementDialog.showModal();
  setFocusedElement(achievementDialog.querySelector('.primary'), { scroll: false });
}

function showOptionsPage(page) {
  document.querySelectorAll('[data-options-page]').forEach((panel) => { panel.hidden = panel.dataset.optionsPage !== page; });
  document.querySelectorAll('[data-options-tab]').forEach((tab) => {
    const active = tab.dataset.optionsTab === page;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  refreshFocusables();
}

function showGalleryImage(index) {
  if (!state.galleryImages.length) return;
  state.galleryIndex = (index + state.galleryImages.length) % state.galleryImages.length;
  const image = state.galleryImages[state.galleryIndex];
  galleryImage.src = image;
  galleryImage.alt = `${galleryTitle.textContent}, screenshot ${state.galleryIndex + 1}`;
  galleryBackdrop.style.backgroundImage = `url("${image.replaceAll('"', '%22')}")`;
  document.querySelector('#gallery-counter').textContent = `${state.galleryIndex + 1} / ${state.galleryImages.length}`;
  galleryThumbnails.querySelectorAll('.gallery-thumbnail').forEach((thumbnail, thumbnailIndex) => {
    thumbnail.classList.toggle('active', thumbnailIndex === state.galleryIndex);
    if (thumbnailIndex === state.galleryIndex) thumbnail.setAttribute('aria-current', 'true');
    else thumbnail.removeAttribute('aria-current');
  });
  galleryImage.classList.remove('gallery-image-refresh');
  void galleryImage.offsetWidth;
  galleryImage.classList.add('gallery-image-refresh');
}

function renderGalleryThumbnails() {
  galleryThumbnails.innerHTML = state.galleryImages.map((image, index) => `<button class="gallery-thumbnail${index === state.galleryIndex ? ' active' : ''} focusable" type="button" data-action="gallery-select" data-gallery-index="${index}" aria-label="Show screenshot ${index + 1}"${index === state.galleryIndex ? ' aria-current="true"' : ''}><img src="${escapeHtml(image)}" alt="" loading="lazy" /></button>`).join('');
}

function promoteRecentlyLaunchedGame(game) {
  state.games = [game, ...state.games.filter((item) => item.id !== game.id)];
  renderLibrary();
  recentRow.scrollLeft = 0;
}

async function launchSelectedGame(optionsOverride) {
  if (!state.selectedGameId || !launchOverlay.hidden) return;
  const game = state.games.find((item) => item.id === state.selectedGameId);
  if (!game) return;
  if (game.installed === false) {
    try {
      await window.launcher.gameAction(game.id, 'download');
      if (gameOptionsDialog.open) gameOptionsDialog.close();
      showToast(game.provider === 'Epic Games' ? 'Opening Epic Games Launcher — choose the game there to install' : `Opening Steam install options for ${game.title}`);
    } catch (error) { showToast(error.message || 'Could not open Steam install options'); }
    return;
  }
  playUiSound('launch');
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  const launchImage = game.artwork?.hero || game.artwork?.wide || game.artwork?.tile;
  launchArt.style.backgroundImage = launchImage
    ? `url("${launchImage.replaceAll('"', '%22')}")`
    : `radial-gradient(circle at 50% 35%, hsla(${hashHue(game.title)}, 72%, 45%, .75), transparent 48%), linear-gradient(145deg, #172632, #05080b)`;
  const launchId = game.id;
  launchGameLogo.src = game.artwork?.logo || fallbackWordmark(game.title);
  launchGameLogo.onerror = () => { launchGameLogo.src = fallbackWordmark(game.title); };
  launchGameLogo.hidden = false;
  launchingGame.hidden = true;
  if (!game.artwork?.logo) window.launcher.getGameLogo(game.id).then((logo) => {
    if (logo && state.selectedGameId === launchId && !launchOverlay.hidden) {
      launchGameLogo.src = logo;
      game.artwork ||= {};
      game.artwork.logo = logo;
    }
  }).catch(() => {});
  launchOverlay.hidden = false;
  requestAnimationFrame(() => launchOverlay.classList.add('active'));
  let didLaunch = false;
  try {
    await Promise.all([
      window.launcher.launchGame(state.selectedGameId, optionsOverride),
      new Promise((resolve) => setTimeout(resolve, 2100))
    ]);
    didLaunch = true;
    await refreshActiveGameSession();
    game.playCount = (game.playCount || 0) + 1;
    promoteRecentlyLaunchedGame(game);
    showToast(`Launching ${game.title}`);
  } catch (error) {
    showToast(error.message || 'Could not launch this game');
  } finally {
    launchOverlay.classList.remove('active');
    setTimeout(() => { launchOverlay.hidden = true; }, 380);
  }
  if (didLaunch) setTimeout(() => window.launcher.minimizeLauncher().catch(() => {}), 420);
}

function openGameOptions(gameId = state.selectedGameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  state.optionsGameId = game.id;
  const hasSteamActions = game.provider === 'Steam' && Boolean(game.appId);
  const activeCard = document.activeElement?.classList.contains('game-card') && document.activeElement.dataset.gameId === game.id
    ? document.activeElement
    : null;
  if (!game.isApp) selectGame(game.id, false, activeCard);
  document.querySelector('#options-title').textContent = game.title;
  document.querySelector('#options-provider').textContent = game.provider.toUpperCase();
  document.querySelector('#options-status').textContent = `${game.isApp ? 'App' : 'Game'} · ${game.installed === false ? 'Not installed' : 'Ready to launch'}`;
  document.querySelector('#options-manage-subtitle').textContent = game.isCustom ? 'Edit this imported title or open its folder' : `Shortcuts for ${game.provider}`;
  const optionsArtwork = document.querySelector('#options-artwork');
  const optionsArtworkPlaceholder = document.querySelector('#options-artwork-placeholder');
  const artworkUrl = (game.isXboxLauncher ? 'assets/xbox.svg' : game.launcherIcon) || game.artwork?.tile || game.artwork?.grid || game.artwork?.hero || '';
  optionsArtworkPlaceholder.textContent = game.title.toUpperCase();
  optionsArtwork.onerror = () => { optionsArtwork.hidden = true; optionsArtworkPlaceholder.hidden = false; };
  optionsArtwork.hidden = !artworkUrl;
  optionsArtworkPlaceholder.hidden = Boolean(artworkUrl);
  if (artworkUrl) optionsArtwork.src = artworkUrl;
  else optionsArtwork.removeAttribute('src');
  const sourceNames = { 'playstation-store': 'PlayStation Store', ign: 'IGN', 'xbox-catalog': 'Xbox Store', 'steamgriddb-square': 'SteamGridDB square', 'steamgriddb-fallback': 'SteamGridDB fallback', 'steamgriddb-manual': 'Custom artwork' };
  document.querySelector('#options-art-source').textContent = `Cover source: ${sourceNames[game.artwork?.imageSource] || 'No artwork found yet'}`;
  document.querySelector('#steam-management-group').hidden = !hasSteamActions;
  document.querySelector('#view-steam-button').hidden = !hasSteamActions;
  document.querySelector('#view-steam-library-button').hidden = !hasSteamActions;
  document.querySelector('#download-steam-button').hidden = !hasSteamActions || game.installed !== false;
  document.querySelector('#uninstall-steam-button').hidden = !hasSteamActions || game.installed === false;
  document.querySelector('#game-options-form [data-action="options-launch"]').hidden = game.installed === false;
  document.querySelector('#favorite-game-button').innerHTML = `${state.favoriteGameIds.includes(game.id) ? 'Remove from Favorites <span>★</span>' : 'Add to Favorites <span>☆</span>'}`;
  renderGameSessionAction();
  const canOpenFolder = Boolean(game.installPath || game.executable);
  document.querySelector('#open-folder-button').hidden = !canOpenFolder;
  document.querySelector('#options-manage-group').hidden = Boolean(game.isLauncher) && !canOpenFolder && !game.isCustom;
  document.querySelector('#options-manage-empty').hidden = !game.isLauncher || hasSteamActions || canOpenFolder || game.isCustom;
  document.querySelector('#steam-launch-group').hidden = !hasSteamActions || game.installed === false;
  document.querySelector('#edit-custom-button').hidden = !game.isCustom;
  const categoryButton = document.querySelector('#change-category-button');
  categoryButton.hidden = Boolean(game.isLauncher);
  categoryButton.innerHTML = `${game.isApp ? 'Move to Games' : 'Move to Apps'} <span>›</span>`;
  document.querySelector('#steam-launch-options').value = game.launchOptions || '';
  document.querySelector('#achievement-reference-editor').hidden = game.provider === 'Steam';
  document.querySelector('#achievement-reference-id').value = game.achievementReferenceAppId || '';
  document.querySelector('#xbox-achievement-title-id').value = game.xboxAchievementReference?.titleId || '';
  document.querySelector('#xbox-achievement-platform').value = game.xboxAchievementReference?.platform || 'auto';
  document.querySelector('#achievement-links-group').open = false;
  document.querySelector('#achievement-links-group').hidden = Boolean(game.isApp);
  document.querySelector('#options-tab-advanced').hidden = Boolean(game.isApp) && !hasSteamActions;
  showOptionsPage('manage');
  playUiSound('confirm');
  gameOptionsDialog.showModal();
  setTimeout(() => setFocusedElement(gameOptionsDialog.querySelector('.option-button:not([hidden])')), 0);
}

async function openArtworkPicker(gameId = state.selectedGameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  state.artworkGameId = game.id;
  state.artworkChoice = null;
  state.artworkSearch = null;
  state.artworkDraft = { ...(game.artwork || {}) };
  state.artworkSlot = 'tile';
  state.artworkSource = 'community';
  state.officialArtworkRequest = (state.officialArtworkRequest || 0) + 1;
  state.officialArtwork = [];
  state.catalogArtwork = [];
  document.querySelector('#artwork-steam-id').value = game.provider === 'Steam' ? game.appId || '' : '';
  document.querySelector('#official-steam-controls').open = false;
  artworkQuery.value = game.title;
  document.querySelector('#overlay-logo-toggle').checked = game.artwork?.overlayLogo === true;
  artworkResults.innerHTML = '';
  artworkGames.innerHTML = '';
  artworkStatus.textContent = 'Searching SteamGridDB for square artwork…';
  useArtwork.disabled = false;
  renderArtworkSlot();
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  artworkDialog.showModal();
  await runArtworkSearch();
}

function artworkChoicesForSlot() {
  if (state.artworkSource === 'steam') return (state.officialArtwork || []).filter(asset => asset.slot === state.artworkSlot);
  if (['xbox', 'psn', 'ign'].includes(state.artworkSource)) return (state.catalogArtwork || []).filter(asset => asset.slot === state.artworkSlot);
  const result = state.artworkSearch || {};
  if (state.artworkSlot === 'hero') return result.heroChoices || [];
  if (state.artworkSlot === 'logo') return result.logoChoices || [];
  if (state.artworkSlot === 'wide') return (result.choices || []).filter((choice) => choice.width > choice.height * 1.4).concat(result.heroChoices || []);
  return result.choices || [];
}

function renderArtworkSlot() {
  document.querySelector('#official-steam-controls').hidden = state.artworkSource !== 'steam';
  document.querySelector('.artwork-logo-toggle').hidden = state.artworkSlot !== 'tile';
  artworkGames.hidden = state.artworkSource !== 'community';
  document.querySelectorAll('[data-action="artwork-source"]').forEach(button => {
    const active = button.dataset.source === state.artworkSource;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  artworkResults.dataset.slot = state.artworkSlot;
  document.querySelectorAll('.artwork-slot').forEach((button) => button.classList.toggle('active', button.dataset.slot === state.artworkSlot));
  const current = state.artworkDraft?.[state.artworkSlot];
  document.querySelector('#artwork-current').innerHTML = current
    ? `<img src="${escapeHtml(current)}" alt="" /> Current ${escapeHtml(state.artworkSlot)} artwork`
    : `No ${escapeHtml(state.artworkSlot)} artwork selected yet`;
  const choices = artworkChoicesForSlot();
  artworkResults.innerHTML = choices.map((choice, index) => `<button class="artwork-choice focusable${choice.url === current ? ' selected' : ''}" type="button" data-action="select-artwork" data-art-index="${index}" title="${choice.width} × ${choice.height}"><img src="${escapeHtml(choice.url)}" alt="${escapeHtml(state.artworkSlot)} artwork ${index + 1}" /></button>`).join('');
  const sourceName = { steam: 'Official Steam assets', xbox: 'Xbox Store', psn: 'PlayStation Store', ign: 'IGN' }[state.artworkSource] || state.artworkSearch?.game?.name || 'SteamGridDB';
  artworkStatus.textContent = `${choices.length} ${state.artworkSlot} choices · ${sourceName}. Choose an image, then save all artwork.`;
  refreshFocusables();
}

async function runArtworkSearch(gameId = '') {
  const query = artworkQuery.value.trim();
  if (!query) return;
  const request = state.artworkSearchRequest = (state.artworkSearchRequest || 0) + 1;
  artworkStatus.textContent = 'Searching SteamGridDB…';
  artworkGames.innerHTML = '';
  try {
    const result = await window.launcher.searchArtwork(query, gameId);
    if (request !== state.artworkSearchRequest || !artworkDialog.open) return;
    state.artworkSearch = result;
    artworkGames.innerHTML = (result.games || []).map((game) => `<button class="artwork-game-choice focusable${String(result.game?.id) === String(game.id) ? ' active' : ''}" type="button" role="listitem" data-action="select-artwork-game" data-sgdb-game-id="${escapeHtml(game.id)}" title="Match score ${game.matchScore}%">${escapeHtml(game.name)}</button>`).join('');
    renderArtworkSlot();
  } catch (error) {
    artworkStatus.textContent = error.message || 'Artwork search failed.';
  }
}

async function loadCatalogArtwork() {
  const query = artworkQuery.value.trim();
  const source = state.artworkSource;
  if (!query || !['xbox', 'psn', 'ign'].includes(source)) return;
  const request = state.catalogArtworkRequest = (state.catalogArtworkRequest || 0) + 1;
  state.catalogArtwork = [];
  renderArtworkSlot();
  artworkStatus.textContent = `Checking ${source === 'psn' ? 'PlayStation Store' : source === 'xbox' ? 'Xbox Store' : 'IGN'} artwork…`;
  try {
    const choices = await window.launcher.getCatalogArtwork(query, source);
    if (request !== state.catalogArtworkRequest || state.artworkSource !== source || !artworkDialog.open) return;
    state.catalogArtwork = choices;
    renderArtworkSlot();
    if (!choices.length) artworkStatus.textContent = 'No confident artwork match found for this name. Try another search or source.';
  } catch (error) { if (request === state.catalogArtworkRequest) artworkStatus.textContent = error.message || 'Artwork source unavailable.'; }
}

async function saveArtworkChoice() {
  if (!state.artworkGameId || !state.artworkDraft) return;
  const result = state.artworkSearch;
  try {
    await window.launcher.saveArtwork(state.artworkGameId, {
      ...state.artworkDraft,
      overlayLogo: document.querySelector('#overlay-logo-toggle').checked,
      sgdbGameId: result?.game?.id || state.artworkDraft.sgdbGameId
    });
    artworkDialog.close();
    await scanLibrary(false);
    showToast('Artwork updated');
  } catch (error) {
    showToast(error.message || 'Could not save artwork');
  }
}

function openCustomGameEditor(game) {
  if (!game) return;
  state.customDraft = { ...game };
  state.customArtworkSearch = null;
  state.customArtworkChoice = null;
  document.querySelector('#custom-game-heading').textContent = game.isCustom && state.games.some((item) => item.id === game.id) ? 'Edit custom game' : 'Import custom game';
  document.querySelector('#custom-game-path').textContent = game.executable;
  customGameName.value = game.title;
  document.querySelector('#custom-game-type').value = game.isApp ? 'app' : 'game';
  customArtworkQueryLabel.textContent = `Searching for “${game.title}”`;
  customArtworkGames.innerHTML = '';
  customArtworkResults.innerHTML = '';
  customArtworkStatus.textContent = 'Choose a matching game and cover. Your name stays as typed, and the artwork saves with the import.';
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  if (settingsDialog.open) settingsDialog.close();
  customGameDialog.showModal();
  setTimeout(() => setFocusedElement(customGameName), 0);
  runCustomArtworkSearch();
}

async function runCustomArtworkSearch(sgdbGameId = '') {
  const query = customGameName.value.trim();
  if (!query || !customGameDialog.open) return;
  const sequence = ++customArtworkSearchSequence;
  customArtworkQueryLabel.textContent = `Artwork for “${query}”`;
  customArtworkStatus.textContent = 'Searching SteamGridDB…';
  try {
    const result = await window.launcher.searchArtwork(query, sgdbGameId);
    if (!customGameDialog.open || sequence !== customArtworkSearchSequence || query !== customGameName.value.trim()) return;
    state.customArtworkSearch = result;
    state.customArtworkChoice = null;
    customArtworkGames.innerHTML = (result.games || []).map((game) => `<button class="artwork-game-choice focusable${String(result.game?.id) === String(game.id) ? ' active' : ''}" type="button" data-action="select-custom-artwork-game" data-sgdb-game-id="${escapeHtml(game.id)}">${escapeHtml(game.name)}</button>`).join('');
    customArtworkResults.innerHTML = (result.choices || []).map((choice, index) => `<button class="artwork-choice focusable" type="button" data-action="select-custom-artwork" data-art-index="${index}" title="${choice.width} × ${choice.height}"><img src="${escapeHtml(choice.url)}" alt="Artwork option ${index + 1}" /></button>`).join('');
    const firstSquare = result.choices?.findIndex((choice) => choice.tileIsSquare) ?? -1;
    const selectedIndex = firstSquare >= 0 ? firstSquare : result.choices?.length ? 0 : -1;
    if (selectedIndex >= 0) {
      state.customArtworkChoice = result.choices[selectedIndex];
      customArtworkResults.children[selectedIndex]?.classList.add('selected');
    }
    customArtworkStatus.textContent = result.game
      ? `${result.game.name} · ${result.choices?.length || 0} artwork choices. The selected image will be saved with this game.`
      : 'No matches found. Try another name or save the game without artwork.';
    refreshFocusables();
  } catch (error) { customArtworkStatus.textContent = error.message || 'Artwork search failed. You can still save the game.'; }
}

function openControllerKeyboard(target) {
  if (!(target instanceof HTMLInputElement) || !['text', 'search', 'password', 'number'].includes(target.type) || keyboardDialog.open) return;
  state.keyboardTarget = target;
  state.keyboardShift = false;
  keyboardPreview.textContent = target.value || 'Type to search…';
  keyboardDialog.showModal();
  setTimeout(() => setFocusedElement(keyboardKeys.querySelector('.keyboard-key')), 0);
}

function typeControllerKey(key) {
  const target = state.keyboardTarget;
  if (!target) return;
  if (key === 'done' || key === 'enter') {
    keyboardDialog.close();
    if (target === customGameName) setTimeout(() => runCustomArtworkSearch(), 0);
    return;
  }
  if (key === 'shift') { state.keyboardShift = !state.keyboardShift; return; }
  if (key === 'left' || key === 'right') {
    const next = Math.max(0, Math.min(target.value.length, (target.selectionStart ?? target.value.length) + (key === 'left' ? -1 : 1)));
    target.setSelectionRange(next, next);
    return;
  }
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  if (key === 'backspace') target.setRangeText('', Math.max(0, start === end ? start - 1 : start), end, 'end');
  else if (key === 'clear') target.value = '';
  else target.setRangeText(key === 'space' ? ' ' : state.keyboardShift ? key.toUpperCase() : key, start, end, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
  keyboardPreview.textContent = target.value || 'Type to search…';
}

const keyboardRows = [
  [['Clear', 'clear', 'side'], ...[...'1234567890'].map((key) => [key, key]), ['⌫', 'backspace', 'side']],
  [['‹', 'left', 'side'], ...[...'QWERTYUIOP'].map((key) => [key, key.toLowerCase()]), ['›', 'right', 'side']],
  [['⇧', 'shift', 'side'], ...[...'ASDFGHJKL'].map((key) => [key, key.toLowerCase()]), ['.', '.'], ['↵', 'enter', 'side']],
  [['⇧', 'shift', 'side'], ...[...'ZXCVBNM'].map((key) => [key, key.toLowerCase()]), [',', ','], [';', ';'], [':', ':'], ['!', '!']]
];
keyboardKeys.innerHTML = keyboardRows.map((row) => row.map(([label, key, cls]) => `<button class="keyboard-key focusable ${cls || ''}" type="button" data-action="keyboard-key" data-key="${key}">${label}</button>`).join('')).join('') +
  '<button class="keyboard-key wide focusable" type="button" data-action="keyboard-key" data-key="clear">Clear</button><button class="keyboard-key space focusable" type="button" data-action="keyboard-key" data-key="space">Space</button><button class="keyboard-key wide focusable" type="button" data-action="keyboard-key" data-key="done">Done</button>';

async function scanLibrary(refreshArt = false, fullScreenImport = false, backgroundRefresh = false) {
  state.backgroundLibraryRefresh = backgroundRefresh;
  heroSubtitle.textContent = refreshArt ? 'Refreshing your game artwork…' : 'Scanning Steam and Epic Games…';
  scanProgress.classList.toggle('background-refresh', backgroundRefresh);
  showActivity(backgroundRefresh ? 'Updating your library' : 'Importing your library', 'Starting library discovery…', 0);
  state.fullScreenImport = Boolean(fullScreenImport);
  if (state.fullScreenImport) {
    importingScreen.hidden = false;
    importingScreen.setAttribute('aria-hidden', 'false');
    document.querySelector('#importing-message').textContent = 'Finding the games on this PC…';
    document.querySelector('#importing-percent').textContent = '0%';
    document.querySelector('#importing-fill').style.width = '0%';
    requestAnimationFrame(() => importingScreen.classList.add('visible'));
  }
  try {
    const result = await window.launcher.scanLibrary({ refreshArt });
    applyLibraryResult(result, backgroundRefresh);
    if (!backgroundRefresh && getConnectedControllers().length && !document.querySelector('dialog[open]') && navPanel.hidden) {
      const target = [...document.querySelectorAll('.game-card.focusable')].find((element) => element.dataset.gameId === state.selectedGameId && element.offsetParent !== null)
        || (state.view === 'library' ? libraryGrid.querySelector('.game-card.focusable') : recentRow.querySelector('.game-card.focusable'));
      if (target) setFocusedElement(target);
    }
    if (!backgroundRefresh) showToast(`${state.games.length} library item${state.games.length === 1 ? '' : 's'} ready`);
    if (state.fullScreenImport) {
      importingScreen.classList.remove('visible');
      setTimeout(() => { importingScreen.hidden = true; importingScreen.setAttribute('aria-hidden', 'true'); state.fullScreenImport = false; }, 520);
    }
  } catch (error) {
    showToast(error.message || 'Could not scan your library');
    showActivity('Library update failed', error.message || 'Could not scan your library. Try again when ready.', null, 9000, 'error');
    if (state.fullScreenImport) {
      importingScreen.classList.remove('visible');
      setTimeout(() => { importingScreen.hidden = true; importingScreen.setAttribute('aria-hidden', 'true'); state.fullScreenImport = false; }, 520);
    }
  } finally {
    state.backgroundLibraryRefresh = false;
  }
}

function applyPersonalization(settings) {
  document.documentElement.style.setProperty('--tile-radius', `${Number(settings.tileRadius ?? 8)}px`);
  document.documentElement.style.setProperty('--text-scale', String(Math.max(1, Math.min(1.3, Number(settings.textScale) || 1))));
  document.documentElement.classList.toggle('high-contrast-focus', Boolean(settings.highContrastFocus));
  document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reducedMotion));
}

async function openSettings() {
  const settings = await window.launcher.getSettings();
  const previewGame = state.games.find((game) => game.id === state.selectedGameId) || state.games[0];
  const previewTile = document.querySelector('#appearance-preview-tile');
  const previewUrl = previewGame?.artwork?.tile;
  previewTile.style.backgroundImage = previewUrl ? `linear-gradient(0deg,#0009,transparent 58%),url("${previewUrl.replaceAll('"', '%22')}")` : '';
  document.querySelector('#appearance-preview-title').textContent = previewGame?.title || 'Your game';
  state.settingsOriginal = { uiScale: settings.uiScale || 1, tileRadius: settings.tileRadius ?? 8, reducedMotion: Boolean(settings.reducedMotion), textScale: settings.textScale || 1, highContrastFocus: Boolean(settings.highContrastFocus), steamGridDbKey: settings.steamGridDbKey || '' };
  state.settingsSaved = false;
  state.soundEffects = settings.soundEffects !== false;
  state.showUninstalledSteam = settings.showUninstalledSteam === true;
  state.showUninstalledEpic = settings.showUninstalledEpic === true;
  state.steamBannerDismissed = settings.steamBannerDismissed === true;
  document.querySelector('#sgdb-key').value = settings.steamGridDbKey || '';
  document.querySelector('#steam-api-key').value = settings.steamApiKey || '';
  document.querySelector('#xbox-api-key').value = settings.xboxApiKey || '';
  document.querySelector('#steam-id64').value = settings.steamId64 || '';
  document.querySelector('#show-uninstalled-toggle').checked = settings.showUninstalledSteam === true;
  document.querySelector('#show-uninstalled-epic-toggle').checked = settings.showUninstalledEpic === true;
  document.querySelector('#legendary-path').value = settings.legendaryPath || '';
  refreshEpicHelperStatus().catch(() => {});
  updateUninstalledRequirement('steam-api-key', 'show-uninstalled-toggle');
  renderSteamConnectionStatus();
  renderEpicConnectionStatus();
  if (state.steamLocalStatus) renderSteamLocalStatus('#settings-steam-local-status');
  else window.launcher.getSteamLocalStatus().then((status) => { state.steamLocalStatus = status; renderSteamLocalStatus('#settings-steam-local-status'); }).catch(() => {});
  document.querySelector('#fullscreen-toggle').checked = settings.fullscreen;
  document.querySelector('#sound-toggle').checked = state.soundEffects;
  document.querySelector('#ui-scale').value = String(Math.round((settings.uiScale || 1) * 100));
  document.querySelector('#scale-value').textContent = `${Math.round((settings.uiScale || 1) * 100)}%`;
  document.querySelector('#tile-radius').value = String(settings.tileRadius ?? 8);
  document.querySelector('#radius-value').textContent = `${settings.tileRadius ?? 8} px`;
  document.querySelector('#reduced-motion-toggle').checked = Boolean(settings.reducedMotion);
  document.querySelector('#text-size').value = String(Math.round((settings.textScale || 1) * 100));
  document.querySelector('#text-size-value').textContent = `${Math.round((settings.textScale || 1) * 100)}%`;
  document.querySelector('#high-contrast-focus-toggle').checked = Boolean(settings.highContrastFocus);
  document.querySelector('#random-screenshot-background-toggle').checked = settings.useRandomScreenshotBackground !== false;
  state.useRandomScreenshotBackground = settings.useRandomScreenshotBackground !== false;
  document.querySelector('#shuffle-home-screenshots-toggle').checked = settings.shuffleHomeScreenshots !== false;
  state.shuffleHomeScreenshots = settings.shuffleHomeScreenshots !== false;
  settingsDialog.showModal();
  renderSettingsLauncherSummary();
  showSettingsPage('experience');
  setTimeout(() => setFocusedElement(document.querySelector('.settings-tab.active'), { scroll: false }), 0);
}

function showView(view) {
  state.view = view;
  const isLibrary = view === 'library';
  const isDetail = view === 'detail';
  document.body.classList.toggle('detail-active', isDetail);
  document.body.classList.toggle('home-active', view === 'home');
  document.querySelector('main').hidden = state.games.length === 0 && !isLibrary && !isDetail;
  const hasHomeGames = state.games.some((game) => !game.isApp && (game.installed !== false || state.searchQuery));
  emptyState.hidden = isLibrary || isDetail || hasHomeGames;
  homeView.hidden = isLibrary || isDetail;
  libraryView.hidden = !isLibrary;
  gameDetailView.hidden = !isDetail;
  document.querySelectorAll('.top-nav-button').forEach((button) => button.classList.toggle('active', button.dataset.action === view));
  const mainScroller = document.querySelector('main');
  if (isDetail) {
    mainScroller.style.scrollBehavior = 'auto';
    mainScroller.scrollTop = 0;
    gameDetailView.scrollTop = 0;
    requestAnimationFrame(() => mainScroller.style.removeProperty('scroll-behavior'));
  } else mainScroller?.scrollTo({ top: 0, behavior: 'smooth' });
  closeNav();
  updateControllerPrompts();
  refreshFocusables();
  const first = isDetail ? gameDetailView.querySelector('#detail-play')
    : isLibrary ? libraryView.querySelector(`.game-card[data-game-id="${CSS.escape(state.selectedGameId || '')}"]`) || libraryView.querySelector('.library-tab')
      : recentRow.querySelector(`.game-card[data-game-id="${CSS.escape(state.selectedGameId || '')}"]`) || recentRow.querySelector('.focusable');
  if (first) setFocusedElement(first, { scroll: !isDetail });
}

function closeNav() {
  navPanel.hidden = true;
  document.querySelector('#nav-scrim').hidden = true;
  brandButton.setAttribute('aria-expanded', 'false');
  updateControllerPrompts();
  const target = [...document.querySelectorAll('.game-card.focusable')]
    .find((element) => element.dataset.gameId === state.selectedGameId && element.offsetParent !== null) || brandButton;
  setFocusedElement(target);
}

function toggleNav() {
  if (!navPanel.hidden) {
    closeNav();
    return;
  }
  const recent = state.games.find((game) => !game.isApp && game.playCount > 0) || state.games.find((game) => !game.isApp);
  if (recent) {
    const image = recent.artwork?.tile || recent.artwork?.grid;
    const backdrop = recent.artwork?.hero || recent.artwork?.wide || image;
    document.querySelector('#nav-feature-bg').style.backgroundImage = backdrop ? `url("${backdrop.replaceAll('"', '%22')}")` : '';
    document.querySelector('#nav-feature-art').innerHTML = gameArt(recent);
    document.querySelector('#nav-feature-title').textContent = recent.title;
    document.querySelector('#nav-feature-last').textContent = recent.playCount ? `Played ${recent.playCount} time${recent.playCount === 1 ? '' : 's'} here` : 'Ready to play';
    document.querySelector('#nav-achievements').hidden = true;
    window.launcher.getGameAchievements(recent.id).then((result) => {
      if (navPanel.hidden || !result.progressAvailable || !result.items?.length) return;
      const unlocked = result.items.filter((item) => item.unlocked === true).length;
      document.querySelector('#nav-achievements').hidden = false;
      document.querySelector('#nav-achievement-count').textContent = `🏆 ${unlocked}/${result.items.length} achievements · ${Math.round(unlocked / result.items.length * 100)}%`;
      document.querySelector('#nav-achievement-fill').style.width = `${Math.round(unlocked / result.items.length * 100)}%`;
    }).catch(() => {});
  }
  navPanel.hidden = false;
  document.querySelector('#nav-scrim').hidden = false;
  brandButton.setAttribute('aria-expanded', 'true');
  updateControllerPrompts();
  const first = navPanel.querySelector('.focusable');
  if (first) setFocusedElement(first);
}

function showPowerChoices() {
  selectedPowerAction = null;
  powerConfirm.hidden = true;
  powerChoices.hidden = false;
  document.querySelector('#power-error').hidden = true;
  setFocusedElement(powerChoices.querySelector('.power-choice'));
}

function showPowerConfirmation(action) {
  const choices = {
    sleep: ['Sleep this PC?', 'Your games and apps stay open. Windows may require sign-in when you return.', 'Sleep'],
    hibernate: ['Hibernate this PC?', 'Windows saves your session to disk and turns off this PC. Hibernate must be enabled in Windows.', 'Hibernate'],
    restart: ['Restart this PC?', 'Windows will close your games and apps. Save your work first.', 'Restart'],
    shutdown: ['Shut down this PC?', 'Windows will close your games and apps and turn off this PC. Save your work first.', 'Shut down'],
    exit: ['Exit the launcher?', 'The launcher will close. Windows and your other apps will keep running.', 'Exit launcher']
  };
  if (!Object.hasOwn(choices, action)) return;
  selectedPowerAction = action;
  const [title, copy, label] = choices[action];
  document.querySelector('#power-confirm-title').textContent = title;
  document.querySelector('#power-confirm-copy').textContent = copy;
  document.querySelector('#power-confirm-button').textContent = label;
  document.querySelector('#power-error').hidden = true;
  powerChoices.hidden = true;
  powerConfirm.hidden = false;
  setFocusedElement(powerConfirm.querySelector('[data-action="power-back"]'));
}

async function performAction(action, source) {
  if (action === 'toggle-favorite') {
    try {
      const organized = await window.launcher.organizeLibrary('favorite', { gameId: state.optionsGameId });
      state.favoriteGameIds = organized.favoriteGameIds;
      state.customCollections = organized.customCollections;
      document.querySelector('#favorite-game-button').innerHTML = `${state.favoriteGameIds.includes(state.optionsGameId) ? 'Remove from Favorites <span>★</span>' : 'Add to Favorites <span>☆</span>'}`;
      renderLibrary();
      showToast(state.favoriteGameIds.includes(state.optionsGameId) ? 'Added to Favorites' : 'Removed from Favorites');
    } catch (error) { showToast(error.message || 'Could not update Favorites'); }
    return;
  }
  if (action === 'edit-game-collections') {
    gameOptionsDialog.close();
    renderCollectionsDialog();
    collectionsDialog.showModal();
    setTimeout(() => setFocusedElement(collectionsDialog.querySelector('.collection-member') || document.querySelector('#collection-name')), 0);
    return;
  }
  if (action === 'collections-close') { collectionsDialog.close(); return; }
  if (action === 'collection-membership' || action === 'collection-delete') {
    try {
      const collection = state.customCollections.find((item) => item.id === source.dataset.collectionId);
      if (action === 'collection-delete' && source.dataset.confirm !== 'true') {
        source.dataset.confirm = 'true';
        source.textContent = 'Delete?';
        source.setAttribute('aria-label', `Confirm deletion of ${collection?.name || 'collection'}`);
        return;
      }
      const result = await window.launcher.organizeLibrary(action === 'collection-delete' ? 'delete' : 'membership', { collectionId: source.dataset.collectionId, gameId: state.optionsGameId });
      state.favoriteGameIds = result.favoriteGameIds;
      state.customCollections = result.customCollections;
      renderCollectionsDialog();
      renderLibrary();
      showToast(action === 'collection-delete' ? 'Collection deleted' : 'Collection updated');
    } catch (error) { showToast(error.message || 'Could not update collection'); }
    return;
  }
  if (action === 'return-to-game') {
    if (gameOptionsDialog.open) gameOptionsDialog.close();
    try { await window.launcher.returnToGame(state.activeGameSession?.gameId); }
    catch (error) { showToast(error.message || 'Could not return to that game'); await refreshActiveGameSession(); }
    return;
  }
  if (action === 'power-menu') { powerDialog.showModal(); showPowerChoices(); return; }
  if (action === 'power-close') { powerDialog.close(); return; }
  if (action === 'power-select') { showPowerConfirmation(source.dataset.power); return; }
  if (action === 'power-back') { showPowerChoices(); return; }
  if (action === 'power-confirm') {
    if (!selectedPowerAction || powerActionPending) return;
    powerActionPending = true;
    const confirmButton = document.querySelector('#power-confirm-button');
    confirmButton.disabled = true;
    try {
      if (selectedPowerAction === 'exit') await window.launcher.quit();
      else await window.launcher.powerAction(selectedPowerAction);
      powerDialog.close();
      showToast('Power action sent to Windows');
    } catch (error) {
      const errorMessage = document.querySelector('#power-error');
      errorMessage.textContent = error.message || 'Windows could not complete this power action.';
      errorMessage.hidden = false;
    } finally {
      powerActionPending = false;
      confirmButton.disabled = false;
    }
    return;
  }
  if (action === 'close-nav') { closeNav(); return; }
  if (action === 'controller-status') { openControllerStatus(); return; }
  if (action === 'controller-status-close') { controllerStatusDialog.close(); return; }
  if (action === 'controller-recheck') {
    const devices = refreshControllerStatus();
    if (devices.length) showToast('Controller connected · input is ready');
    else {
      document.querySelector('#controller-status-copy').textContent = 'Press any button on your controller to wake it. This screen will update automatically when the controller connects.';
      showToast('Waiting for controller input');
    }
    return;
  }
  if (action === 'recently-played') {
    showView('home');
    document.querySelector('#recent-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (action === 'give-feedback') { await window.launcher.openFeedback(); closeNav(); return; }
  if (action === 'avatar-picker') {
    state.profileOriginal = { avatarId: selectedAvatarId, displayName: state.displayName, avatarImage: customAvatarData };
    document.querySelector('#profile-name-input').value = state.displayName;
    document.querySelector('#profile-name-heading').textContent = state.displayName;
    const games = state.games.filter((game) => !game.isApp);
    const art = games.find((game) => game.id === state.selectedGameId)?.artwork;
    const profileBackground = art?.hero || art?.wide || '';
    document.querySelector('.profile-hero').style.setProperty('--profile-art', profileBackground ? `url("${profileBackground.replaceAll('"', '%22')}")` : 'none');
    document.querySelector('#profile-library-count').textContent = String(games.length);
    document.querySelector('#profile-installed-count').textContent = String(games.filter((game) => game.installed !== false).length);
    document.querySelector('#profile-launch-count').textContent = String(games.reduce((total, game) => total + (Number(game.playCount) || 0), 0));
    const providerCount = new Set(games.map((game) => game.provider).filter(Boolean)).size;
    document.querySelector('#profile-source-count').textContent = `${providerCount} store${providerCount === 1 ? '' : 's'}`;
    const recent = games.filter(game => game.playCount > 0).slice(0,4);
    const previewGames = games.slice(0, 3);
    document.querySelector('#profile-recent-games').innerHTML = recent.length ? recent.map(game => `<button class="profile-recent-game focusable" data-action="profile-game" data-game-id="${escapeHtml(game.id)}">${game.artwork?.tile ? `<img src="${escapeHtml(game.artwork.tile)}" alt="" />` : ''}<span><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.provider)}</small></span><span aria-hidden="true">›</span></button>`).join('')
      : `<div class="profile-empty"><div class="profile-empty-art" aria-hidden="true">${previewGames.length ? previewGames.map(game => `<span>${game.artwork?.tile ? `<img src="${escapeHtml(game.artwork.tile)}" alt="" />` : `<b>${escapeHtml(game.title)}</b>`}</span>`).join('') : '<span>✦</span><span>◇</span><span>✦</span>'}</div><div class="profile-empty-copy"><span class="eyebrow">YOUR NEXT CHAPTER</span><strong>Your story starts here</strong><p>Pick a game and your recently played collection will grow with you.</p><button class="focusable" type="button" data-action="profile-library">Explore your library <span aria-hidden="true">›</span></button></div></div>`;
    showProfilePage('overview');
    avatarDialog.showModal();
    setTimeout(() => setFocusedElement(document.querySelector('.profile-tabs .active'), { scroll: false }), 0);
    return;
  }
  if (action === 'avatar-close') {
    if (state.profileOriginal) {
      selectedAvatarId = state.profileOriginal.avatarId;
      state.displayName = state.profileOriginal.displayName;
      customAvatarData = state.profileOriginal.avatarImage || '';
      renderAvatarChoices();
      state.profileOriginal = null;
    }
    avatarDialog.close();
    return;
  }
  if (action === 'profile-tab') { showProfilePage(source.dataset.page); return; }
  if (action === 'profile-game') { avatarDialog.close(); openGameDetails(source.dataset.gameId); return; }
  if (action === 'browse-collection') {
    state.collectionFilter = source.dataset.collection;
    state.libraryCategory = 'games'; state.libraryTab = 'full-library'; state.installFilter = 'installed'; state.sourceFilter = 'all';
    document.querySelector('#library-collection').value = state.collectionFilter;
    showView('library'); return;
  }
  if (action === 'profile-save') {
    const displayName = document.querySelector('#profile-name-input').value.trim().slice(0, 32) || 'Player';
    try {
      await window.launcher.saveSettings({ avatarId: selectedAvatarId, avatarImage: selectedAvatarId === 'custom-uploaded' ? customAvatarData : '', displayName });
      state.displayName = displayName;
      state.profileOriginal = null;
      document.querySelector('#profile-button').title = displayName;
      document.querySelector('#profile-name-heading').textContent = displayName;
      renderAvatarChoices();
      avatarDialog.close();
      showToast('Player profile saved');
    } catch (error) { showToast(error.message || 'Could not save player profile'); }
    return;
  }
  if (action === 'profile-library') { avatarDialog.close(); showView('library'); return; }
  if (action === 'profile-settings') { avatarDialog.close(); await openSettings(); return; }
  if (action === 'choose-custom-gamerpic') { document.querySelector('#gamerpic-file-input').click(); return; }
  if (action === 'settings-tab') { showSettingsPage(source.dataset.settingsTab); setFocusedElement(source, { scroll: false }); return; }
  if (action === 'options-tab') { showOptionsPage(source.dataset.optionsTab); setFocusedElement(source, { scroll: false }); return; }
  if (action === 'achievement-open') { openAchievement(Number(source.dataset.achievementIndex)); return; }
  if (action === 'achievement-close') { achievementDialog.close(); return; }
  if (action === 'choose-avatar') {
    selectedAvatarId = source.dataset.avatarId;
    renderAvatarChoices();
    return;
  }
  if (action === 'onboard-next') { showOnboardingStep(state.onboardingStep + 1); return; }
  if (action === 'onboard-back') { showOnboardingStep(state.onboardingStep - 1); return; }
  if (action === 'onboard-finish') {
    try {
      const displayName = document.querySelector('#onboard-name').value.trim() || 'Player';
      const saved = await window.launcher.saveSettings({
        onboardingComplete: true,
        avatarId: selectedAvatarId,
        avatarImage: selectedAvatarId === 'custom-uploaded' ? customAvatarData : '',
        displayName,
        steamGridDbKey: document.querySelector('#onboard-sgdb-key').value.trim(),
        steamApiKey: document.querySelector('#onboard-steam-key').value.trim(),
        xboxApiKey: document.querySelector('#onboard-xbox-key').value.trim(),
        steamId64: document.querySelector('#onboard-steam-id').value.trim(),
        showUninstalledSteam: document.querySelector('#onboard-uninstalled').checked && Boolean(document.querySelector('#onboard-steam-key').value.trim())
      });
      state.showUninstalledSteam = saved.showUninstalledSteam;
      state.displayName = displayName;
      document.querySelector('#profile-button').title = displayName;
      onboardingDialog.close();
      await scanLibrary(false, true);
    } catch (error) { showToast(error.message || 'Could not save setup'); }
    return;
  }
  if (action === 'keyboard-key') { typeControllerKey(source.dataset.key); return; }
  if (action === 'keyboard-done') { keyboardDialog.close(); return; }
  if (action === 'cancel-custom') { customGameDialog.close(); return; }
  if (action === 'toggle-search') {
    searchPopover.hidden = !searchPopover.hidden;
    if (!searchPopover.hidden) {
      if (state.controllerClick) openControllerKeyboard(librarySearch);
      else librarySearch.focus();
    }
    return;
  }
  if (action === 'toggle-nav') {
    toggleNav();
    return;
  }
  if (action === 'select-game') {
    selectGame(source.dataset.gameId, false, source);
    openGameDetails(source.dataset.gameId);
    return;
  }
  if (action === 'select-app') { openGameOptions(source.dataset.gameId); return; }
  if (action === 'play-selected') {
    openGameDetails(state.selectedGameId);
    return;
  }
  if (action === 'detail-play') {
    if (source.dataset.returnGame === 'true') { await performAction('return-to-game', source); return; }
    const discovery = Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(item => item.id === state.detailGameId);
    if (discovery) { await window.launcher.openSteamStore(discovery.appId); return; }
    state.selectedGameId = state.detailGameId; await launchSelectedGame(); return;
  }
  if (action === 'discovery-game') { openGameDetails(source.dataset.gameId); return; }
  if (action === 'detail-options') { openGameOptions(state.detailGameId); return; }
  if (action === 'detail-description-more') {
    const description = document.querySelector('#detail-full-description');
    const clamped = description.classList.toggle('clamped');
    source.textContent = clamped ? 'View more' : 'View less';
    return;
  }
  if (action === 'detail-gallery-select') {
    const game = state.games.find((item) => item.id === state.detailGameId);
    galleryTitle.textContent = game?.title || 'Screenshots';
    state.galleryIndex = Number(source.dataset.galleryIndex) || 0;
    renderGalleryThumbnails();
    showGalleryImage(state.galleryIndex);
    galleryDialog.showModal();
    setTimeout(() => setFocusedElement(galleryDialog.querySelector('[data-action="gallery-close"]')), 0);
    return;
  }
  if (action === 'achievement-filter') {
    state.achievementFilter = source.dataset.filter;
    state.achievementsExpanded = false;
    renderAchievements();
    setFocusedElement(source);
    return;
  }
  if (action === 'achievement-more') { state.achievementsExpanded = !state.achievementsExpanded; renderAchievements(); return; }
  if (action === 'open-trueachievements') {
    try { await window.launcher.openTrueAchievements(state.detailGameId); }
    catch (error) { showToast(error.message || 'Could not open TrueAchievements'); }
    return;
  }
  if (action === 'xbox-open-api-key') {
    try { await window.launcher.openSteamHelp('xboxApiKey'); }
    catch (error) { showToast(error.message || 'Could not open OpenXBL'); }
    return;
  }
  if (action === 'choose-legendary') {
    try {
      const selected = await window.launcher.chooseEpicHelper();
      if (selected) { document.querySelector('#legendary-path').value = selected; await refreshEpicHelperStatus(); }
    } catch (error) { showToast(error.message || 'Could not choose Legendary'); }
    return;
  }
  if (action === 'epic-helper-help') { await window.launcher.openSteamHelp('epicHelper'); return; }
  if (action === 'gallery-close') { galleryDialog.close(); return; }
  if (action === 'gallery-prev') { showGalleryImage(state.galleryIndex - 1); return; }
  if (action === 'gallery-next') { showGalleryImage(state.galleryIndex + 1); return; }
  if (action === 'gallery-select') { showGalleryImage(Number(source.dataset.galleryIndex) || 0); return; }
  if (action === 'settings') await openSettings();
  if (action === 'steam-setup') { await openSettings(); showSettingsPage('services'); }
  if (action === 'settings-open-apps') {
    settingsDialog.close();
    state.libraryCategory = 'apps';
    state.libraryTab = 'my-games';
    state.collectionFilter = 'all';
    state.installFilter = 'all';
    state.sourceFilter = 'all';
    document.querySelector('#library-collection').value = 'all';
    document.querySelector('#library-source-filter').value = 'all';
    showView('library');
    return;
  }
  if (action === 'settings-open-profile') { settingsDialog.close(); performAction('avatar-picker', source); return; }
  if (action === 'dismiss-steam-banner') {
    state.steamBannerDismissed = true;
    document.querySelector('#steam-connection-banner').hidden = true;
    window.launcher.saveSettings({ steamBannerDismissed: true }).catch(() => {});
    return;
  }
  if (action === 'clear-custom-artwork' || action === 'reset-launcher-data') {
    state.resetKind = action;
    const all = action === 'reset-launcher-data';
    document.querySelector('#reset-confirm-title').textContent = all ? 'Reset Xbox Preview UI?' : 'Clear chosen artwork?';
    document.querySelector('#reset-confirm-copy').textContent = all
      ? 'This removes your local profile, preferences, custom games and apps, saved artwork, API keys, and play history. Installed games are not deleted. This cannot be undone.'
      : 'This removes only artwork you chose manually. Automatic artwork will be fetched again. Your games and other settings stay as they are.';
    resetConfirmDialog.showModal();
    setTimeout(() => setFocusedElement(resetConfirmDialog.querySelector('[data-action="cancel-reset"]')), 0);
    return;
  }
  if (action === 'cancel-reset') { resetConfirmDialog.close(); return; }
  if (action === 'confirm-reset') {
    const kind = state.resetKind;
    resetConfirmDialog.querySelector('[data-action="confirm-reset"]').disabled = true;
    try {
      if (kind === 'reset-launcher-data') {
        await window.launcher.resetLauncherData();
        window.location.reload();
      } else if (kind === 'clear-custom-artwork') {
        const count = await window.launcher.clearCustomArtwork();
        resetConfirmDialog.close();
        settingsDialog.close();
        await scanLibrary(false);
        showToast(`${count} chosen artwork ${count === 1 ? 'entry' : 'entries'} cleared`);
      }
    } catch (error) { showToast(error.message || 'Could not reset local data'); }
    finally { resetConfirmDialog.querySelector('[data-action="confirm-reset"]').disabled = false; }
    return;
  }
  if (action === 'steam-open-privacy' || action === 'steam-open-api-key' || action === 'steam-open-client') {
    try { await window.launcher.openSteamHelp(action === 'steam-open-privacy' ? 'privacy' : action === 'steam-open-client' ? 'client' : 'apiKey'); }
    catch (error) { showToast(error.message || 'Could not open Steam help'); }
    if (action === 'steam-open-client') setTimeout(refreshSteamLocalStatus, 2500);
  }
  if (action === 'sgdb-open-api-key') {
    try { await window.launcher.openSteamHelp('sgdbApiKey'); }
    catch (error) { showToast(error.message || 'Could not open SteamGridDB'); }
    return;
  }
  if (action === 'open-fse-setup') {
    try { await window.launcher.openFseSetup(); }
    catch (error) { showToast(error.message || 'Could not open Xbox Mode setup'); }
  }
  if (action === 'rescan') await scanLibrary(false);
  if (action === 'add-game') {
    const added = await window.launcher.addGame();
    if (added) openCustomGameEditor(added);
  }
  if (action === 'bulk-import') {
    try {
      const result = await window.launcher.bulkAddGames();
      if (!result.canceled) {
        settingsDialog.close();
        showToast(`${result.added} games imported${result.truncated ? ' · folder scan limit reached' : ''}`);
        await scanLibrary(false);
      }
    } catch (error) { showToast(error.message || 'Folder import failed'); }
  }
  if (action === 'edit-custom') openCustomGameEditor(state.games.find((item) => item.id === state.optionsGameId));
  if (action === 'search-custom-artwork') await runCustomArtworkSearch();
  if (action === 'select-custom-artwork-game') await runCustomArtworkSearch(source.dataset.sgdbGameId);
  if (action === 'select-custom-artwork') {
    state.customArtworkChoice = state.customArtworkSearch?.choices[Number(source.dataset.artIndex)] || null;
    customArtworkResults.querySelectorAll('.artwork-choice').forEach((item) => item.classList.toggle('selected', item === source));
  }
  if (action === 'open-news') {
    const item = state.newsCache.get(state.selectedGameId)?.items?.[Number(source.dataset.newsIndex)];
    if (!item) return;
    const game = state.games.find((entry) => entry.id === state.selectedGameId);
    document.querySelector('#news-preview-art').src = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(game.appId)}/header.jpg`;
    document.querySelector('#news-preview-title').textContent = item.title;
    document.querySelector('#news-preview-date').textContent = item.date ? new Date(item.date * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    document.querySelector('#news-preview-text').textContent = item.contents || 'No preview text is available for this update.';
    newsPreviewDialog.showModal();
    setTimeout(() => setFocusedElement(newsPreviewDialog.querySelector('.news-preview-close')), 0);
    return;
  }
  if (action === 'close-news-preview') { newsPreviewDialog.close(); return; }
  if (action === 'library') showView('library');
  if (action === 'home') showView('home');
  if (action === 'library-tab') {
    state.libraryTab = source.dataset.tab || 'my-games';
    renderLibraryView();
    refreshFocusables();
    setFocusedElement(source);
  }
  if (action === 'library-filter') {
    state.libraryCategory = source.dataset.category || 'games';
    document.querySelectorAll('.filter-chip').forEach((chip) => {
      const active = chip === source;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', String(active));
    });
    renderLibraryView();
    refreshFocusables();
    setFocusedElement(source);
  }
  if (action === 'library-install-filter') {
    state.installFilter = source.dataset.installed || 'all';
    renderLibraryView();
    setFocusedElement(source);
  }
  if (action === 'options-launch') {
    state.selectedGameId = state.optionsGameId;
    const launchTarget = state.games.find((game) => game.id === state.optionsGameId);
    if (launchTarget?.isLauncher && launchTarget.title === 'Steam') {
      gameOptionsDialog.close();
      steamLaunchDialog.showModal();
      setTimeout(() => setFocusedElement(steamLaunchDialog.querySelector('[data-action="steam-launch-desktop"]')), 0);
      return;
    }
    await launchSelectedGame();
  }
  if (action === 'change-category') {
    const game = state.games.find((item) => item.id === state.optionsGameId);
    if (!game || game.isLauncher) return;
    const nextIsApp = !game.isApp;
    try {
      await window.launcher.saveGameCategory(game.id, nextIsApp);
      game.isApp = nextIsApp;
      if (nextIsApp && state.selectedGameId === game.id) state.selectedGameId = null;
      renderLibrary();
      document.querySelector('#change-category-button').innerHTML = `${nextIsApp ? 'Move to Games' : 'Move to Apps'} <span>›</span>`;
      document.querySelector('#options-status').textContent = `${nextIsApp ? 'App' : 'Game'} · ${game.installed === false ? 'Not installed' : 'Ready to launch'}`;
      refreshFocusables();
      showToast(nextIsApp ? `${game.title} moved to Apps` : `${game.title} moved to Games`);
    } catch (error) { showToast(error.message || 'Could not move this item'); }
    return;
  }
  if (action === 'steam-launch-cancel') { steamLaunchDialog.close(); return; }
  if (action === 'steam-launch-desktop') { steamLaunchDialog.close(); await launchSelectedGame(); return; }
  if (action === 'steam-launch-big-picture') {
    steamLaunchDialog.close();
    try { await window.launcher.launchSteamBigPicture(state.selectedGameId); showToast('Opening Steam Big Picture'); setTimeout(() => window.launcher.minimizeLauncher().catch(() => {}), 400); }
    catch (error) { showToast(error.message || 'Could not open Steam Big Picture'); }
    return;
  }
  if (action === 'download-steam' || action === 'uninstall-steam' || action === 'view-steam' || action === 'view-steam-library' || action === 'open-folder' || action === 'open-steamdb') {
    try {
      const normalizedAction = action === 'download-steam' ? 'download' : action;
      const gameId = source.dataset.gameId || state.optionsGameId;
      await window.launcher.gameAction(gameId, normalizedAction);
      if (gameOptionsDialog.open) gameOptionsDialog.close();
      if (action === 'download-steam') showToast('Steam install options opened');
      if (action === 'uninstall-steam') showToast('Steam uninstall options opened');
    } catch (error) { showToast(error.message || 'Could not complete that action'); }
  }
  if (action === 'launch-with-options') {
    const value = document.querySelector('#steam-launch-options').value.trim();
    try {
      await window.launcher.saveGameLaunchOptions(state.optionsGameId, value);
      const game = state.games.find((item) => item.id === state.optionsGameId);
      if (game) game.launchOptions = value;
      state.selectedGameId = state.optionsGameId;
      await launchSelectedGame(value);
    } catch (error) { showToast(error.message || 'Could not save Steam launch options'); }
  }
  if (action === 'save-launch-options') {
    try {
      const value = document.querySelector('#steam-launch-options').value.trim();
      await window.launcher.saveGameLaunchOptions(state.optionsGameId, value);
      const game = state.games.find((item) => item.id === state.optionsGameId);
      if (game) game.launchOptions = value;
      showToast(value ? 'Default Steam launch options saved' : 'Default Steam launch options cleared');
      gameOptionsDialog.close();
    } catch (error) { showToast(error.message || 'Could not save launch options'); }
  }
  if (action === 'save-achievement-reference') {
    const gameId = state.optionsGameId;
    try {
      const appId = await window.launcher.saveAchievementReference(gameId, document.querySelector('#achievement-reference-id').value);
      const game = state.games.find((item) => item.id === gameId);
      if (game) game.achievementReferenceAppId = appId;
      gameOptionsDialog.close();
      showToast(appId ? 'Steam reference linked for metadata and view-only achievements' : 'Steam reference removed');
      if (state.view === 'detail') openGameDetails(gameId);
    } catch (error) { showToast(error.message || 'Could not save achievement reference'); }
  }
  if (action === 'save-xbox-achievement-reference') {
    const gameId = state.optionsGameId;
    const reference = {
      titleId: document.querySelector('#xbox-achievement-title-id').value.trim(),
      platform: document.querySelector('#xbox-achievement-platform').value
    };
    try {
      const saved = await window.launcher.saveXboxAchievementReference(gameId, reference);
      const game = state.games.find((item) => item.id === gameId);
      if (game) game.xboxAchievementReference = saved;
      gameOptionsDialog.close();
      showToast(saved ? 'Xbox achievement reference saved' : 'Xbox achievement reference removed');
      if (state.view === 'detail') openGameDetails(gameId);
    } catch (error) { showToast(error.message || 'Could not save Xbox achievement reference'); }
  }
  if (action === 'change-artwork') await openArtworkPicker(state.optionsGameId);
  if (action === 'refresh-game-artwork') {
    const gameId = state.optionsGameId;
    gameOptionsDialog.close();
    showActivity('Finding artwork', 'Checking PlayStation, IGN, Xbox, then SteamGridDB…');
    try {
      const artwork = await window.launcher.refreshGameArtwork(gameId);
      const names = { 'playstation-store': 'PlayStation Store', ign: 'IGN', 'xbox-catalog': 'Xbox Store', 'steamgriddb-square': 'SteamGridDB' };
      showToast(`Cover found on ${names[artwork.imageSource] || artwork.imageSource}`);
      showActivity('Artwork updated', `Cover found on ${names[artwork.imageSource] || artwork.imageSource}.`, null, 3500);
    } catch (error) { showToast(error.message || 'Artwork refresh failed'); showActivity('Artwork unavailable', error.message || 'Could not find artwork. Your current cover is unchanged.', null, 9000, 'error'); }
  }
  if (action === 'artwork-source' || action === 'artwork-steam-load') {
    const request = state.officialArtworkRequest = (state.officialArtworkRequest || 0) + 1;
    state.artworkSource = action === 'artwork-steam-load' ? 'steam' : source.dataset.source;
    if (state.artworkSource === 'steam') state.officialArtwork = [];
    renderArtworkSlot();
    if (state.artworkSource === 'steam') {
      const gameId = state.artworkGameId;
      artworkStatus.textContent = 'Checking official Steam assets…';
      try {
        const result = await window.launcher.getOfficialSteamArtwork(gameId, document.querySelector('#artwork-steam-id').value.trim());
        if (request !== state.officialArtworkRequest || state.artworkGameId !== gameId || !artworkDialog.open) return;
        state.officialArtwork = result.assets;
        renderArtworkSlot();
      } catch (error) { if (request === state.officialArtworkRequest && artworkDialog.open) artworkStatus.textContent = error.message; }
    }
    else if (['xbox', 'psn', 'ign'].includes(state.artworkSource)) await loadCatalogArtwork();
    return;
  }
  if (action === 'artwork-slot') { state.artworkSlot = source.dataset.slot; renderArtworkSlot(); }
  if (action === 'search-artwork') {
    if (['xbox', 'psn', 'ign'].includes(state.artworkSource)) await loadCatalogArtwork();
    else if (state.artworkSource === 'steam') await performAction('artwork-steam-load', source);
    else await runArtworkSearch();
  }
  if (action === 'select-artwork-game') await runArtworkSearch(source.dataset.sgdbGameId);
  if (action === 'select-artwork') {
    const choice = artworkChoicesForSlot()[Number(source.dataset.artIndex)];
    if (!choice) return;
    state.artworkDraft[state.artworkSlot] = choice.url;
    if (state.artworkSlot === 'tile') { state.artworkDraft.tileIsSquare = Boolean(choice.tileIsSquare); state.artworkDraft.imageSource = choice.source || (state.artworkSource === 'steam' ? 'official-steam' : 'steamgriddb-manual'); }
    renderArtworkSlot();
  }
  if (action === 'use-artwork') await saveArtworkChoice();
}

document.addEventListener('click', (event) => {
  if (!launchOverlay.hidden) return;
  const target = event.target.closest('[data-action]');
  if (target) performAction(target.dataset.action, target);
});

document.addEventListener('contextmenu', (event) => {
  const card = event.target.closest('.game-card[data-game-id]');
  if (!card) return;
  event.preventDefault();
  openGameOptions(card.dataset.gameId);
});

document.addEventListener('focusin', (event) => {
  if (event.target.classList.contains('focusable')) setFocusedElement(event.target);
});

document.addEventListener('keydown', (event) => {
  if (!launchOverlay.hidden) { event.preventDefault(); return; }
  const activeModal = topmostOpenDialog();
  if (activeModal && event.key === 'Tab') {
    refreshFocusables();
    const items = state.focusables;
    if (items.length) {
      const index = items.indexOf(document.activeElement);
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index < 0 || index >= items.length - 1 ? 0 : index + 1);
      event.preventDefault();
      setFocusedElement(items[next], { scroll: false });
    }
    return;
  }
  const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const isTextInput = event.target instanceof HTMLInputElement && event.target.type !== 'checkbox';
  if (event.key === 'Home' && !isTextInput && !document.querySelector('dialog[open]')) { event.preventDefault(); document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (galleryDialog.open && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    showGalleryImage(state.galleryIndex + (event.key === 'ArrowRight' ? 1 : -1));
    return;
  }
  if (directions[event.key] && !isTextInput) { event.preventDefault(); moveFocus(directions[event.key]); }
  if (event.key === 'Enter' && event.target === artworkQuery) { event.preventDefault(); runArtworkSearch(); }
  if (event.key === 'Enter' && event.target === librarySearch) {
    event.preventDefault();
    showView('library');
    librarySearch.blur();
  }
  if (event.key === 'Enter' && document.activeElement?.dataset.action) {
    event.preventDefault();
    performAction(document.activeElement.dataset.action, document.activeElement);
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    navigateBack();
  }
  if ((event.key === 'o' || event.key === 'O') && !isTextInput && !document.querySelector('dialog[open]')) openGameOptions();
});

document.querySelector('#custom-game-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.customDraft) return;
  const result = state.customArtworkSearch;
  const choice = state.customArtworkChoice;
  try {
    const saved = await window.launcher.saveCustomGame({
      id: state.customDraft.id,
      executable: state.customDraft.executable,
      title: customGameName.value.trim(),
      isApp: document.querySelector('#custom-game-type').value === 'app',
      artwork: choice ? { ...choice, logo: result.logo, hero: result.hero, sgdbGameId: result.game?.id, overlayLogo: false } : null
    });
    customGameDialog.close();
    await scanLibrary(false);
    selectGame(saved.id, false);
    showToast(`${saved.title} saved`);
  } catch (error) { showToast(error.message || 'Could not save custom game'); }
});

document.querySelector('#collection-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const nameInput = document.querySelector('#collection-name');
  const name = nameInput.value.trim();
  if (!name) return;
  try {
    const result = await window.launcher.organizeLibrary('create', { name, gameId: state.optionsGameId });
    state.favoriteGameIds = result.favoriteGameIds;
    state.customCollections = result.customCollections;
    nameInput.value = '';
    renderCollectionsDialog();
    renderLibrary();
    showToast(`${name} created`);
    setFocusedElement(collectionsDialog.querySelector('.collection-member:last-of-type') || nameInput);
  } catch (error) { showToast(error.message || 'Could not create collection'); }
});

customGameName.addEventListener('input', () => {
  clearTimeout(customArtworkSearchTimer);
  customArtworkSearchSequence++;
  state.customArtworkSearch = null;
  state.customArtworkChoice = null;
  customArtworkGames.innerHTML = '';
  customArtworkResults.innerHTML = '';
  const query = customGameName.value.trim();
  customArtworkQueryLabel.textContent = query ? `Artwork for “${query}”` : 'Name this game to find artwork';
  customArtworkStatus.textContent = query ? 'Finding matching artwork…' : 'Enter a name to search SteamGridDB.';
  if (query) customArtworkSearchTimer = setTimeout(() => runCustomArtworkSearch(), 450);
});

document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') { settingsDialog.close('cancel'); return; }
  try {
    const refreshArtwork = state.settingsOriginal.steamGridDbKey !== document.querySelector('#sgdb-key').value.trim();
    await window.launcher.saveSettings({
      steamGridDbKey: document.querySelector('#sgdb-key').value,
      steamApiKey: document.querySelector('#steam-api-key').value,
      xboxApiKey: document.querySelector('#xbox-api-key').value.trim(),
      steamId64: document.querySelector('#steam-id64').value,
      showUninstalledSteam: document.querySelector('#show-uninstalled-toggle').checked,
      showUninstalledEpic: document.querySelector('#show-uninstalled-epic-toggle').checked,
      legendaryPath: document.querySelector('#legendary-path').value.trim(),
      fullscreen: document.querySelector('#fullscreen-toggle').checked,
      soundEffects: document.querySelector('#sound-toggle').checked,
      uiScale: Number(document.querySelector('#ui-scale').value) / 100,
      tileRadius: Number(document.querySelector('#tile-radius').value),
      reducedMotion: document.querySelector('#reduced-motion-toggle').checked,
      textScale: Number(document.querySelector('#text-size').value) / 100,
      highContrastFocus: document.querySelector('#high-contrast-focus-toggle').checked,
      useRandomScreenshotBackground: document.querySelector('#random-screenshot-background-toggle').checked,
      shuffleHomeScreenshots: document.querySelector('#shuffle-home-screenshots-toggle').checked
    });
    state.settingsOriginal = { uiScale: Number(document.querySelector('#ui-scale').value) / 100, tileRadius: Number(document.querySelector('#tile-radius').value), reducedMotion: document.querySelector('#reduced-motion-toggle').checked, textScale: Number(document.querySelector('#text-size').value) / 100, highContrastFocus: document.querySelector('#high-contrast-focus-toggle').checked, steamGridDbKey: document.querySelector('#sgdb-key').value.trim() };
    state.settingsSaved = true;
    state.soundEffects = document.querySelector('#sound-toggle').checked;
    state.showUninstalledSteam = document.querySelector('#show-uninstalled-toggle').checked;
    state.showUninstalledEpic = document.querySelector('#show-uninstalled-epic-toggle').checked;
    state.useRandomScreenshotBackground = document.querySelector('#random-screenshot-background-toggle').checked;
    state.shuffleHomeScreenshots = document.querySelector('#shuffle-home-screenshots-toggle').checked;
    state.ambientKey = '';
    const selectedGame = state.games.find((game) => game.id === state.selectedGameId);
    if (selectedGame) updateAmbient(selectedGame, true);
    settingsDialog.close();
    await scanLibrary(refreshArtwork);
  } catch (error) { showToast(error.message || 'Could not save settings'); }
});
document.querySelector('#steam-api-key').addEventListener('input', () => updateUninstalledRequirement('steam-api-key', 'show-uninstalled-toggle'));
document.querySelector('#legendary-path').addEventListener('change', () => refreshEpicHelperStatus().catch(() => {}));
document.querySelector('#onboard-steam-key').addEventListener('input', () => updateUninstalledRequirement('onboard-steam-key', 'onboard-uninstalled', 'onboard-uninstalled-note'));
document.querySelector('#ui-scale').addEventListener('input', (event) => {
  document.querySelector('#scale-value').textContent = `${event.target.value}%`;
  window.launcher.previewScale(Number(event.target.value) / 100).catch(() => {});
});
function previewPersonalization() {
  applyPersonalization({
    tileRadius: Number(document.querySelector('#tile-radius').value),
    reducedMotion: document.querySelector('#reduced-motion-toggle').checked,
    textScale: Number(document.querySelector('#text-size').value) / 100,
    highContrastFocus: document.querySelector('#high-contrast-focus-toggle').checked
  });
}
document.querySelector('#tile-radius').addEventListener('input', (event) => {
  document.querySelector('#radius-value').textContent = `${event.target.value} px`;
  previewPersonalization();
});
document.querySelector('#reduced-motion-toggle').addEventListener('change', previewPersonalization);
document.querySelector('#text-size').addEventListener('input', (event) => { document.querySelector('#text-size-value').textContent = `${event.target.value}%`; previewPersonalization(); });
document.querySelector('#high-contrast-focus-toggle').addEventListener('change', previewPersonalization);
document.querySelector('#profile-name-input').addEventListener('input', (event) => {
  document.querySelector('#profile-name-heading').textContent = event.target.value.trim() || 'Player';
});

document.querySelector('#gamerpic-file-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { showToast('Choose an image smaller than 20 MB'); return; }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const edge = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, 256, 256);
    bitmap.close();
    customAvatarData = canvas.toDataURL('image/jpeg', .84);
    selectedAvatarId = 'custom-uploaded';
    renderAvatarChoices();
    showToast('Gamerpic ready — save your profile to keep it');
  } catch { showToast('That image could not be opened'); }
});

for (const dialog of [settingsDialog, resetConfirmDialog, gameOptionsDialog, steamLaunchDialog, artworkDialog, customGameDialog, keyboardDialog, galleryDialog, newsPreviewDialog, avatarDialog, onboardingDialog, controllerStatusDialog, achievementDialog, powerDialog, collectionsDialog]) {
  let opener;
  dialog.addEventListener('beforetoggle', (event) => {
    if (event.newState === 'open') opener = document.activeElement;
  });
  dialog.addEventListener('close', () => {
    if (dialog === settingsDialog && !state.settingsSaved) {
      window.launcher.previewScale(state.settingsOriginal.uiScale).catch(() => {});
      applyPersonalization(state.settingsOriginal);
    }
    if (dialog === avatarDialog && state.profileOriginal) {
      selectedAvatarId = state.profileOriginal.avatarId;
      state.displayName = state.profileOriginal.displayName;
      customAvatarData = state.profileOriginal.avatarImage || '';
      state.profileOriginal = null;
      renderAvatarChoices();
    }
    setTimeout(() => {
      if (dialog === keyboardDialog && state.keyboardTarget?.isConnected) {
        const target = state.keyboardTarget;
        state.keyboardTarget = null;
        refreshFocusables();
        if (target.offsetParent !== null) setFocusedElement(target);
        return;
      }
      const activeDialog = topmostOpenDialog();
      if (opener?.isConnected && opener.offsetParent !== null && (!activeDialog || activeDialog.contains(opener))) {
        refreshFocusables();
        setFocusedElement(opener);
        return;
      }
      if (activeDialog) return;
      refreshFocusables();
      const target = !searchPopover.hidden ? document.querySelector('.top-nav-button[data-action="toggle-search"]') : [...document.querySelectorAll('.game-card.focusable')].find((element) => element.dataset.gameId === state.selectedGameId)
        || (state.view === 'library' ? libraryView.querySelector('.library-tab') : recentRow.querySelector('.focusable'));
      if (target) setFocusedElement(target);
    }, 0);
  });
}

librarySearch.addEventListener('input', () => {
  state.searchQuery = librarySearch.value.trim().toLowerCase();
  renderLibrary();
});
document.querySelector('#library-collection').addEventListener('change', event => {
  state.collectionFilter = event.target.value; renderLibraryView(); refreshFocusables();
});
document.querySelector('#library-sort').addEventListener('change', (event) => {
  state.librarySort = event.target.value;
  renderLibraryView();
});
document.querySelector('#library-source-filter').addEventListener('change', (event) => {
  state.sourceFilter = event.target.value;
  renderLibraryView();
});

function focusForGamepad(gamepad) {
  if (!isUsableController(gamepad)) return;
  state.gamepadIndex = gamepad.index;
  state.previousButtons = [];
  refreshControllerStatus();
  if (state.fullScreenImport) return;
  if (state.lastNotifiedGamepadIndex !== gamepad.index) showToast('Controller connected · input is ready');
  state.lastNotifiedGamepadIndex = gamepad.index;
  refreshFocusables();
  const activeDialog = topmostOpenDialog();
  const target = activeDialog?.querySelector('.focusable:not([hidden]):not(:disabled)')
    || [...document.querySelectorAll('.game-card.focusable')].find((element) => element.dataset.gameId === state.selectedGameId && element.offsetParent !== null)
    || (state.view === 'library' ? libraryGrid.querySelector('.game-card.focusable') : recentRow.querySelector('.game-card.focusable'))
    || state.focusables.find((element) => element !== librarySearch)
    || state.focusables[0];
  if (target) setFocusedElement(target);
}

function gamepadMove(direction) {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.type === 'range' && (direction === 'left' || direction === 'right')) {
    const step = Number(active.step) || 1;
    const delta = direction === 'right' ? step : -step;
    active.value = String(Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + delta)));
    active.dispatchEvent(new Event('input', { bubbles: true }));
    playUiSound('navigate');
    return;
  }
  moveFocus(direction);
}

let gamepadPollTimer = null;

function scheduleGamepadPoll() {
  if (gamepadPollTimer !== null || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  gamepadPollTimer = setTimeout(() => {
    gamepadPollTimer = null;
    requestAnimationFrame(pollGamepad);
  }, 24);
}

function pollGamepad() {
  try {
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
  const connected = getConnectedControllers();
  // Prefer whichever controller was just used. Keeping a stale first device
  // selected meant a headset/remote could silently steal all navigation.
  const gamepad = connected.find(hasRecentControllerInput)
    || connected.find((item) => item.index === state.gamepadIndex)
    || connected[0]
    || null;
  if (gamepad) {
    if (state.gamepadIndex !== gamepad.index) focusForGamepad(gamepad);
    const pressed = gamepad.buttons.map((button) => Boolean(button.pressed || button.value > .55));
    const justPressed = (index) => pressed[index] && !state.previousButtons[index];
    if (state.fullScreenImport || !launchOverlay.hidden) { state.previousButtons = pressed; return; }
    if (justPressed(0)) {
      if (document.activeElement instanceof HTMLInputElement && ['text', 'search', 'password', 'number'].includes(document.activeElement.type)) openControllerKeyboard(document.activeElement);
      else { state.controllerClick = true; document.activeElement?.click(); state.controllerClick = false; }
    }
    let modalBackHandled = false;
    if (justPressed(1)) {
      modalBackHandled = true;
      navigateBack();
    }
    if (modalBackHandled) { state.previousButtons = pressed; return; }
    if (justPressed(9)) {
      if (settingsDialog.open) settingsDialog.close();
      else if (!document.querySelector('dialog[open]')) openSettings();
    }
    if (keyboardDialog.open && justPressed(2)) typeControllerKey('backspace');
    else if (justPressed(2) && !document.querySelector('dialog[open]')) scanLibrary(false);
    if (keyboardDialog.open && justPressed(3)) typeControllerKey('space');
    else if (justPressed(3) && !document.querySelector('dialog[open]')) openGameOptions();
    if (justPressed(8) && !document.querySelector('dialog[open]')) toggleNav();
    if (justPressed(4) && !document.querySelector('dialog[open]')) document.querySelector('main').scrollBy({ top: -window.innerHeight * .75, behavior: 'smooth' });
    if (justPressed(5) && !document.querySelector('dialog[open]')) document.querySelector('main').scrollBy({ top: window.innerHeight * .75, behavior: 'smooth' });
    if (justPressed(12)) gamepadMove('up');
    if (justPressed(13)) gamepadMove('down');
    if (justPressed(14)) galleryDialog.open ? showGalleryImage(state.galleryIndex - 1) : gamepadMove('left');
    if (justPressed(15)) galleryDialog.open ? showGalleryImage(state.galleryIndex + 1) : gamepadMove('right');

    const now = performance.now();
    if (now - state.lastAxisMove > 210) {
      const [x = 0, y = 0] = gamepad.axes;
      if (x < -.42) { galleryDialog.open ? showGalleryImage(state.galleryIndex - 1) : gamepadMove('left'); state.lastAxisMove = now; }
      else if (x > .42) { galleryDialog.open ? showGalleryImage(state.galleryIndex + 1) : gamepadMove('right'); state.lastAxisMove = now; }
      else if (y < -.42) { gamepadMove('up'); state.lastAxisMove = now; }
      else if (y > .42) { gamepadMove('down'); state.lastAxisMove = now; }
      else if (gamepad.mapping !== 'standard') {
        const [hatX = 0, hatY = 0] = gamepad.axes.slice(6, 8);
        if (hatX < -.5) { gamepadMove('left'); state.lastAxisMove = now; }
        else if (hatX > .5) { gamepadMove('right'); state.lastAxisMove = now; }
        else if (hatY < -.5) { gamepadMove('up'); state.lastAxisMove = now; }
        else if (hatY > .5) { gamepadMove('down'); state.lastAxisMove = now; }
      }
    }
    state.previousButtons = pressed;
  } else if (state.gamepadIndex !== null) {
    state.gamepadIndex = null;
    state.previousButtons = [];
  }
  } catch {
    state.gamepadIndex = null;
    state.previousButtons = [];
  } finally {
    scheduleGamepadPoll();
  }
}

window.addEventListener('gamepadconnected', (event) => {
  if (isUsableController(event.gamepad)) focusForGamepad(event.gamepad);
  else refreshControllerStatus();
});

window.addEventListener('focus', () => {
  state.gamepadIndex = null;
  state.previousButtons = [];
  refreshControllerStatus();
  refreshSteamLocalStatus();
  requestAnimationFrame(() => {
    const controllers = getConnectedControllers();
    const pad = controllers.find(hasRecentControllerInput) || controllers[0];
    if (pad) focusForGamepad(pad);
  });
  scheduleGamepadPoll();
});

window.addEventListener('blur', () => {
  if (gamepadPollTimer !== null) clearTimeout(gamepadPollTimer);
  gamepadPollTimer = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    if (gamepadPollTimer !== null) clearTimeout(gamepadPollTimer);
    gamepadPollTimer = null;
    return;
  }
  state.gamepadIndex = null;
  state.previousButtons = [];
  refreshControllerStatus();
  refreshSteamLocalStatus();
  requestAnimationFrame(() => {
    const controllers = getConnectedControllers();
    const pad = controllers.find(hasRecentControllerInput) || controllers[0];
    if (pad) focusForGamepad(pad);
  });
  scheduleGamepadPoll();
});

window.addEventListener('gamepaddisconnected', (event) => {
  const disconnectedIndex = event.gamepad?.index;
  const wasActiveController = state.gamepadIndex === disconnectedIndex || state.lastNotifiedGamepadIndex === disconnectedIndex;
  if (state.gamepadIndex === disconnectedIndex) state.gamepadIndex = null;
  if (state.lastNotifiedGamepadIndex === disconnectedIndex) {
    state.lastNotifiedGamepadIndex = null;
  }
  if (wasActiveController) showToast('Controller disconnected');
  state.previousButtons = [];
  setTimeout(refreshControllerStatus, 80);
});

window.launcher.getSettings().then(async (settings) => {
  applyPersonalization(settings);
  state.favoriteGameIds = Array.isArray(settings.favoriteGameIds) ? settings.favoriteGameIds : [];
  state.customCollections = Array.isArray(settings.customCollections) ? settings.customCollections : [];
  refreshActiveGameSession().catch(() => {});
  state.useRandomScreenshotBackground = settings.useRandomScreenshotBackground !== false;
  state.shuffleHomeScreenshots = settings.shuffleHomeScreenshots !== false;
  state.soundEffects = settings.soundEffects !== false;
  selectedAvatarId = settings.avatarId || 'one-orbit';
  customAvatarData = settings.avatarImage || '';
  state.steamBannerDismissed = settings.steamBannerDismissed === true;
  state.displayName = settings.displayName || 'Player';
  window.launcher.getSteamLocalStatus().then((status) => {
    state.steamLocalStatus = status;
    renderSteamLocalStatus();
    renderSteamLocalStatus('#settings-steam-local-status');
  }).catch(() => { renderSteamLocalStatus(); renderSteamLocalStatus('#settings-steam-local-status'); });
  renderAvatarChoices();
  document.querySelector('#profile-button').title = state.displayName;
  if (settings.onboardingComplete) {
    const cachedLibrary = await startupLibrarySnapshot;
    if (cachedLibrary) {
      applyLibraryResult(cachedLibrary);
      setTimeout(() => scanLibrary(false, false, true), 300);
    } else scanLibrary(false, true);
  }
  else {
    document.querySelector('#onboard-name').value = settings.displayName === 'Player' ? '' : settings.displayName || '';
    document.querySelector('#onboard-steam-key').value = settings.steamApiKey || '';
    document.querySelector('#onboard-sgdb-key').value = settings.steamGridDbKey || '';
    document.querySelector('#onboard-xbox-key').value = settings.xboxApiKey || '';
    document.querySelector('#onboard-steam-id').value = settings.steamId64 || '';
    document.querySelector('#onboard-uninstalled').checked = settings.showUninstalledSteam === true;
    updateUninstalledRequirement('onboard-steam-key', 'onboard-uninstalled', 'onboard-uninstalled-note');
    showOnboardingStep(0);
    onboardingDialog.showModal();
    setTimeout(() => setFocusedElement(document.querySelector('#onboard-next'), { scroll: false }), 0);
  }
}).catch(() => { renderAvatarChoices(); scanLibrary(false); });
window.addEventListener('focus', () => refreshActiveGameSession().catch(() => {}));
scheduleGamepadPoll();
updateConnectivityActivity();
refreshControllerStatus();
