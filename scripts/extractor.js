const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JSON_PATH = path.join(__dirname, '../latino.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,ja;q=0.7'
};

// Número de páginas del directorio a recorrer por fuente
const MAX_PAGINAS_DIRECTORIO = 5;

// Función para extraer el número de temporada a partir del título
function detectarTemporada(titulo) {
  const match = titulo.match(/(?:season|temporada|st|nd|rd|th\s+season)\s*(\d+)/i) || 
                titulo.match(/\s+T(\d+)\b/i) || 
                titulo.match(/\s+(\d+)nd\s+Season/i) ||
                titulo.match(/\s+(\d+)rd\s+Season/i) ||
                titulo.match(/\s+(\d+)th\s+Season/i);
  return match ? parseInt(match[1], 10) : 1;
}

// Función para detectar el idioma desde el título o etiquetas
function detectarIdioma(texto) {
  const t = texto.toLowerCase();
  const idiomas = [];
  if (t.includes('latino') || t.includes('lat')) idiomas.push('Español Latino');
  if (t.includes('castellano') || t.includes('esp')) idiomas.push('Castellano');
  if (t.includes('sub') || t.includes('subtitulado') || t.includes('japanese')) idiomas.push('Subtitulado');
  
  return idiomas.length > 0 ? idiomas.join(' / ') : 'Multi-Idioma (Latino / Castellano / Sub)';
}

async function runExtractor() {
  console.log('🚀 Iniciando EXTRACCIÓN ULTRA COMPLETA (Temporadas, Episodios, Reproductores e Idiomas)...');

  let catalog = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    } catch (e) {
      catalog = [];
    }
  }

  const catalogMap = new Map(catalog.map(item => [item.titulo.toLowerCase().trim(), item]));
  const stats = { animesNuevos: 0, animesActualizados: 0, episodiosExtraidos: 0 };

  // ==========================================
  // 1. LATANIME.ORG (Temporadas y Episodios)
  // ==========================================
  console.log('🌐 Escaneando catálogo de Latanime.org...');
  for (let page = 1; page <= MAX_PAGINAS_DIRECTORIO; page++) {
    try {
      const dirUrl = `https://latanime.org/buscar?q=&page=${page}`;
      const res = await axios.get(dirUrl, { headers: HEADERS, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const items = [];

      $('a[href*="/anime/"]').each((_, el) => {
        const url = $(el).attr('href');
        let title = $(el).find('.title, h3, .name').first().text().trim() || $(el).text().split('\n')[0].trim();
        let img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';

        if (title && url) {
          const fullUrl = url.startsWith('http') ? url : `https://latanime.org${url}`;
          items.push({ url: fullUrl, title, poster: img });
        }
      });

      for (const item of items) {
        const cleanTitle = item.title.replace(/Capítulo\s+\d+/i, '').trim();
        if (!cleanTitle) continue;

        const titleKey = cleanTitle.toLowerCase();
        const numTemporada = detectarTemporada(cleanTitle);
        const idiomaDetectado = detectarIdioma(cleanTitle);

        try {
          const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 12000 });
          const $$ = cheerio.load(detailRes.data);

          // Extraer lista de episodios de la ficha del anime
          const listaEpisodios = [];
          $$('a[href*="/ver/"]').each((_, epEl) => {
            const epUrl = $$(epEl).attr('href');
            const epText = $$(epEl).text().trim();
            const epMatch = epText.match(/(\d+)/);
            const numEpisodio = epMatch ? parseInt(epMatch[1], 10) : 1;

            if (epUrl) {
              const fullEpUrl = epUrl.startsWith('http') ? epUrl : `https://latanime.org${epUrl}`;
              listaEpisodios.push({ numero: numEpisodio, url: fullEpUrl });
            }
          });

          // Si no encontró lista explícita, procesa la URL principal
          if (listaEpisodios.length === 0) {
            listaEpisodios.push({ numero: 1, url: item.url });
          }

          const episodiosEstructurados = [];

          // Escanear reproductores de cada episodio
          for (const ep of listaEpisodios.slice(0, 24)) { // Escanea hasta 24 caps por anime
            try {
              const epRes = await axios.get(ep.url, { headers: HEADERS, timeout: 8000 });
              const $$$ = cheerio.load(epRes.data);
              const servers = [];

              $$$('iframe').each((_, iframe) => {
                const src = $$$(iframe).attr('src') || $$$(iframe).attr('data-src');
                if (src && !src.includes('facebook') && !src.includes('twitter')) {
                  servers.push({
                    idioma: idiomaDetectado,
                    servidor: 'Reproductor Directo',
                    url: src.startsWith('//') ? `https:${src}` : src
                  });
                }
              });

              if (servers.length === 0) {
                servers.push({ idioma: idiomaDetectado, servidor: 'Ver en Web', url: ep.url });
              }

              episodiosEstructurados.push({
                numero: ep.numero,
                temporada: numTemporada,
                opciones_reproductor: servers
              });
              stats.episodiosExtraidos++;
            } catch (e) {}
          }

          const posterUrl = item.poster.startsWith('/') ? `https://latanime.org${item.poster}` : item.poster;

          if (catalogMap.has(titleKey)) {
            const existingAnime = catalogMap.get(titleKey);
            existingAnime.episodios = episodiosEstructurados;
            existingAnime.temporadas = Math.max(existingAnime.temporadas || 1, numTemporada);
            stats.animesActualizados++;
          } else {
            const newAnime = {
              id: `anime-lat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              titulo: cleanTitle,
              tipo: 'anime',
              anio: 2026,
              idiomas: [idiomaDetectado],
              temporadas: numTemporada,
              portada: posterUrl,
              episodios: episodiosEstructurados
            };
            catalog.push(newAnime);
            catalogMap.set(titleKey, newAnime);
            stats.animesNuevos++;
          }
        } catch (e) {}
      }
    } catch (err) {
      console.log(`⚠️ Error en Latanime página ${page}:`, err.message);
    }
  }

  // ==========================================
  // 2. JKANIME.NET (Temporadas y Episodios)
  // ==========================================
  console.log('🌐 Escaneando catálogo de JKAnime.net...');
  for (let page = 1; page <= MAX_PAGINAS_DIRECTORIO; page++) {
    try {
      const dirUrl = `https://jkanime.net/directorio/${page}/`;
      const res = await axios.get(dirUrl, { headers: HEADERS, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const items = [];

      $('.anime__item, .custom_item, .items .item').each((_, el) => {
        const link = $(el).find('a').first();
        const url = link.attr('href');
        const title = $(el).find('h5, h2, .title').first().text().trim();
        const img = $(el).find('.anime__item__pic, div[data-setbg]').attr('data-setbg') || $(el).find('img').attr('src') || '';

        if (title && url) items.push({ url, title, poster: img });
      });

      for (const item of items) {
        const cleanTitle = item.title.trim();
        if (!cleanTitle) continue;

        const titleKey = cleanTitle.toLowerCase();
        const numTemporada = detectarTemporada(cleanTitle);
        const idiomaDetectado = detectarIdioma(cleanTitle);

        try {
          const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 12000 });
          const $$ = cheerio.load(detailRes.data);

          const listaEpisodios = [];
          $$('a[href*="' + item.url + '"]').each((_, epEl) => {
            const epUrl = $$(epEl).attr('href');
            const epText = $$(epEl).text().trim();
            const epMatch = epText.match(/(\d+)/);
            if (epUrl && epMatch) {
              listaEpisodios.push({ numero: parseInt(epMatch[1], 10), url: epUrl });
            }
          });

          if (listaEpisodios.length === 0) {
            listaEpisodios.push({ numero: 1, url: item.url });
          }

          const episodiosEstructurados = [];

          for (const ep of listaEpisodios.slice(0, 24)) {
            try {
              const epRes = await axios.get(ep.url, { headers: HEADERS, timeout: 8000 });
              const $$$ = cheerio.load(epRes.data);
              const servers = [];

              $$$('iframe').each((_, iframe) => {
                const src = $$$(iframe).attr('src') || $$$(iframe).attr('data-src');
                if (src && !src.includes('facebook')) {
                  servers.push({
                    idioma: idiomaDetectado,
                    servidor: 'Reproductor Directo',
                    url: src.startsWith('//') ? `https:${src}` : src
                  });
                }
              });

              if (servers.length === 0) {
                servers.push({ idioma: idiomaDetectado, servidor: 'Ver en JKAnime', url: ep.url });
              }

              episodiosEstructurados.push({
                numero: ep.numero,
                temporada: numTemporada,
                opciones_reproductor: servers
              });
              stats.episodiosExtraidos++;
            } catch (e) {}
          }

          if (catalogMap.has(titleKey)) {
            const existingAnime = catalogMap.get(titleKey);
            existingAnime.episodios = episodiosEstructurados;
            existingAnime.temporadas = Math.max(existingAnime.temporadas || 1, numTemporada);
            stats.animesActualizados++;
          } else {
            const newAnime = {
              id: `anime-jk-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              titulo: cleanTitle,
              tipo: 'anime',
              anio: 2026,
              idiomas: [idiomaDetectado],
              temporadas: numTemporada,
              portada: item.poster,
              episodios: episodiosEstructurados
            };
            catalog.push(newAnime);
            catalogMap.set(titleKey, newAnime);
            stats.animesNuevos++;
          }
        } catch (e) {}
      }
    } catch (err) {
      console.log(`⚠️ Error en JKAnime página ${page}:`, err.message);
    }
  }

  // ==========================================
  // REPORTE FINAL Y GUARDADO
  // ==========================================
  console.log('\n=============================================');
  console.log('📊 REPORTE DE EXTRACCIÓN MASIVA Y ESTRUCTURADA');
  console.log('=============================================');
  console.log(`✨ Animes nuevos registrados:     ${stats.animesNuevos}`);
  console.log(`🔄 Animes/Temporadas actualizadas: ${stats.animesActualizados}`);
  console.log(`🎬 Total episodios extraídos:      ${stats.episodiosExtraidos}`);
  console.log('---------------------------------------------');
  console.log(`📦 TOTAL DE ANIMES EN LATINO.JSON: ${catalog.length} items`);
  console.log('=============================================\n');

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log('💾 Archivo latino.json guardado con éxito.');
}

runExtractor();
