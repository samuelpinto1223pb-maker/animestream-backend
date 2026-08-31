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
  console.log('🚀 Iniciando extractor completo y actualizador de Animes...');

  let catalog = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
      catalog = JSON.parse(rawData);
    } catch (e) {
      catalog = [];
    }
  }

  // Mapa para buscar rápidamente animes existentes por título
  const catalogMap = new Map(catalog.map(item => [item.titulo.toLowerCase().trim(), item]));
  const stats = { agregados: 0, actualizados: 0, sinCambios: 0 };

  // ==========================================
  // 1. LATANIME.ORG (Escaneo Ampliado)
  // ==========================================
  try {
    console.log('🌐 Escaneando Latanime.org (página completa)...');
    const res = await axios.get('https://latanime.org/', { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);
    const animePromesas = [];

    $('a[href*="/anime/"], a[href*="/ver/"]').each((i, el) => {
      if (animePromesas.length >= 50) return; // Escanea toda la portada (hasta 50 items)

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
      if (!cleanTitle) continue;

      const titleKey = cleanTitle.toLowerCase();

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

        const posterUrl = item.poster.startsWith('/') ? `https://latanime.org${item.poster}` : item.poster;

        // Si el anime ya existe, actualizamos sus reproductores/portada si hay cambios
        if (catalogMap.has(titleKey)) {
          const existingAnime = catalogMap.get(titleKey);
          let updated = false;

          if (servers.length > 0) {
            existingAnime.episodios[0].opciones_reproductor = servers;
            updated = true;
          }
          if (posterUrl && existingAnime.portada !== posterUrl) {
            existingAnime.portada = posterUrl;
            updated = true;
          }

          if (updated) stats.actualizados++;
          else stats.sinCambios++;
        } else {
          // Si es un anime o temporada nueva, lo agregamos
          const newAnime = {
            id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            titulo: cleanTitle,
            tipo: 'anime',
            anio: 2026,
            audio: 'Español Latino',
            portada: posterUrl,
            episodios: [{ numero: 1, opciones_reproductor: servers }]
          };
          catalog.push(newAnime);
          catalogMap.set(titleKey, newAnime);
          stats.agregados++;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con Latanime.org:', err.message);
  }

  // ==========================================
  // 2. JKANIME.NET (Escaneo Ampliado)
  // ==========================================
  try {
    console.log('🌐 Escaneando JKAnime.net (página completa)...');
    const res = await axios.get('https://jkanime.net/', { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);
    const jkPromesas = [];

    $('.anime__item, .items .item').each((i, el) => {
      if (jkPromesas.length >= 50) return; // Escanea toda la portada (hasta 50 items)

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
      if (!cleanTitle) continue;

      const titleKey = cleanTitle.toLowerCase();

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

        if (catalogMap.has(titleKey)) {
          const existingAnime = catalogMap.get(titleKey);
          let updated = false;

          if (servers.length > 0) {
            existingAnime.episodios[0].opciones_reproductor = servers;
            updated = true;
          }
          if (item.poster && existingAnime.portada !== item.poster) {
            existingAnime.portada = item.poster;
            updated = true;
          }

          if (updated) stats.actualizados++;
          else stats.sinCambios++;
        } else {
          const newAnime = {
            id: `anime-jk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            titulo: cleanTitle,
            tipo: 'anime',
            anio: 2026,
            audio: 'Subtitulado / Latino',
            portada: item.poster,
            episodios: [{ numero: 1, opciones_reproductor: servers }]
          };
          catalog.push(newAnime);
          catalogMap.set(titleKey, newAnime);
          stats.agregados++;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con JKAnime.net:', err.message);
  }

  // ==========================================
  // REPORTE FINAL Y GUARDADO
  // ==========================================
  console.log('\n=============================================');
  console.log('📊 REPORTE DE ESCANEO COMPLETO');
  console.log('=============================================');
  console.log(`✨ Animes/Temporadas nuevas agregadas: ${stats.agregados}`);
  console.log(`🔄 Animes/Capítulos actualizados:      ${stats.actualizados}`);
  console.log(`☕ Sin cambios (ya al día):           ${stats.sinCambios}`);
  console.log('---------------------------------------------');
  console.log(`📦 TOTAL ACUMULADO EN LATINO.JSON: ${catalog.length} items`);
  console.log('=============================================\n');

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log('💾 Archivo latino.json actualizado con éxito.');
}

runExtractor();
