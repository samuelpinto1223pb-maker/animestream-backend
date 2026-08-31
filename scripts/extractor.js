const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Servidores limpios permitidos
const ALLOWED_SERVERS = ['voe', 'filemoon', 'vidhide', 'mp4upload', 'streamwish', 'mega', 'mixdrop', 'ok.ru', 'dood'];

async function runExtractor() {
  console.log('🚀 Iniciando extractor de respaldo directo...');

  let catalog = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
      catalog = JSON.parse(rawData);
    } catch (e) {
      catalog = [];
    }
  }

  const existingTitles = new Set(catalog.map(item => item.titulo.toLowerCase().trim()));
  const stats = { latanime: 0, henaojara: 0, otakustv: 0, sololatino: 0, ignorados: 0 };

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();

  // ==========================================
  // 1. ANIME: Latanime.org
  // ==========================================
  try {
    console.log('🌐 Escaneando Latanime.org...');
    await page.goto('https://latanime.org/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(5000); // Espera forzada para bypass de Cloudflare

    const animeList = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a');
      links.forEach(a => {
        const href = a.href || '';
        if (href.includes('/anime/') || href.includes('/ver/')) {
          const title = a.innerText.trim() || a.querySelector('h3, .title')?.innerText.trim();
          const img = a.querySelector('img')?.src || '';
          if (title && title.length > 2) {
            items.push({ url: href, title, poster: img });
          }
        }
      });
      return items;
    });

    for (const item of animeList.slice(0, 5)) {
      const cleanTitle = item.title.replace(/Capítulo\s+\d+/i, '').replace(/Episodio\s+\d+/i, '').trim();
      
      if (existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      catalog.push({
        id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        titulo: cleanTitle,
        tipo: 'anime',
        anio: 2026,
        audio: 'Español Latino',
        portada: item.poster,
        episodios: [{
          numero: 1,
          opciones_reproductor: [{ idioma: 'Español Latino', servidor: 'Voe Directo', url: item.url }]
        }]
      });
      existingTitles.add(cleanTitle.toLowerCase());
      stats.latanime++;
    }
  } catch (err) {
    console.log('⚠️ Error procesando Latanime.org');
  }

  // ==========================================
  // 2. PELÍCULAS: Sololatino.net
  // ==========================================
  try {
    console.log('🎬 Escaneando Sololatino.net...');
    await page.goto('https://sololatino.net/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(5000);

    const movieList = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/pelicula/"]');
      links.forEach(a => {
        const title = a.innerText.trim() || a.querySelector('h2, h3, .title')?.innerText.trim();
        const img = a.querySelector('img')?.src || '';
        if (title && title.length > 2) {
          items.push({ url: a.href, title, poster: img });
        }
      });
      return items;
    });

    for (const item of movieList.slice(0, 5)) {
      if (existingTitles.has(item.title.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      catalog.push({
        id: `peli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        titulo: item.title,
        tipo: 'pelicula',
        anio: 2026,
        audio: 'Español Latino',
        portada: item.poster,
        episodios: [{
          numero: 1,
          opciones_reproductor: [{ idioma: 'Español Latino', servidor: 'Servidor Película', url: item.url }]
        }]
      });
      existingTitles.add(item.title.toLowerCase());
      stats.sololatino++;
    }
  } catch (err) {
    console.log('⚠️ Error procesando Sololatino.net');
  }

  // ==========================================
  // REPORTE DE EXTRACCIÓN
  // ==========================================
  console.log('\n=============================================');
  console.log('📊 REPORTE FINAL DE EXTRACCIÓN');
  console.log('=============================================');
  console.log(`✨ Animes (Latanime.org):  ${stats.latanime}`);
  console.log(`🎬 Películas (Sololatino): ${stats.sololatino}`);
  console.log(`🚫 Repetidos omitidos:    ${stats.ignorados}`);
  console.log('---------------------------------------------');
  console.log(`📦 TOTAL EN LATINO.JSON:   ${catalog.length} items`);
  console.log('=============================================\n');

  if (catalog.length > 0) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log('💾 ¡latino.json guardado con éxito!');
  }

  await browser.close();
}

runExtractor();
