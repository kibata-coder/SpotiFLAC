import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const publicDir = join(rootDir, 'frontend', 'public');
const svgPath = join(publicDir, 'icon.svg');
const buildDir = join(rootDir, 'build');
const outputPath = join(buildDir, 'appicon.png');

async function generateIcon() {
    try {
        mkdirSync(buildDir, { recursive: true });
        const svgBuffer = readFileSync(svgPath);
        
        await sharp(svgBuffer).resize(1024, 1024).png().toFile(outputPath);
        console.log('App icon generated:', outputPath);

        await sharp(svgBuffer).resize(192, 192).png().toFile(join(publicDir, 'pwa-192x192.png'));
        console.log('PWA icon generated: 192x192');

        await sharp(svgBuffer).resize(512, 512).png().toFile(join(publicDir, 'pwa-512x512.png'));
        console.log('PWA icon generated: 512x512');
    }
    catch (error) {
        console.error('Failed to generate icon:', error.message);
        process.exit(1);
    }
}
generateIcon();
