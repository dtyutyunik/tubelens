// T9 packaging: builds the extension and zips dist/ into a versioned release
// artifact ready for chrome://extensions load-unpacked or Web Store upload.
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

console.log(`Building tubelens v${version}…`);
execSync('node esbuild.config.mjs', { cwd: root, stdio: 'inherit' });

const outDir = join(root, 'releases');
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `tubelens-v${version}.zip`);
if (existsSync(zipPath)) execSync(`rm "${zipPath}"`);

console.log(`Zipping dist/ → ${zipPath}`);
execSync(`cd "${join(root, 'dist')}" && zip -qr "${zipPath}" .`, { stdio: 'inherit' });
console.log('Done.');
