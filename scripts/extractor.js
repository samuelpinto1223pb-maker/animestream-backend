const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Usamos AllOrigins como proxy CORS para eludir el bloqueo directo de Cloudflare
const PROXY = 'https://api.allorigins.win/get?url=';
const TARGET_URL = encodeURIComponent('https://animeflv.net/browse?order=added');

async function extraerCatalogoReal() {
  console.log("Iniciando extracción dinámica de animes reales...");
  const catalogo = [];

  try {
    const response = await axios.get(`${PROXY}${TARGET_URL}`);
    const html = response.data.contents;
    const $ = cheerio.load(html);

    $('.ListAnimes article.Anime').each((_, el) => {
      const title = $(el).find('.Title').text().trim();
      let poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-cfsrc');
      const link = $(el).find('a').attr('href');

      if (title && link) {
        if (poster && !poster.startsWith('http')) {
          poster = 'https://animeflv.net' + poster;
        }

        catalogo.push({
          id: link.replace('/anime/', ''),
          title: title,
          poster: poster || '',
          idioma: title.toLowerCase().includes('latino') ? 'Español Latino' : 'Subtitulado',
          servers: [
            { server: "animeflv", title: "Ver Episodio 1", code: `https://animeflv.net/ver/${link.replace('/anime/', '')}-1` }
          ]
        });
      }
    });

    console.log(`¡Éxito! Se extrajeron ${catalogo.length} animes reales de la web.`);

    if (catalogo.length > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
      console.log("Archivo latino.json actualizado con datos reales.");
    } else {
      console.log("No se pudieron parsear elementos. Revisa los selectores.");
    }

  } catch (err) {
    console.error("Error al conectar con el servidor:", err.message);
  }
}

extraerCatalogoReal();
