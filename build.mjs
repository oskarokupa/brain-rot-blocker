import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');

// Every entry point that Chrome loads directly. Content scripts and the
// service worker cannot be ES modules in the MAIN world, so everything is
// bundled to a self-contained IIFE.
const ENTRIES = {
  'background/serviceWorker': 'src/background/serviceWorker.ts',
  'content/provider': 'src/providers/youtubeKids/provider.ts',
  'content/mainWorldHook': 'src/providers/youtubeKids/mainWorldHook.ts',
  'ui/quiz': 'src/ui/quiz.ts',
  'parent/options': 'src/parent/options.ts',
};

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const options = {
  entryPoints: Object.entries(ENTRIES).map(([out, input]) => ({ in: input, out })),
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  platform: 'browser',
  sourcemap: dev ? 'inline' : false,
  minify: !dev,
  logLevel: 'info',
  define: { __DEV__: String(dev) },
};

async function copyStatic() {
  await cp('public', 'dist', { recursive: true });
  await cp('src/ui/quiz.html', 'dist/ui/quiz.html');
  await cp('src/ui/styles.css', 'dist/ui/styles.css');
  await cp('src/parent/pinStyles.css', 'dist/ui/pinStyles.css');
  await cp('src/parent/pinStyles.css', 'dist/parent/pinStyles.css');
  await cp('src/parent/options.html', 'dist/parent/options.html');
}

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await copyStatic();
  console.log('[build] watching');
} else {
  await esbuild.build(options);
  await copyStatic();
  console.log('[build] dist ready');
}
