import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');

mkdirSync('dist', { recursive: true });

const ctx = await esbuild.context({
  entryPoints: {
    'background/service-worker': 'src/background/service-worker.ts',
    'content/content': 'src/content/content.ts',
    'options/options': 'src/options/options.tsx',
  },
  bundle: true,
  outdir: 'dist',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'info',
});

// Static assets
cpSync('src/manifest.json', 'dist/manifest.json');
cpSync('src/options/options.html', 'dist/options/options.html');

if (watch) {
  await ctx.watch();
  console.log('Watching for changes... (static assets are NOT re-copied on watch; rebuild for those)');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete -> dist/');
}
