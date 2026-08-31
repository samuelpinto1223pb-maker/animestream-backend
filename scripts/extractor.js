const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Servidores limpios permitidos
const ALLOWED_SERVERS = ['voe', 'filemoon', 'vidhide', 'mp4upload', 'streamwish', 'mega', 'mixdrop', 'ok.ru', 'dood'];

// Filtro estricto de anuncios comerciales
const AD_PATTERNS = ['popads', 'popcash', 'adcash', 'adsterra', 'juicyads', 'exoclick', 'propellerads', 'redirect', 'shortener'];

async function runExtractor() {
  console.log('🚀 Iniciando extractor paciente y corregido...');

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
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // Intercepción ligera de publicidad
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url().toLowerCase();
    if (AD_PATTERNS.some(p => url.includes(p))) {
      req.abort();
    } else {
      req.continue();
    }
  });

  function cleanServers(serverList) {
    return serverList.filter(item => ALLOWED_SERVERS.some(server => item.url.toLowerCase().includes(server)));
  }

  // ==========================================
  // 1. ANIME: Latanime.org
  // ==========================================
  try {
    console.log('🌐 [Anime 1] Escaneando Latanime.org...');
    await page.goto('https://latanime.org/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Esperar a que exista al menos un enlace en la página
    await page.waitForSelector('a[href*="/anime/"], a[href*="/ver/"]', { timeout: 15000 }).catch(() => {});

    const animeItems = await page.evaluate(() => {
      const items = [];
      const links = Array.from(document.querySelectorAll('a[href*="/anime/"], a[href*="/ver/"]'));
      
      links.forEach((a) => {
        const titleEl = a.querySelector('.title, h3, .name') || a;
        const imgEl = a.querySelector('img') || a.parentElement.querySelector('img');
        const titleText = titleEl ? titleEl.innerText.trim() : '';

        if (a.href && titleText && titleText.length > 2) {
          items.push({
            url: a.href,
            poster: imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '',
            rawTitle: titleText,
            lang: a.innerText.toLowerCase().includes('castellano') ? 'Español Castellano' : 'Español Latino'
          });
        }
      });
      return items;
    });

    // Limpiar duplicados de la lista capturada
    const uniqueItems = Array.from(new Map(animeItems.map(item => [item.rawTitle, item])).values()).slice(0, 10);

    for (const item of uniqueItems) {
      const cleanTitle = item.rawTitle.replace(/Capítulo\s+\d+/i, '').replace(/Episodio\s+\d+/i, '').trim();

      if (existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('iframe', { timeout: 10000 }).catch(() => {});

        const rawServers = await page.evaluate((lang) => {
          const list = [];
          document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src && !iframe.src.includes('facebook') && !iframe.src.includes('twitter')) {
              list.push({ idioma: lang, servidor: 'Reproductor Directo', url: iframe.src });
            }
          });
          return list;
        }, item.lang);

        const validServers = cleanServers(rawServers);
        const serversToSave = validServers.length > 0 ? validServers : rawServers;

        if (serversToSave.length > 0) {
          catalog.push({
            id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            titulo: cleanTitle,
            tipo: 'anime',
            anio: 2026,
            audio: item.lang,
            portada: item.poster,
            episodios: [{ numero: 1, opciones_reproductor: serversToSave }]
          });
          existingTitles.add(cleanTitle.toLowerCase());
          stats.latanime++;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error de conexión con Latanime.org');
  }

  // ==========================================
  // 2. PELÍCULAS: Sololatino.net
  // ==========================================
  try {
    console.log('🎬 [Películas] Escaneando Sololatino.net...');
    await page.goto('https://sololatino.net/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('a[href*="/pelicula/"], a[href*="/ver/"]', { timeout: 15000 }).catch(() => {});

    const movieItems = await page.evaluate(() => {
      const items = [];
      const links = Array.from(document.querySelectorAll('a[href*="/pelicula/"]'));

      links.forEach((a) => {
        const titleEl = a.querySelector('.title, h2, h3') || a;
        const imgEl = a.querySelector('img');
        const titleText = titleEl ? titleEl.innerText.trim() : '';

        if (a.href && titleText && titleText.length > 2) {
          items.push({
            url: a.href,
            poster: imgEl ? imgEl.src : '',
            title: titleText
          });
        }
      });
      return items;
    });

    const uniqueMovies = Array.from(new Map(movieItems.map(item => [item.title, item])).values()).slice(0, 10);

    for (const item of uniqueMovies) {
      if (existingTitles.has(item.title.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('iframe', { timeout: 10000 }).catch(() => {});

        const rawServers = await page.evaluate(() => {
          const list = [];
          document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src && !iframe.src.includes('facebook')) {
              list.push({ idioma: 'Español Latino', servidor: 'Servidor Película', url: iframe.src });
            }
          });
          return list;
        });

        const validServers = cleanServers(rawServers);
        const serversToSave = validServers.length > 0 ? validServers : rawServers;

        if (serversToSave.length > 0) {
          catalog.push({
            id: `peli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            titulo: item.title,
            tipo: 'pelicula',
            anio: 2026,
            audio: 'Español Latino',
            portada: item.poster,
            episodios: [{ numero: 1, opciones_reproductor: serversToSave }]
          });
          existingTitles.add(item.title.toLowerCase());
          stats.sololatino++;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error de conexión con Sololatino.net');
  }

  // ==========================================
  // REPORTE FINAL
  // ==========================================
  console.log('\n=============================================');
  console.log('📊 REPORTE DE EXTRACCIÓN Y ESTADÍSTICAS');
  console.log('=============================================');
  console.log(`✨ Animes Nuevos de Latanime.org:  ${stats.latanime}`);
  console.log(`✨ Animes Nuevos de Henaojara.com: ${stats.henaojara}`);
  console.log(`✨ Animes Nuevos de Otakustv.net:  ${stats.otakustv}`);
  console.log(`🎬 Películas Nuevas (SoloLatino): ${stats.sololatino}`);
  console.log(`🚫 Repetidos u omitidos:          ${stats.ignorados}`);
  console.log('---------------------------------------------');
  console.log(`📦 TOTAL ACUMULADO EN LATINO.JSON: ${catalog.length} items`);
  console.log('=============================================\n');

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log('💾 Archivo latino.json actualizado y guardado correctamente.');

  await browser.close();
}

runExtractor();
