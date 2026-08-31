const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Headers para simular un navegador real y saltar bloqueos
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

async function runExtractor() {
  console.log('🚀 Iniciando extractor ligero y directo (Axios + Cheerio)...');

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
  const stats = { latanime: 0, sololatino: 0, ignorados: 0 };

  // ==========================================
  // 1. ANIME: Latanime.org
  // ==========================================
  try {
    console.log('🌐 Escaneando Latanime.org...');
    const res = await axios.get('https://latanime.org/', { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const animePromesas = [];

    $('a[href*="/anime/"], a[href*="/ver/"]').each((i, el) => {
      if (animePromesas.length >= 8) return;

      const url = $(el).attr('href');
      const rawTitle = $(el).find('.title, h3, .name').text().trim() || $(el).text().trim();
      const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      const fullUrl = url.startsWith('http') ? url : `https://latanime.org${url}`;

      if (rawTitle && rawTitle.length > 2) {
        animePromesas.push({ url: fullUrl, rawTitle, poster: img });
      }
    });

    for (const item of animePromesas) {
      const cleanTitle = item.rawTitle.replace(/Capítulo\s+\d+/i, '').replace(/Episodio\s+\d+/i, '').trim();

      if (existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src');
          if (src && !src.includes('facebook') && !src.includes('twitter')) {
            servers.push({ idioma: 'Español Latino', servidor: 'Reproductor Directo', url: src });
          }
        });

        if (servers.length === 0) {
          servers.push({ idioma: 'Español Latino', servidor: 'Enlace Directo', url: item.url });
        }

        catalog.push({
          id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: cleanTitle,
          tipo: 'anime',
          anio: 2026,
          audio: 'Español Latino',
          portada: item.poster,
          episodios: [{ numero: 1, opciones_reproductor: servers }]
        });

        existingTitles.add(cleanTitle.toLowerCase());
        stats.latanime++;
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con Latanime.org:', err.message);
  }

  // ==========================================
  // 2. PELÍCULAS: Sololatino.net (Privado)
  // ==========================================
  try {
    console.log('🎬 Escaneando Sololatino.net...');
    const res = await axios.get('https://sololatino.net/', { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const peliPromesas = [];

    $('a[href*="/pelicula/"]').each((i, el) => {
      if (peliPromesas.length >= 8) return;

      const url = $(el).attr('href');
      const title = $(el).find('.title, h2, h3').text().trim() || $(el).text().trim();
      const img = $(el).find('img').attr('src') || '';
      const fullUrl = url.startsWith('http') ? url : `https://sololatino.net${url}`;

      if (title && title.length > 2) {
        peliPromesas.push({ url: fullUrl, title, poster: img });
      }
    });

    for (const item of peliPromesas) {
      if (existingTitles.has(item.title.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src');
          if (src && !src.includes('facebook')) {
            servers.push({ idioma: 'Español Latino', servidor: 'Servidor Película', url: src });
          }
        });

        if (servers.length === 0) {
          servers.push({ idioma: 'Español Latino', servidor: 'Servidor Película', url: item.url });
        }

        catalog.push({
          id: `peli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: item.title,
          tipo: 'pelicula',
          anio: 2026,
          audio: 'Español Latino',
          portada: item.poster,
          episodios: [{ numero: 1, opciones_reproductor: servers }]
        });

        existingTitles.add(item.title.toLowerCase());
        stats.sololatino++;
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con Sololatino.net:', err.message);
  }

  // ==========================================
  // REPORTE FINAL
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
    console.log('💾 Archivo latino.json actualizado y guardado correctamente.');
  }

}

runExtractor();
