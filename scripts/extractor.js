const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JSON_PATH = path.join(__dirname, '../latino.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

async function runExtractor() {
  console.log('🚀 Iniciando extractor de Animes (Latanime, JKAnime, AnimeFLV)...');

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
  const stats = { latanime: 0, jkanime: 0, animeflv: 0, ignorados: 0 };

  // ==========================================
  // 1. LATANIME.ORG
  // ==========================================
  try {
    console.log('🌐 Escaneando Latanime.org...');
    const res = await axios.get('https://latanime.org/', { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const animePromesas = [];

    $('a[href*="/anime/"], a[href*="/ver/"]').each((i, el) => {
      if (animePromesas.length >= 6) return;

      const url = $(el).attr('href');
      let rawTitle = $(el).find('.title, h3, .name').first().text().trim();
      if (!rawTitle) rawTitle = $(el).text().split('\n')[0].trim();

      let img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      if (img.includes('capblank.png') || !img) {
        img = $(el).find('div[style*="background"]').css('background-image') || '';
        img = img.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
      }

      const fullUrl = url ? (url.startsWith('http') ? url : `https://latanime.org${url}`) : '';
      if (rawTitle && rawTitle.length > 2 && fullUrl) {
        animePromesas.push({ url: fullUrl, rawTitle, poster: img });
      }
    });

    for (const item of animePromesas) {
      const cleanTitle = item.rawTitle.split('\n')[0].replace(/Capítulo\s+\d+/i, '').trim();
      if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src') || $$(iframe).attr('data-src');
          if (src && !src.includes('facebook') && !src.includes('twitter')) {
            servers.push({
              idioma: 'Español Latino',
              servidor: 'Reproductor Directo',
              url: src.startsWith('//') ? `https:${src}` : src
            });
          }
        });

        if (servers.length === 0) servers.push({ idioma: 'Español Latino', servidor: 'Ver en Web', url: item.url });

        catalog.push({
          id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: cleanTitle,
          tipo: 'anime',
          anio: 2026,
          audio: 'Español Latino',
          portada: item.poster.startsWith('/') ? `https://latanime.org${item.poster}` : item.poster,
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
  // 2. JKANIME.NET
  // ==========================================
  try {
    console.log('🌐 Escaneando JKAnime.net...');
    const res = await axios.get('https://jkanime.net/', { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const jkPromesas = [];

    $('.anime__item, .items .item').each((i, el) => {
      if (jkPromesas.length >= 6) return;

      const link = $(el).find('a').first();
      const url = link.attr('href');
      const title = $(el).find('h5, h2, .title').first().text().trim();
      const img = $(el).find('.anime__item__pic, div[data-setbg]').attr('data-setbg') || $(el).find('img').attr('src') || '';

      if (title && url) {
        jkPromesas.push({ url, title, poster: img });
      }
    });

    for (const item of jkPromesas) {
      const cleanTitle = item.title.trim();
      if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src') || $$(iframe).attr('data-src');
          if (src && !src.includes('facebook')) {
            servers.push({
              idioma: 'Subtitulado / Latino',
              servidor: 'Reproductor Directo',
              url: src.startsWith('//') ? `https:${src}` : src
            });
          }
        });

        if (servers.length === 0) servers.push({ idioma: 'Subtitulado / Latino', servidor: 'Ver en JKAnime', url: item.url });

        catalog.push({
          id: `anime-jk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: cleanTitle,
          tipo: 'anime',
          anio: 2026,
          audio: 'Subtitulado / Latino',
          portada: item.poster,
          episodios: [{ numero: 1, opciones_reproductor: servers }]
        });

        existingTitles.add(cleanTitle.toLowerCase());
        stats.jkanime++;
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con JKAnime.net:', err.message);
  }

  // ==========================================
  // 3. ANIMEFLV.NET (Sin "www." para evitar fallos de DNS)
  // ==========================================
  try {
    console.log('🌐 Escaneando AnimeFLV.net...');
    const res = await axios.get('https://animeflv.net/', { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const flvPromesas = [];

    $('.ListEpisodios li a, .ListAnimes li a').each((i, el) => {
      if (flvPromesas.length >= 6) return;

      const url = $(el).attr('href');
      const title = $(el).find('.Title').text().trim() || $(el).find('strong').text().trim();
      const img = $(el).find('img').attr('src') || '';

      if (title && url) {
        const fullUrl = url.startsWith('http') ? url : `https://animeflv.net${url}`;
        const fullImg = img.startsWith('http') ? img : `https://animeflv.net${img}`;
        flvPromesas.push({ url: fullUrl, title, poster: fullImg });
      }
    });

    for (const item of flvPromesas) {
      const cleanTitle = item.title.trim();
      if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src') || $$(iframe).attr('data-src');
          if (src && !src.includes('facebook')) {
            servers.push({
              idioma: 'Subtitulado / Latino',
              servidor: 'Reproductor Directo',
              url: src.startsWith('//') ? `https:${src}` : src
            });
          }
        });

        if (servers.length === 0) servers.push({ idioma: 'Subtitulado / Latino', servidor: 'Ver en AnimeFLV', url: item.url });

        catalog.push({
          id: `anime-flv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: cleanTitle,
          tipo: 'anime',
          anio: 2026,
          audio: 'Subtitulado / Latino',
          portada: item.poster,
          episodios: [{ numero: 1, opciones_reproductor: servers }]
        });

        existingTitles.add(cleanTitle.toLowerCase());
        stats.animeflv++;
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con AnimeFLV.net:', err.message);
  }

  // ==========================================
  // REPORTE FINAL Y GUARDADO
  // ==========================================
  console.log('\n=============================================');
  console.log('📊 REPORTE FINAL DE EXTRACCIÓN (3 FUENTES)');
  console.log('=============================================');
  console.log(`✨ Latanime.org:  ${stats.latanime}`);
  console.log(`✨ JKAnime.net:   ${stats.jkanime}`);
  console.log(`✨ AnimeFLV.net:  ${stats.animeflv}`);
  console.log(`🚫 Omitidos (ya existían): ${stats.ignorados}`);
  console.log('---------------------------------------------');
  console.log(`📦 TOTAL EN LATINO.JSON: ${catalog.length} items`);
  console.log('=============================================\n');

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log('💾 Archivo latino.json actualizado correctamente con las 3 fuentes.');
}

runExtractor();
