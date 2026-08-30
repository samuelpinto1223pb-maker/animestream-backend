const fs = require('fs');
const path = require('path');
const axios = require('axios');

const JSON_PATH = path.join(__dirname, '../latino.json');

async function runExtractor() {
  console.log('🚀 Iniciando extracción desde fuente estable...');
  
  try {
    // Lista de animes populares para construir el catálogo sin bloqueos
    const searchTerms = ['Spy x Family', 'Mushoku Tensei', 'Chainsaw Man', 'Demon Slayer', 'Jujutsu Kaisen', 'One Piece'];
    const catalog = [];

    for (const term of searchTerms) {
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(term)}&limit=1`);
        if (res.data.data && res.data.data.length > 0) {
          const item = res.data.data[0];
          
          catalog.push({
            title: item.title_japanese || item.title,
            poster: item.images.jpg.large_image_url,
            year: item.year ? item.year.toString() : '2026',
            capitulos: [
              {
                numero: 1,
                opciones_reproductor: [
                  { idioma: 'Español Latino', servidor: 'Streamwish', url: 'https://streamwish.to/e/example1' },
                  { idioma: 'Español Latino', servidor: 'Voe', url: 'https://voe.sx/e/example1' }
                ]
              },
              {
                numero: 2,
                opciones_reproductor: [
                  { idioma: 'Español Latino', servidor: 'Streamwish', url: 'https://streamwish.to/e/example2' },
                  { idioma: 'Español Latino', servidor: 'Voe', url: 'https://voe.sx/e/example2' }
                ]
              }
            ]
          });
        }
        // Pausa breve para no saturar la API
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.log(`⚠️ Error con ${term}: ${err.message}`);
      }
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`✅ Extracción completada. ${catalog.length} animes guardados en latino.json`);

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

runExtractor();
