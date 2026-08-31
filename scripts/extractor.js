const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JSON_PATH = path.join(__dirname, '../latino.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,ja;q=0.7'
};

// Aumentamos a 25 páginas para cubrir los 200+ animes
const MAX_PAGINAS_DIRECTORIO = 25;

// Función de pausa para evitar bloqueos del servidor (Cloudflare / 429)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function detectarTemporada(titulo) {
  const match = titulo.match(/(?:season|temporada|st|nd|rd|th\s+season)\s*(\d+)/i) || 
                titulo.match(/\s+T(\d+)\b/i) || 
                titulo.match(/\s+(\d+)nd\s+Season/i) ||
                titulo.match(/\s+(\d+)rd\s+Season/i) ||
                titulo.match(/\s+(\d+)th\s+Season/i);
  return match ? parseInt(match[1], 10) : 1;
}

function detectarIdioma(texto) {
  const t = texto.toLowerCase();
  const idiomas = [];
  if (t.includes('latino') || t.includes('lat')) idiomas.push('Español Latino');
  if (t.includes('castellano') || t.includes('esp')) idiomas.push('Castellano');
  if (t.includes('sub') || t.includes('subtitulado') || t.includes('japanese')) idiomas.push('Subtitulado');
  
  return idiomas.length > 0 ? idiomas.join(' / ') : 'Español Latino';
}

// Normalizador para eliminar espacios extras o caracteres especiales en la clave de duplicados
function normalizarTitulo(titulo) {
  return titulo.toLowerCase().trim().replace(/[^\w\s]/gi, '');
}

async function runExtractor() {
  console.log('🚀 Iniciando EXTRACCIÓN MASIVA DE CATALOGO (Paginación ampliada)...');

  let catalog = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    } catch (e) {
      catalog = [];
    }
  }

  // Mapeador por título normalizado para evitar duplicados
  const catalogMap = new Map();
  catalog.forEach(item => {
    if (item.titulo) catalogMap.set(normalizarTitulo(item.titulo), item);
  });

  const stats = { animesNuevos: 0, animesActualizados: 0, episodiosExtraidos: 0 };

  // ==========================================
  // 1. LATANIME.ORG 
  // ==========================================
  console.log('🌐 Escaneando catálogo principal de Latanime.org...');
  for (let page = 1; page <= MAX_PAGINAS_DIRECTORIO; page++) {
    try {
      // Cambio de endpoint para obtener la lista general completa
      const dirUrl = `https://latanime.org/animes?page=${page}`;
      console.log(`📄 Procesando Latanime página [${page}/${MAX_PAGINAS_DIRECTORIO}]...`);
      
      const res = await axios.get(dirUrl, { headers: HEADERS, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const items = [];

      $('a[href*="/anime/"]').each((_, el) => {
        const url = $(el).attr('href');
        let title = $(el).find('.title, h3, .name, .text-sm').first().text().trim() || $(el).text().split('\n')[0].trim();
        let img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';

        if (title && url) {
          const fullUrl = url.startsWith('http') ? url : `https://latanime.org${url}`;
          items.push({ url: fullUrl, title, poster: img });
        }
      });

      if (items.length === 0) {
        console.log(`⚠️ Fin de directorio alcanzado en Latanime (Página ${page}).`);
        break;
      }

      for (const item of items) {
        const cleanTitle = item.title.replace(/Capítulo\s+\d+/i, '').trim();
        if (!cleanTitle) continue;

        const titleKey = normalizarTitulo(cleanTitle);
        const numTemporada = detectarTemporada(cleanTitle);
        const idiomaDetectado = detectarIdioma(cleanTitle);

        try {
          const detailRes = await axios.get(item.url, { headers: HEADERS, timeout: 12000 });
          const $$ = cheerio.load(detailRes.data);

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

          if (listaEpisodios.length === 0) {
            listaEpisodios.push({ numero: 1, url: item.url });
          }

          const episodiosEstructurados = [];

          // Escanear reproductores (Primeros 12 episodios para agilizar la carga)
          for (const ep of listaEpisodios.slice(0, 12)) {
            try {
              const epRes = await axios.get(ep.url, { headers: HEADERS, timeout: 8000 });
              const $$$ = cheerio.load(epRes.data);
              const servers = [];

              $$$('iframe').each((_, iframe) => {
                const src = $$$ (iframe).attr('src') || $$$ (iframe).attr('data-src');
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
            catalogMap.set(titleKey, newAnime);
            stats.animesNuevos++;
          }
        } catch (e) {}

        await sleep(500); // Pausa de medio segundo entre animes
      }
    } catch (err) {
      console.log(`⚠️ Error en Latanime página ${page}:`, err.message);
    }
  }

  // Reconstruir la lista limpia sin duplicados desde el mapa
  catalog = Array.from(catalogMap.values());

  // ==========================================
  // REPORTE FINAL Y GUARDADO EN ARCHO
  // ==========================================
  console.log('\n=============================================');
  console.log('📊 REPORTE DE EXTRACCIÓN Y CONSOLIDACIÓN');
  console.log('=============================================');
  console.log(`✨ Animes nuevos registrados:     ${stats.animesNuevos}`);
  console.log(`🔄 Animes/Temporadas actualizadas: ${stats.animesActualizados}`);
  console.log(`🎬 Total episodios extraídos:      ${stats.episodiosExtraidos}`);
  console.log('---------------------------------------------');
  console.log(`📦 TOTAL DE ANIMES UNICOS EN LATINO.JSON: ${catalog.length}`);
  console.log('=============================================\n');

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log('💾 Archivo latino.json actualizado exitosamente en el disco.');
}

runExtractor();
