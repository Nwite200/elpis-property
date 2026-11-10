#!/usr/bin/env node
// Download the exact Google Fonts files used by the site and build a local
// @font-face stylesheet. The visual result is identical; only the delivery
// changes (no third-party CSS/DNS/TLS round trips).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FONT_DIR = 'assets/fonts';
mkdirSync(FONT_DIR, { recursive: true });

const urls = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Manrope:wght@500;600;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Manrope:wght@500;600;700;800&family=Space+Mono:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap'
];

const latin = /U\+0000-00FF/i;
const latinExt = /U\+0100-024F/i;
const blocks = new Map();
const files = new Map();
let downloads = 0;
let bytes = 0;

function parseBlock(raw) {
  const family = (raw.match(/font-family:\s*'([^']+)'/) || [])[1];
  const style = (raw.match(/font-style:\s*([^;]+);/) || [])[1] || 'normal';
  const weight = (raw.match(/font-weight:\s*([^;]+);/) || [])[1] || '400';
  const stretch = (raw.match(/font-stretch:\s*([^;]+);/) || [])[1] || null;
  const display = (raw.match(/font-display:\s*([^;]+);/) || [])[1] || 'swap';
  const range = (raw.match(/unicode-range:\s*([^;]+);/) || [])[1] || null;
  const src = (raw.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/) || [])[1];
  if (!family || !src) return null;
  if (range && !latin.test(range) && !latinExt.test(range)) return null;
  return { family, style, weight, stretch, display, range, src };
}

for (const url of urls) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`font css ${res.status} for ${url}`);
  const css = await res.text();
  for (const part of css.split('@font-face').slice(1)) {
    const block = parseBlock(part);
    if (!block) continue;
    const key = [block.family, block.style, block.weight, block.stretch || '', block.range || ''].join('|');
    if (blocks.has(key)) continue;
    if (!files.has(block.src)) {
      const fileRes = await fetch(block.src, { headers: { 'User-Agent': UA } });
      if (!fileRes.ok) throw new Error(`font file ${fileRes.status} for ${block.src}`);
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const hash = createHash('sha1').update(block.src).digest('hex').slice(0, 10);
      const base = block.src.split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${hash}-${base}`;
      writeFileSync(join(FONT_DIR, filename), buffer);
      files.set(block.src, filename);
      downloads += 1;
      bytes += buffer.length;
    }
    blocks.set(key, { ...block, filename: files.get(block.src) });
  }
}

const rules = [...blocks.values()].map(b => `@font-face {
  font-family: '${b.family}';
  font-style: ${b.style};
  font-weight: ${b.weight};${b.stretch ? `\n  font-stretch: ${b.stretch};` : ''}
  font-display: ${b.display};
  src: url('./${b.filename}') format('woff2');${b.range ? `\n  unicode-range: ${b.range};` : ''}
}`).join('\n\n');

writeFileSync(join(FONT_DIR, 'fonts.css'), `/* Elpis Property Limited — self-hosted Google Fonts (exact files).\n   Regenerate with: node scripts/build_fonts.mjs */\n\n${rules}\n`);

function findPreload(family, weight) {
  const block = [...blocks.values()].find(b => b.family === family && b.style === 'normal' && b.weight === weight && b.range && latin.test(b.range));
  return block ? block.filename : null;
}
const preloads = {
  'DM Sans': findPreload('DM Sans', '400') || findPreload('DM Sans', '400 700'),
  'Cormorant Garamond': findPreload('Cormorant Garamond', '600'),
  'Manrope': findPreload('Manrope', '700'),
  'Space Mono': findPreload('Space Mono', '400')
};
writeFileSync(join(FONT_DIR, 'preloads.json'), JSON.stringify(preloads, null, 2) + '\n');

console.log(`downloaded ${downloads} font files (${(bytes / 1024).toFixed(1)} KB), ${blocks.size} @font-face rules`);
console.log('preloads', preloads);
console.log('font files on disk', readdirSync(FONT_DIR).filter(f => f.endsWith('.woff2')).length);
console.log('css bytes', readFileSync(join(FONT_DIR, 'fonts.css')).length);
