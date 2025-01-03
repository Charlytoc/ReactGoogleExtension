import sharp from 'sharp'; // Importa Sharp
import path from 'path';
import { fileURLToPath } from 'url';

// Obtén la ruta del archivo actual y el directorio base
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta de la imagen base
const inputPath = path.resolve(__dirname, '../../public/icons/icon.png');

// Ruta de salida para los íconos generados
const outputDir = path.resolve(__dirname, '../../public/icons');

// Tamaños de los íconos
const sizes = [
    { size: 16, output: 'icon-16.png' },
    { size: 48, output: 'icon-48.png' },
    { size: 128, output: 'icon-128.png' },
];

// Función para generar los íconos
async function generateIcons() {
    try {
        for (const { size, output } of sizes) {
            const outputPath = path.resolve(outputDir, output); // Asegúrate de usar la ruta correcta

            await sharp(inputPath)
                .resize(size, size) // Redimensiona la imagen
                .toFile(outputPath); // Guarda el archivo

            console.log(`✅ Generado: ${outputPath}`);
        }
        console.log('🎉 Todos los íconos se generaron correctamente en:', outputDir);
    } catch (error) {
        console.error('❌ Error al generar los íconos:', error);
    }
}

// Ejecutar la función
generateIcons();
