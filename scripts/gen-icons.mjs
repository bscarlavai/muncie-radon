/**
 * Rasterizes public/favicon.svg into the PNG sizes that browsers and iOS
 * cannot get from an SVG. Run after any change to the brand mark:
 *
 *   npm run icons
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');

const targets = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log(`wrote ${file} (${size}x${size})`);
}

/* favicon.ico, because /favicon.ico is still fetched by convention: link
   unfurlers, feed readers, and audit tools request it at the root whether or not
   the HTML declares one, and a 404 there reads as "no favicon" even when a
   perfectly good SVG is linked.

   sharp cannot write ICO, but the format has allowed PNG-encoded entries since
   Vista, so a 22-byte header in front of a 32x32 PNG is a valid single-image
   .ico that every current browser accepts. Layout: 6-byte ICONDIR, then one
   16-byte ICONDIRENTRY, then the PNG payload at offset 22. */
{
  const png = await sharp(svg, { density: 384 }).resize(32, 32).png().toBuffer();

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // palette size, 0 for truecolor
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // payload offset: 6 + 16

  writeFileSync('public/favicon.ico', Buffer.concat([header, entry, png]));
  console.log(`wrote public/favicon.ico (32x32, ${png.length + 22} bytes)`);
}

/* Open Graph card: the mark on brand navy with the wordmark beside it.
   1200x630 is the size Facebook, LinkedIn, and iMessage all crop from. */
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#12293f"/>
  <g transform="translate(104 172) scale(7.4)" stroke="#ffffff" stroke-width="2.2"
     stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M16 2.8 L27 6.8 V15.6 C27 22.6 16 29.2 16 29.2 C16 29.2 5 22.6 5 15.6 V6.8 Z"/>
    <path d="M16 20.5 V9.5"/>
    <path d="M12.3 13.2 L16 9.5 L19.7 13.2"/>
  </g>
  <text x="360" y="290" font-family="Helvetica,Arial,sans-serif" font-size="76" font-weight="700" fill="#ffffff">Muncie Radon</text>
  <text x="360" y="356" font-family="Helvetica,Arial,sans-serif" font-size="36" fill="#9ed2f5">Radon testing &amp; mitigation · Delaware County, IN</text>
  <text x="360" y="424" font-family="Helvetica,Arial,sans-serif" font-size="32" fill="rgba(255,255,255,0.66)">EPA Zone 1 · Typical system $1,200–$2,000</text>
</svg>`;

await sharp(Buffer.from(og)).png().toFile('public/og-default.png');
console.log('wrote public/og-default.png (1200x630)');
