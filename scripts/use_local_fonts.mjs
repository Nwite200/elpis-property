#!/usr/bin/env node
// Replace third-party Google Fonts links with the self-hosted stylesheet.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const preloads = JSON.parse(readFileSync('assets/fonts/preloads.json', 'utf8'));
const fontPath = name => `assets/fonts/${preloads[name]}`;
const preloadTag = (name) => name && preloads[name]
  ? `  <link rel="preload" href="${fontPath(name)}" as="font" type="font/woff2" crossorigin>`
  : '';

const pages = readdirSync('.').filter(f => f.endsWith('.html'));
let changed = 0;
for (const page of pages) {
  let html = readFileSync(page, 'utf8');
  if (!html.includes('fonts.googleapis.com')) continue;
  const hasCormorant = /family=Cormorant\+Garamond/.test(html);
  const hasManrope = /family=Manrope/.test(html);
  html = html
    .replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\r?\n/g, '')
    .replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\r?\n/g, '');

  const tags = [preloadTag('DM Sans')];
  if (hasCormorant) tags.push(preloadTag('Cormorant Garamond'));
  if (hasManrope) tags.push(preloadTag('Manrope'));
  const replacement = `${tags.filter(Boolean).join('\n')}\n  <link rel="stylesheet" href="assets/fonts/fonts.css">`;

  html = html.replace(/<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"[^>]*>/g, replacement);
  writeFileSync(page, html);
  changed += 1;
}
console.log(`updated ${changed} pages`);
