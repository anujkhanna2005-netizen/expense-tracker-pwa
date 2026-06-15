import { Jimp } from 'jimp';
import path from 'path';
import fs from 'fs';

const sourceImage = process.argv[2];
const outputDir = path.resolve('public');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  try {
    console.log('Loading image:', sourceImage);
    const image = await Jimp.read(sourceImage);

    // icon-512.png
    console.log('Generating icon-512.png...');
    const icon512 = image.clone().resize({ w: 512, h: 512 });
    await icon512.write(path.join(outputDir, 'icon-512.png'));

    // icon-192.png
    console.log('Generating icon-192.png...');
    const icon192 = image.clone().resize({ w: 192, h: 192 });
    await icon192.write(path.join(outputDir, 'icon-192.png'));

    // apple-touch-icon.png (180x180)
    console.log('Generating apple-touch-icon.png...');
    const appleIcon = image.clone().resize({ w: 180, h: 180 });
    await appleIcon.write(path.join(outputDir, 'apple-touch-icon.png'));

    // maskable-icon-512.png
    console.log('Generating maskable-icon-512.png...');
    const maskableBg = new Jimp({ width: 512, height: 512, color: '#0B1220' });
    const scaledLogo = image.clone().resize({ w: 400, h: 400 });
    maskableBg.composite(scaledLogo, 56, 56);
    await maskableBg.write(path.join(outputDir, 'maskable-icon-512.png'));

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
