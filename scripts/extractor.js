const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Ruta al archivo latino.json en la raíz
const JSON_PATH = path.join(__dirname, '../latino.json');

// Servidores recomendados / permitidos
const ALLOWED_SERVERS = ['mega', 'yourupload', 'okru', 'stape', 'filemoon', 'streamwish', 'voe'];

async function runExtractor() {
  console.log('🚀 Iniciando proceso de extracción...');

  let catalog = [];

  // Si existe un catálogo previo, cargarlo
  if (fs.existsSync(JSON_PATH)) {
    try {
      const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
      catalog = JSON.parse(rawData);
    } catch (e) {
      console.log('⚠️ No se pudo leer el latino.json previo, se creará uno nuevo.');
      catalog = [];
    }
  }

  /* 
    AQUÍ VA TU LÓGICA DE SCRAPING DE ANIME.
    Asegúrate de formatear cada opción de reproductor de la siguiente manera:
  */

  function cleanEmbedUrl(rawUrl, serverName) {
    if (!rawUrl) return null;
    let url = rawUrl.trim();

    // Asegurar protocolo https
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    return url;
  }

  // Ejemplo de estructura para guardar cada anime extraído
  function addOrUpdateAnime(newAnime) {
    const existingIndex = catalog.findIndex(a => a.title.toLowerCase() === newAnime.title.toLowerCase());
    
    // Filtrar servidores limpios
    if (newAnime.capitulos) {
      newAnime.capitulos.forEach(ep => {
        if (ep.opciones_reproductor) {
          ep.opciones_reproductor = ep.opciones_reproductor.map(op => ({
            ...op,
            url: cleanEmbedUrl(op.url, op.servidor)
          })).filter(op => op.url !== null);
        }
      });
    }

    if (existingIndex !== -1) {
      catalog[existingIndex] = newAnime;
    } else {
      catalog.push(newAnime);
    }
  }

  // Guardar catálogo actualizado
  try {
    fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`✅ Extracción completada. ${catalog.length} animes guardados en latino.json`);
  } catch (err) {
    console.error('❌ Error al escribir latino.json:', err);
  }
}

runExtractor();
