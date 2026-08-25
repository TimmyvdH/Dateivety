#!/usr/bin/env node
/**
 * scripts/fetch-images.js
 *
 * Haalt (ontbrekende) activiteitfoto's en vibe-achtergronden op bij Pexels en
 * schrijft ze naar activity-images.json / vibe-backgrounds.json in de repo-root.
 * Draai dit lokaal, NOOIT in de browser — de Pexels-key hoort alleen hier te staan.
 *
 * Gebruik:
 *   PEXELS_KEY=jouw-eigen-key node scripts/fetch-images.js
 *
 * Het script:
 *  - leest ACTIVITIES en ACTIVITY_IMGS uit index.html
 *  - leest de bestaande activity-images.json / vibe-backgrounds.json (indien aanwezig)
 *  - haalt ALLEEN de ontbrekende activiteiten en (optioneel, met --vibes) de
 *    vibe-achtergronden op, zodat je gerust opnieuw kunt draaien na het
 *    toevoegen van een paar nieuwe activiteiten zonder je hele quotum te verbruiken
 *  - respecteert het gratis Pexels-uurlimiet: stopt netjes bij een 429 en bewaart
 *    wat al gelukt is, zodat je het scriptje straks gewoon opnieuw kunt draaien
 */

const fs = require('fs');
const path = require('path');

const PEXELS_KEY = process.env.PEXELS_KEY;
if (!PEXELS_KEY) {
  console.error('Zet PEXELS_KEY als environment variable voordat je dit script draait.');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const IMAGES_JSON = path.join(ROOT, 'activity-images.json');
const VIBES_JSON = path.join(ROOT, 'vibe-backgrounds.json');
const REFRESH_VIBES = process.argv.includes('--vibes');
const DELAY_MS = 300;

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; }
}

function extractBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`Kon "${startMarker}" niet vinden in index.html`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Kon einde van blok "${startMarker}" niet vinden`);
  return src.slice(start, end + endMarker.length);
}

function loadFromIndexHtml() {
  const src = fs.readFileSync(INDEX_HTML, 'utf8');

  const activitiesBlock = extractBlock(src, 'const ACTIVITIES = [', '\n]');
  const ACTIVITIES = eval(activitiesBlock.replace('const ACTIVITIES = ', ''));

  const imgsBlock = extractBlock(src, 'const ACTIVITY_IMGS = {', '\n};');
  const ACTIVITY_IMGS = eval(imgsBlock.replace('const ACTIVITY_IMGS = ', ''));

  const vibeBlock = extractBlock(src, 'const VIBE_BG_QUERIES = {', '\n  };');
  const VIBE_BG_QUERIES = eval(vibeBlock.replace('const VIBE_BG_QUERIES = ', ''));

  return { ACTIVITIES, ACTIVITY_IMGS, VIBE_BG_QUERIES };
}

function stripEmoji(str) {
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}

async function fetchPhoto(query, perPage, orientation) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`;
  const r = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (r.status === 429) return { rateLimited: true };
  if (!r.ok) return { error: `HTTP ${r.status}` };
  const data = await r.json();
  return { photos: data.photos || [] };
}

async function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

async function main() {
  const { ACTIVITIES, ACTIVITY_IMGS, VIBE_BG_QUERIES } = loadFromIndexHtml();
  const images = readJsonSafe(IMAGES_JSON);
  const vibes = readJsonSafe(VIBES_JSON);

  const missing = ACTIVITIES.filter(a => !images[a.id]);
  console.log(`${missing.length} activiteiten zonder foto (van de ${ACTIVITIES.length} totaal).`);

  let rateLimited = false;
  for (const a of missing) {
    if (rateLimited) break;
    const keyword = ACTIVITY_IMGS[a.id] || `${a.name} ${stripEmoji(a.type || '')}`.trim();
    const res = await fetchPhoto(keyword, 1, 'landscape');
    if (res.rateLimited) { rateLimited = true; console.log('Pexels-uurlimiet bereikt, stop hier — draai het script later nog eens.'); break; }
    if (res.photos && res.photos.length) {
      images[a.id] = res.photos[0].src.landscape;
      console.log(`✓ ${a.id} ${a.name}`);
    } else {
      console.log(`✗ geen resultaat voor ${a.id} ${a.name} (${res.error || 'leeg'})`);
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(IMAGES_JSON, JSON.stringify(images));
  console.log(`activity-images.json geschreven, ${Object.keys(images).length} foto's totaal.`);

  if (REFRESH_VIBES && !rateLimited) {
    for (const [vibe, queries] of Object.entries(VIBE_BG_QUERIES)) {
      if (rateLimited) break;
      const res = await fetchPhoto(queries[0], 5, 'portrait');
      if (res.rateLimited) { rateLimited = true; break; }
      if (res.photos && res.photos.length) {
        vibes[vibe] = res.photos.map(p => p.src.large2x || p.src.large);
        console.log(`✓ vibe-achtergrond ${vibe}`);
      }
      await sleep(DELAY_MS);
    }
    fs.writeFileSync(VIBES_JSON, JSON.stringify(vibes));
    console.log('vibe-backgrounds.json bijgewerkt.');
  }

  console.log('Klaar. Commit activity-images.json (en evt. vibe-backgrounds.json) mee.');
}

main().catch(e => { console.error(e); process.exit(1); });
