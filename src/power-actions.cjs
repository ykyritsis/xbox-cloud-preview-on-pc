const path = require('path');
const { execFile } = require('child_process');

const WINDOWS_ROOT = process.env.SystemRoot || 'C:\\Windows';
const SHUTDOWN = path.join(WINDOWS_ROOT, 'System32', 'shutdown.exe');
const POWERSHELL = path.join(WINDOWS_ROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

const POWER_COMMANDS = Object.freeze({
  shutdown: { file: SHUTDOWN, args: ['/s', '/t', '0'] },
  restart: { file: SHUTDOWN, args: ['/r', '/t', '0'] },
  hibernate: { file: SHUTDOWN, args: ['/h'] },
  sleep: {
    file: POWERSHELL,
    args: [
      '-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; if (-not [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)) { throw "Windows could not enter sleep." }'
    ]
  }
});

function getPowerCommand(action) {
  if (typeof action !== 'string' || !Object.hasOwn(POWER_COMMANDS, action)) throw new Error('Unknown power action.');
  return POWER_COMMANDS[action];
}

function runPowerAction(action, { run = execFile, platform = process.platform, demo = false } = {}) {
  const command = getPowerCommand(action);
  if (platform !== 'win32') throw new Error('Power controls are available on Windows only.');
  if (demo) return Promise.resolve({ simulated: true });
  return new Promise((resolve, reject) => {
    run(command.file, command.args, { windowsHide: true, timeout: action === 'sleep' ? 0 : 15000 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message || 'Windows could not complete this power action.').trim()));
      else resolve({ simulated: false });
    });
  });
}

module.exports = { getPowerCommand, runPowerAction };
