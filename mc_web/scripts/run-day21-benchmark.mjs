import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../', import.meta.url));
const child = spawn(process.execPath, ['--test', '--test-timeout=100000', 'scripts/verify-day21.mjs'], { cwd: directory, env: { ...process.env, MC_DAY21_REPORT: '1' }, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
