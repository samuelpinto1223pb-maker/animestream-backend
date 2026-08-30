const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JSON_PATH = path.join(__dirname, '../latino.json');
const BASE_URL = 'https://animeflv.net'; // Ajusta la URL origen según tu fuente de scraping

async function getAnimes() {
  console.log('🚀 Iniciando proceso de extracción...');
  const catalog = [];

  try {
    // Ejemplo de petición al catálogo
    const response = await axios.get(`${BASE_URL}/browse?order=added`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    const animeLinks = [];

    $('.ListAnimes li article a').each((i, el) => {
      if (i < 10) { // Extrae los primeros 10 animes por ejecución
        animeLinks.push($(el).attr('href'));
      }
    });

    for (const link of animeLinks) {
      try {
        const animeRes = await axios.get(`${BASE_URL}${link}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $anime = cheerio.load(animeRes.data);

        const title = $anime('.Ficha h1').text().trim() || 'Anime sin título';
        const poster = BASE_URL + ($anime('.Image img').attr('src') || '');
        const year = $anime('.NIGHT').text().trim() || '2026';

        // Extraer episodios del script de la página
        const scripts = $anime('script').toArray();
        let episodesData = [];
        let animeInfo = [];

        scripts.forEach(script => {
          const content = $anime(script).html();
          if (content && content.includes('var episodes =')) {
            const epMatch = content.match(/var episodes = (\[\[.*?\]\]);/);
            if (epMatch) episodesData = JSON.parse(epMatch[1]);
          }
        });

        const capitulos = episodesData.map(ep => {
          const epNum = ep[0];
          return {
            numero: epNum,
            opciones_reproductor: [
              {
                idioma: 'Español Latino',
                servidor: 'Voe',
                url: `https://voe.sx/e/${ep[1]}`
              },
              {
                idioma: 'Español Latino',
                servidor: 'Streamwish',
                url: `https://streamwish.to/e/${ep[1]}`
              }
            ]
          };
        });

        if (title) {
          catalog.push({
            title,
            poster,
            year,
            capitulos
          });
        }
      } catch (e) {
        console.error(`Error procesando anime ${link}:`, e.message);
      }
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`✅ Extracción completada. ${catalog.length} animes guardados en latino.json`);

  } catch (error) {
    console.error('❌ Error en el proceso de extracción:', error.message);
  }
}

getAnimes();
