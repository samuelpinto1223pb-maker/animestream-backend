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
  console.log('🚀 Iniciando extractor corregido (Limpieza de títulos y portadas real)...');

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
      // Obtener únicamente el texto de etiquetas de título o la primera línea limpia
      let rawTitle = $(el).find('.title, h3, .name').first().text().trim();
      if (!rawTitle) {
        rawTitle = $(el).text().split('\n')[0].trim();
      }

      // Obtener imagen real evitando la imagen en blanco (capblank.png)
      let img = $(el).find('img').attr('data-src') || 
                $(el).find('img').attr('src') || 
                $(el).find('img').attr('data-lazy-src') || '';

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
      // Limpiar Saltos de línea, caracteres extraños y palabras de capítulo/episodio
      const cleanTitle = item.rawTitle
        .split('\n')[0]
        .replace(/Capítulo\s+\d+/i, '')
        .replace(/Episodio\s+\d+/i, '')
        .trim();

      if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 10000 });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        // Capturar la imagen real si en la lista era capblank
        let realPoster = item.poster;
        if (!realPoster || realPoster.includes('capblank.png')) {
          realPoster = $$('.anime-single img, .poster img, meta[property="og:image"]').first().attr('src') ||
                       $$('meta[property="og:image"]').attr('content') || '';
        }

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src') || $$(iframe).attr('data-src');
          if (src && !src.includes('facebook') && !src.includes('twitter') && !src.includes('disqus')) {
            servers.push({ idioma: 'Español Latino', servidor: 'Reproductor Directo', url: src });
          }
        });

        if (servers.length === 0) {
          servers.push({ idioma: 'Español Latino', servidor: 'Ver en Web', url: item.url });
        }

        catalog.push({
          id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: cleanTitle,
          tipo: 'anime',
          anio: 2026,
          audio: 'Español Latino',
          portada: realPoster.startsWith('/') ? `https://latanime.org${realPoster}` : realPoster,
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
  // 2. PELÍCULAS: Sololatino.net
  // ==========================================
  try {
    console.log('🎬 Escaneando Sololatino.net...');
    const res = await axios.get('https://sololatino.net/', {
      headers: {
        ...HEADERS,
        'Referer': 'https://sololatino.net/'
      },
      timeout: 15000
    });
    const $ = cheerio.load(res.data);

    const peliPromesas = [];

    $('a[href*="/pelicula/"]').each((i, el) => {
      if (peliPromesas.length >= 8) return;

      const url = $(el).attr('href');
      let title = $(el).find('.title, h2, h3').first().text().trim() || $(el).text().split('\n')[0].trim();
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const fullUrl = url ? (url.startsWith('http') ? url : `https://sololatino.net${url}`) : '';

      if (title && title.length > 2 && fullUrl) {
        peliPromesas.push({ url: fullUrl, title, poster: img });
      }
    });

    for (const item of peliPromesas) {
      const cleanTitle = item.title.split('\n')[0].trim();

      if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) {
        stats.ignorados++;
        continue;
      }

      try {
        const detailRes = await axios.get(item.url, {
          headers: {
            ...HEADERS,
            'Referer': 'https://sololatino.net/'
          },
          timeout: 10000
        });
        const $$ = cheerio.load(detailRes.data);
        const servers = [];

        $$('iframe').each((_, iframe) => {
          const src = $$(iframe).attr('src') || $$(iframe).attr('data-src');
          if (src && !src.includes('facebook')) {
            servers.push({ idioma: 'Español Latino', servidor: 'Servidor Película', url: src });
          }
        });

        if (servers.length === 0) {
          servers.push({ idioma: 'Español Latino', servidor: 'Servidor Película', url: item.url });
        }

        catalog.push({
          id: `peli-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          titulo: cleanTitle,
          tipo: 'pelicula',
          anio: 2026,
          audio: 'Español Latino',
          portada: item.poster.startsWith('/') ? `https://sololatino.net${item.poster}` : item.poster,
          episodios: [{ numero: 1, opciones_reproductor: servers }]
        });

        existingTitles.add(cleanTitle.toLowerCase());
        stats.sololatino++;
      } catch (e) {}
    }
  } catch (err) {
    console.log('⚠️ Error al conectar con Sololatino.net:', err.message);
  }

  // ==========================================
  // REPORTE FINAL Y GUARDADO
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

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log('💾 Archivo latino.json actualizado y guardado correctamente.');
}

runExtractor();
