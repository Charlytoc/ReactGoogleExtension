import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Necesario para obtener el directorio actual en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas de origen y destino
const source = path.resolve(__dirname, '../../manifest.json'); // Ajusta la ruta si es necesario
const destination = path.resolve(__dirname, '../../dist/manifest.json'); // Ajusta la ruta si es necesario

// Verifica si la carpeta dist existe
if (!fs.existsSync(path.dirname(destination))) {
  console.error('❌ La carpeta "dist" no existe. Por favor, compila tu proyecto primero.');
  process.exit(1);
}

// Copia el archivo
fs.copyFile(source, destination, (err) => {
  if (err) {
    console.error('❌ Error al copiar el archivo:', err);
  } else {
    console.log('✅ Archivo "manifest.json" copiado exitosamente a "dist/manifest.json".');
  }
});
