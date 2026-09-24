// Isolated visual smoke test. Never uses the player's settings or launches games.
const { app, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const output = path.resolve(__dirname, '../.visual-review');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  win.webContents.on('console-message', (_, details) => {
    if (details.level === 3) console.error('Renderer:', details.message);
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(5000);
      const run = script => win.webContents.executeJavaScript(script);
      const capture = async (name, script) => {
        if (script) await run(script);
        await pause(900);
        await fs.writeFile(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG());
        const layout = await run(`(() => { const d = topmostOpenDialog(); return { view: state.view, dialog: d?.id, width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, modalFits: !d || (d.getBoundingClientRect().bottom <= innerHeight + 1 && d.getBoundingClientRect().top >= 0) }; })()`);
        if (layout.overflow || !layout.modalFits) throw Error(name + ': ' + JSON.stringify(layout));
        console.log(name, JSON.stringify(layout));
      };
      win.setContentSize(1600, 1000);
      await run(`state.games.forEach(g => { const id = g.appId; if (id) g.artwork = { ...g.artwork, tile: 'https://cdn.akamai.steamstatic.com/steam/apps/'+id+'/library_600x900.jpg', hero: 'https://cdn.akamai.steamstatic.com/steam/apps/'+id+'/library_hero.jpg', logo: 'https://cdn.akamai.steamstatic.com/steam/apps/'+id+'/logo.png', tileIsSquare: false }; }); renderLibrary(); selectGame('demo-1', false);`);
      await pause(3500);
      await capture('home', "showView('home')");
      await run("if(document.querySelector('#news-shelf').closest('#home-view')) throw Error('Steam news still on Home'); if(!document.querySelector('#most-played-shelf')) throw Error('Steam playtime shelf missing');");
      await capture('library', "showView('library')");
      await capture('options', "openGameOptions('demo-1')");
      await run(`showOptionsPage('artwork'); if (!document.querySelector('[data-options-page=manage]').hidden) throw Error('Manage page remained visible'); navigateBack();`);
      await capture('settings', "openSettings()");
      await capture('settings-library', "showSettingsPage('services')");
      await run("if(state.games.filter(game=>game.isLauncher).length<2) throw Error('Demo launchers missing'); if(!document.querySelector('#settings-launcher-summary').textContent.includes('2 game launchers')) throw Error('Launcher status missing'); if(!document.querySelector('#settings-epic-status') || !document.querySelector('#show-uninstalled-epic-toggle')) throw Error('Epic account library card missing');");
      await capture('personalization', "showSettingsPage('personalization')");
      await run('navigateBack()');
      await capture('apps', "state.libraryCategory='apps'; state.libraryTab='my-games'; showView('library'); renderLibraryView()");
      await run("if(document.querySelectorAll('.app-list-card').length<2) throw Error('App cards missing'); openGameOptions('launcher-steam'); if(!document.querySelector('#steam-management-group').hidden) throw Error('Steam game actions leaked into launcher options'); performAction('options-launch', document.querySelector('[data-action=options-launch]')); if(!document.querySelector('#steam-launch-dialog').open) throw Error('Steam launch choice missing'); navigateBack(); state.libraryCategory='games'; renderLibraryView();");
      await capture('profile', "performAction('avatar-picker', document.querySelector('[data-action=avatar-picker]'))");
      await capture('profile-customize', "showProfilePage('customize')");
      await run('navigateBack()');
      await run("showView('home')");
      await pause(700);
      await run(`(() => {
        const item = state.steamDiscovery.mostPlayed[0];
        const owned = state.games.find(game => game.id === 'demo-1');
        const originalAppId = owned.appId;
        const originalCount = item.currentPlayers;
        owned.appId = item.appId;
        for (const [count, expected] of [[123456, '123,456 playing now'], [0, '0 playing now'], [undefined, 'Player count unavailable']]) {
          item.currentPlayers = count;
          renderHomeCollections();
          const card = document.querySelector('#steam-players-row .steam-discovery-card');
          if (card.dataset.gameId !== owned.id || card.querySelector('small').textContent !== expected) throw Error('Owned chart game lost its player count');
        }
        owned.appId = originalAppId;
        item.currentPlayers = originalCount;
        state.steamDiscovery.mostPlayed.forEach((game, index) => game.currentPlayers = [123456, 98765, 76543, 65432, 54321][index]);
        renderHomeCollections();
        if(document.querySelector('#steam-players-row .steam-discovery-card small').textContent !== '123,456 playing now') throw Error('Unowned game lost its player count');
      })()`);
      await capture('collections', "document.querySelector('#home-collections').scrollIntoView({behavior:'instant'})");
      await run("if(document.querySelectorAll('.steam-discovery-shelf').length!==3) throw Error('Expected three Steam shelves'); if(document.querySelectorAll('#steam-players-row .steam-discovery-card').length!==5 || document.querySelectorAll('#steam-sellers-row .steam-discovery-card').length!==5 || document.querySelectorAll('#steam-upcoming-row .steam-discovery-card').length!==5) throw Error('Steam discovery cards missing'); setFocusedElement(document.querySelector('#steam-upcoming-row .steam-discovery-card'), {scroll:false}); moveFocus('down'); if(!state.focusedElement?.classList.contains('category-card')) throw Error('Controller cannot reach Find your next game');");
      await run("if(Math.abs(document.querySelector('#steam-players-row .steam-discovery-card').getBoundingClientRect().width-document.querySelector('#steam-players-row .steam-discovery-card').getBoundingClientRect().height)>2) throw Error('Discovery cover is not square'); if(document.querySelector('#steam-players-row .steam-discovery-card img')) throw Error('Chart capsule bypassed artwork priority');");
      await capture('discovery-details', "openGameDetails('steam-discovery-730')");
      await run("if(!document.querySelector('#detail-play').textContent.includes('View on Steam') || !document.querySelector('#detail-options-button').hidden) throw Error('Unowned game preview has launch controls'); showView('home');");
      await run("performAction('browse-collection', {dataset:{collection:'installed'}}); if(state.view !== 'library' || state.collectionFilter !== 'installed') throw Error('Collection navigation failed'); state.collectionFilter='all';");
      await run("openArtworkPicker('demo-1')");
      await run("if(document.querySelector('#overlay-logo-toggle').checked) throw Error('Logo overlay is on by default');");
      await capture('official-artwork', "(async () => { await performAction('artwork-source', {dataset:{source:'steam'}}); state.artworkSlot='logo'; renderArtworkSlot(); })()");
      await run("if (!state.officialArtwork?.length) throw Error('Official Steam artwork returned no assets'); if(document.querySelector('#official-steam-controls').hidden) throw Error('Official source controls hidden'); if(!document.querySelector('[data-source=xbox]') || !document.querySelector('[data-source=psn]') || !document.querySelector('[data-source=ign]')) throw Error('Catalog artwork sources missing')");
      await capture('catalog-artwork', "(async()=>{await performAction('artwork-source',{dataset:{source:'xbox'}}); if(state.artworkSource!=='xbox') throw Error('Xbox artwork source did not open')})()");
      await run("navigateBack()");
      await run("openGameDetails('demo-1')");
      await pause(6000);
      await capture('game-details');
      await run("openGameDetails('demo-3'); if(!document.querySelector('#news-shelf').hidden || document.querySelector('#news-row').childElementCount) throw Error('Steam news leaked into non-Steam game'); if(document.querySelector('.detail-back')) throw Error('Old Back button remains'); if(getComputedStyle(document.querySelector('#detail-global-art')).backgroundSize!=='cover') throw Error('Detail art may stretch'); openGameDetails('demo-1');");
      // Fixture verifies the expanded catalog state without pretending to be player progress.
      await run(`state.achievementItems = [{ title:'Welcome to the festival', description:'A catalog preview used to verify the achievement detail layout.', unlocked:null }]; state.achievementProgressAvailable=false; renderAchievements();`);
      await capture('achievement', 'openAchievement(0)');
      await run('navigateBack()');
      await capture('onboarding', 'onboardingDialog.showModal(); showOnboardingStep(0)');
      await capture('onboarding-connect', 'showOnboardingStep(2)');
      await run('onboardingDialog.close()');
      win.setContentSize(1280, 800);
      await capture('handheld-options', "openGameOptions('demo-1')");
      await run('navigateBack()');
      await capture('handheld-settings', 'openSettings()');
      await run('navigateBack()');
      await capture('handheld-library', "showView('library')");
      await run(`navigateBack(); if (state.view !== 'home') throw Error('Library Back did not return Home');`);
      await run(`librarySearch.dispatchEvent(new KeyboardEvent('keydown', {key:'o', bubbles:true})); if(gameOptionsDialog.open) throw Error('Typing in search opened game options');`);
      await run(`(async()=>{await openSettings(); await performAction('reset-launcher-data'); refreshFocusables(); if(!resetConfirmDialog.open || !state.focusables.every(node => resetConfirmDialog.contains(node))) throw Error('Reset confirmation leaked focus'); navigateBack(); if(resetConfirmDialog.open || !settingsDialog.open) throw Error('Back did not dismiss only the top dialog');})()`);
      await pause(100);
      await run('navigateBack()');
      await run(`(() => { state.gamepadIndex=91; state.lastNotifiedGamepadIndex=91; const event=new Event('gamepaddisconnected'); Object.defineProperty(event,'gamepad',{value:{index:91,connected:false}}); window.dispatchEvent(event); if(toast.textContent!=='Controller disconnected') throw Error('Controller disconnect notification missing'); })()`);
      await run(`(async()=>{const before=state.view; launchOverlay.hidden=false; navigateBack(); if(state.view!==before) throw Error('Back navigated behind launch screen'); await launchSelectedGame(); launchOverlay.hidden=true;})()`);
      await run('openSettings()');
      await pause(100);
      await run('(async()=>{await window.launcher.previewScale(1.25); showSettingsPage("services");})()');
      await capture('handheld-settings-125');
      if(Math.abs(win.webContents.getZoomFactor()-1.25) > .01) throw Error('Scale preview did not reach 125%');
      await run('navigateBack()');
      win.webContents.setZoomFactor(1);
      await run("(async()=>{openGameOptions('demo-1'); const button=document.querySelector('#change-category-button'); await performAction('change-category',button); if(!state.games.find(game=>game.id==='demo-1').isApp) throw Error('Move to Apps failed'); await performAction('change-category',button); if(state.games.find(game=>game.id==='demo-1').isApp) throw Error('Move to Games failed'); navigateBack()})()");
      // Simulate an unavailable metadata service and a late failure from the previous page.
      ipcMain.removeHandler('game:details');
      ipcMain.handle('game:details', async (_event, id) => { await pause(id === 'demo-3' ? 300 : 10); if(id === 'demo-3') throw Error('Fixture: service unavailable'); return {description:'Current game details', screenshots:[], categories:[]}; });
      await run("openGameDetails('demo-3')");
      await pause(400);
      await run("if(document.querySelector('#detail-gallery').textContent.includes('Loading')) throw Error('Offline details left a permanent spinner'); openGameDetails('demo-3'); openGameDetails('demo-1');");
      await pause(400);
      await run("if(document.querySelector('#detail-description').textContent!=='Current game details') throw Error('Late metadata failure overwrote current game');");
      console.log('PASS: visual screens, modal bounds, options tabs, and Back navigation');
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
});
require('../src/main.cjs');
