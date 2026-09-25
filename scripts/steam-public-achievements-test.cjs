const assert = require('node:assert/strict');
const { parseSteamCommunityAchievements } = require('../src/steam-public-achievements.cjs');

const fixture = `<div class="achieveRow"><img src="https://cdn.akamai.steamstatic.com/example.jpg"><h3>First &amp; foremost</h3><h5>Finish the test.</h5><div class="achievePercent">12.5%</div></div><div class="achieveRow"><img src="https://example.com/untrusted.jpg"><h3>Second</h3><h5>Keep going.</h5></div>`;
const items = parseSteamCommunityAchievements(fixture, '620');
assert.equal(items.length, 2);
assert.equal(items[0].title, 'First & foremost');
assert.equal(items[0].rarity, 12.5);
assert.equal(items[1].icon, null);
assert.equal(items[0].unlocked, null);

if (process.argv.includes('--live')) {
  fetch('https://steamcommunity.com/stats/620/achievements/?l=english', { signal: AbortSignal.timeout(12000) })
    .then(async (response) => {
      assert.equal(response.status, 200);
      const live = parseSteamCommunityAchievements(await response.text(), '620');
      assert.ok(live.length >= 20, `Expected public Portal 2 catalog, got ${live.length} entries`);
      assert.ok(live.some((item) => item.icon), 'Expected achievement artwork');
      console.log(`PASS: fixture and live public catalog (${live.length} achievements)`);
    }).catch((error) => { console.error(error); process.exitCode = 1; });
} else console.log('PASS: public Steam achievement parser fixture');
