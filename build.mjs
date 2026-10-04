import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !process.env.DEV, write: false, target: 'es2020', legalComments: 'none' });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync('template.html', 'utf8');
const out = tpl.replace('<script>/*BUNDLE*/</script>', () => '<script>' + js + '</script>');
fs.writeFileSync('rainbow-sea-city.html', out);
// local test wrapper (full document)
fs.writeFileSync('test.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + out + '</body></html>');
console.log('bytes', out.length);
// GitHub Pages page: a full document wrapped around the game (doctype + viewport-fit=cover for phones with notches)
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + out + '</body></html>');
fs.writeFileSync('dist/.nojekyll', '');
