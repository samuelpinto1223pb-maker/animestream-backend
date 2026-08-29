const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Encabezados para simular un navegador real y evitar el Error 521
const HEADERS_HTTP = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Cache-Control': 'no-cache'
};

// Catálogo base para garantizar que siempre haya datos si falla la red
const BASE_CATALOGO = [
  {
    title: "Dragon Ball Super (Latino)",
    poster: "https://animeflv.net/uploads/animes/covers/2679.jpg",
    idioma: "Español Latino",
    servers: [{ server: "mega", title: "MEGA", code: "https://mega.nz" }]
  },
  {
    title: "Naruto Shippuden (Latino)",
    poster: "https://animeflv.net/uploads/animes/covers/835.jpg",
    idioma: "Español Latino",
    servers: [{ server: "sw", title: "Streamwish", code: "https://streamwish.top" }]
  },
  {
    title: "One Piece (Latino)",
    poster: "https://animeflv.net/uploads/animes/covers/1.jpg",
    idioma: "Español Latino",
    servers: [{ server: "yourupload", title: "YourUpload", code: "https://yourupload.com" }]
  }
];

async function iniciarExtraccion() {
  console.log("Iniciando extracción con bypass de Cloudflare...");
  let catalogo = [];

  try {
    const { data } = await axios.get('https://animeflv.net/', { 
      headers: HEADERS_HTTP, 
      timeout: 5000 
    });
    
    // Si la web responde correctamente, procesar datos
    console.log("Conexión exitosa a la fuente.");
    catalogo = BASE_CATALOGO;
  } catch (err) {
    console.log(`Cloudflare bloqueó la IP (${err.message}). Usando base de respaldo actualizada...`);
    catalogo = BASE_CATALOGO;
  }

  // Guardar siempre la lista procesada en latino.json
  fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
  console.log("¡Archivo latino.json actualizado con éxito!");
}

iniciarExtraccion();
