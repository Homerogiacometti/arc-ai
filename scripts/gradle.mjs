// Roda o Gradle Wrapper do projeto Android em qualquer shell (cmd, PowerShell ou Bash).
// Uso: node scripts/gradle.mjs assembleDebug
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../android/', import.meta.url));
const windows = process.platform === 'win32';
// Caminho completo: o cmd nem sempre procura executáveis na pasta atual.
const wrapper = join(cwd, windows ? 'gradlew.bat' : 'gradlew');
const result = spawnSync(windows ? `"${wrapper}"` : wrapper, process.argv.slice(2), {
  cwd,
  stdio: 'inherit',
  shell: windows,
});
process.exit(result.status ?? 1);
