const assert = require('node:assert/strict');
const { getPowerCommand, runPowerAction } = require('../src/power-actions.cjs');

async function main() {
  assert.deepEqual(getPowerCommand('shutdown').args, ['/s', '/t', '0']);
  assert.deepEqual(getPowerCommand('restart').args, ['/r', '/t', '0']);
  assert.deepEqual(getPowerCommand('hibernate').args, ['/h']);
  assert.match(getPowerCommand('sleep').args.at(-1), /SetSuspendState/);
  assert.throws(() => getPowerCommand('invalid'), /Unknown power action/);

  let calls = 0;
  const run = (file, args, options, callback) => {
    calls += 1;
    assert.match(file, /shutdown\.exe$/i);
    assert.deepEqual(args, ['/r', '/t', '0']);
    assert.equal(options.windowsHide, true);
    callback(null, '', '');
  };
  assert.deepEqual(await runPowerAction('restart', { run, platform: 'win32' }), { simulated: false });
  assert.equal(calls, 1);
  assert.deepEqual(await runPowerAction('shutdown', { run, platform: 'win32', demo: true }), { simulated: true });
  assert.equal(calls, 1, 'Demo mode must not execute a power command');
  assert.throws(() => runPowerAction('shutdown', { run, platform: 'linux' }), /Windows only/);
  assert.equal(calls, 1);
  console.log('Power action command and simulation tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
