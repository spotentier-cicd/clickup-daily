/*
| LES ICÔNES DE L'APPLICATION INSTALLÉE.
|
| Une application installée est d'abord une icône dans un dock : elle doit
| exister en PNG, parce que c'est le seul format que tous les systèmes
| acceptent — iOS ne sait pas poser un SVG sur un écran d'accueil.
|
| Le dessin n'est pas recopié ici : ce sont EXACTEMENT les quatre formes de
| public/favicon.svg, écrites une fois en bas de ce fichier. Changer la marque
| se fait donc dans le SVG, puis d'un `node scripts/make-icons.mjs` — pas en
| retouchant quatre PNG à la main, ce qui finirait par les désaccorder.
|
| Aucune dépendance : trois rectangles arrondis se rastérisent en vingt
| lignes, et un PNG non entrelacé s'écrit avec le zlib de Node. Installer un
| rastériseur SVG complet pour ça coûterait plus cher que le dessiner.
|
|   node scripts/make-icons.mjs
*/

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/* La marque, dans le même repère 32 × 32 que le SVG. */
const ACCENT = [0x4a, 0x54, 0xb8]
const INK = [0xf5, 0xf5, 0xfd]

const BARS = [
  { x: 7, y: 14, w: 4, h: 11, r: 2, alpha: 0.62 },
  { x: 14, y: 7, w: 4, h: 18, r: 2, alpha: 1 },
  { x: 21, y: 18, w: 4, h: 7, r: 2, alpha: 0.62 },
]

/*
| Les quatre tirages.
|
| `radius` est celui du fond, en unités du repère : 7 pour l'icône qui se
| pose telle quelle, 0 — donc un carré à bords vifs — pour celles que le
| système découpe lui-même, et qui doivent donc remplir tout le cadre.
|
| `scale` rétrécit les barres autour du centre. Une icône « maskable » peut
| être rognée jusqu'à un cercle de 80 % du côté : à l'échelle 1, les barres
| affleurent ce cercle. 0,82 les en écarte franchement.
*/
const ICONS = [
  { file: 'icon-192.png', size: 192, radius: 7, scale: 1 },
  { file: 'icon-512.png', size: 512, radius: 7, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, radius: 0, scale: 0.82 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 1 },
]

/** Le point est-il dans le rectangle arrondi ? (somme de Minkowski rect ⊕ disque) */
function inRoundRect(px, py, x, y, w, h, r) {
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

/**
 * Rastérise une icône en RGBA, 4 × 4 sous-échantillons par pixel.
 *
 * Les bords sont donc lissés sans qu'on ait à calculer de couverture exacte :
 * seize points suffisent à rendre un arrondi propre à partir de 180 px.
 */
function render({ size, radius, scale }) {
  const SUB = 4
  const unit = 32 / size
  const pixels = Buffer.alloc(size * size * 4)

  /* Les barres, une fois mises à l'échelle autour du centre du repère. */
  const bars = BARS.map((bar) => ({
    ...bar,
    x: 16 + (bar.x - 16) * scale,
    y: 16 + (bar.y - 16) * scale,
    w: bar.w * scale,
    h: bar.h * scale,
    r: bar.r * scale,
  }))

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sumA = 0
      let sumR = 0
      let sumG = 0
      let sumB = 0

      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const ux = (px + (sx + 0.5) / SUB) * unit
          const uy = (py + (sy + 0.5) / SUB) * unit

          let [r, g, b] = [0, 0, 0]
          let a = 0

          if (inRoundRect(ux, uy, 0, 0, 32, 32, radius)) {
            ;[r, g, b] = ACCENT
            a = 1
          }

          for (const bar of bars) {
            if (!inRoundRect(ux, uy, bar.x, bar.y, bar.w, bar.h, bar.r)) continue
            const k = bar.alpha
            r = INK[0] * k + r * (1 - k)
            g = INK[1] * k + g * (1 - k)
            b = INK[2] * k + b * (1 - k)
            a = k + a * (1 - k)
          }

          /* Moyenne en alpha prémultiplié : sinon les coins bavent en noir. */
          sumA += a
          sumR += r * a
          sumG += g * a
          sumB += b * a
        }
      }

      const n = SUB * SUB
      const offset = (py * size + px) * 4
      pixels[offset] = sumA ? Math.round(sumR / sumA) : 0
      pixels[offset + 1] = sumA ? Math.round(sumG / sumA) : 0
      pixels[offset + 2] = sumA ? Math.round(sumB / sumA) : 0
      pixels[offset + 3] = Math.round((sumA / n) * 255)
    }
  }

  return pixels
}

/* ——— Écriture du PNG ———————————————————————————————————————————————————— */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Un PNG RGBA 8 bits, non entrelacé, toutes lignes en filtre 0. */
function png(pixels, size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 /* 8 bits par canal */
  header[9] = 6 /* RVBA */

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

for (const icon of ICONS) {
  const file = join(publicDir, icon.file)
  const bytes = png(render(icon), icon.size)
  writeFileSync(file, bytes)
  console.log(`${icon.file.padEnd(24)} ${icon.size}×${icon.size}  ${bytes.length} o`)
}
