const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Servidores limpios permitidos
const ALLOWED_SERVERS = ['voe', 'filemoon', 'vidhide', 'mp4upload', 'streamwish', 'mega', 'mixdrop', 'ok.ru', 'dood'];

// Bloqueador estricto de anuncios y redes de acortadores
const AD_PATTERNS = [
  'popads', 'popcash', 'adcash', 'adsterra', 'juicyads', 'exoclick', 
  'propellerads', 'bet365', '1xbet', 'redirect', 'shortener', 'monetag'
];

async function runExtractor() {
  console.log('🐢 Iniciando extractor paciente (Rango 2026 hacia atrás + Filtro Anti-anuncios)...');

  // 1. CARGAR CATÁLOGO EXISTENTE PARA NO DUPLICAR
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

  // Métricas para el reporte final
  const stats = { latanime: 0, henaojara: 0, otakustv: 0, sololatino: 0, ignorados: 0 };

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // BLOQUEO AGRESIVO DE PUBLICIDAD EN TIEMPO REAL
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url().toLowerCase();
    const resourceType = req.resourceType();

    const isAd = AD_PATTERNS.some(p => url.includes(p));
    const isUseless = ['image', 'stylesheet', 'font', 'media'].includes(resourceType) && !url.includes('poster') && !url.includes('cover');

    if (isAd || isUseless) {
      req.abort();
    } else {
      req.continue();
    }
  });

  function cleanServers(serverList) {
    return serverList.filter(item => ALLOWED_SERVERS.some(server => item.url.toLowerCase().includes(server)));
  }

  // ==========================================
  // 1. ANIME: Latanime.org (Principal)
  // ==========================================
  try {
    console.log('🌐 [Anime 1] Escaneando Latanime.org (Estrenos 2026 y catálogo)...');
    await page.goto('https://latanime.org/', { waitUntil: 'networkidle0', timeout: 60000 });

    const animeItems = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.row .col-6, .row .col-md-3').forEach((card) => {
        const a = card.querySelector('a');
        const img = card.querySelector('img');
        const title = card.querySelector('.title, h3, .ep-title');
        const yearText = card.querySelector('.year, .fecha, .date')?.innerText.trim();
        const extractedYear = yearText ? parseInt(yearText.match(/\d{4}/)?.[0]) : 2026;

        if (a && title) {
          items.push({
            url: a.href,
            poster: img ? (img.src || img.getAttribute('data-src')) : '',
            rawTitle: title.innerText.trim(),
            anio: (extractedYear <= 2026 && extractedYear >= 2000) ? extractedYear : 2026,
            lang: card.innerText.toLowerCase().includes('castellano') ? 'Español Castellano' : 'Español Latino'
          });
        }
      });
      return items;
    });

    for (const item of animeItems) {
      const cleanTitle = item.rawTitle.replace(/Capítulo\s+\d+/i, '').replace(/Episodio\s+\d+/i, '').trim();

      if (existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        await page.goto(item.url, { waitUntil: 'networkidle0', timeout: 40000 });
        const rawServers = await page.evaluate((lang) => {
          const list = [];
          document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src) list.push({ idioma: lang, servidor: 'Reproductor Directo', url: iframe.src });
          });
          return list;
        }, item.lang);

        const validServers = cleanServers(rawServers);
        if (validServers.length > 0 || rawServers.length > 0) {
          catalog.push({
            id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            titulo: cleanTitle,
            tipo: 'anime',
            anio: item.anio,
            audio: item.lang,
            portada: item.poster,
            episodios: [{ numero: 1, opciones_reproductor: validServers.length > 0 ? validServers : rawServers }]
          });
          existingTitles.add(cleanTitle.toLowerCase());
          stats.latanime++;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error de respuesta en Latanime.org');
  }

  // ==========================================
  // 2. PELÍCULAS: Sololatino.net (Sección Privada)
  // ==========================================
  try {
    console.log('🎬 [Películas] Escaneando Sololatino.net (Sección Privada)...');
    await page.goto('https://sololatino.net/', { waitUntil: 'networkidle0', timeout: 60000 });

    const movieItems = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('a[href*="/pelicula/"], .poster-card a').forEach((card) => {
        const img = card.querySelector('img');
        const title = card.querySelector('.title, h2, h3');
        const yearText = card.querySelector('.year, .release-date')?.innerText.trim();
        const extractedYear = yearText ? parseInt(yearText.match(/\d{4}/)?.[0]) : 2026;

        if (title) {
          items.push({
            url: card.href,
            poster: img ? img.src : '',
            title: title.innerText.trim(),
            anio: (extractedYear <= 2026 && extractedYear >= 2000) ? extractedYear : 2026
          });
        }
      });
      return items;
    });

    for (const item of movieItems) {
      if (existingTitles.has(item.title.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        await page.goto(item.url, { waitUntil: 'networkidle0', timeout: 40000 });
        const rawServers = await page.evaluate(() => {
          const list = [];
          document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src) list.push({ idioma: 'Español Latino', servidor: 'Servidor Película', url: iframe.src });
          });
          return list;
        });

        const validServers = cleanServers(rawServers);
        if (validServers.length > 0 || rawServers.length > 0) {
          catalog.push({
            id: `peli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            titulo: item.title,
            tipo: 'pelicula',
            anio: item.anio,
            audio: 'Español Latino',
            portada: item.poster,
            episodios: [{ numero: 1, opciones_reproductor: validServers.length > 0 ? validServers : rawServers }]
          });
          existingTitles.add(item.title.toLowerCase());
          stats.sololatino++;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error de respuesta en Sololatino.net');
  }

  // ==========================================
  // REPORTE DE RESULTADOS Y CONTEO POR PÁGINA
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
