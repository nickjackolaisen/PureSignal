#!/usr/bin/env node
/**
 * Generate PureSignal extension icons (16, 48, 128) as solid-brand PNGs.
 * Run from repo root: node extension/scripts/generate-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../icons");
const sizes = [16, 48, 128];
// Dark slate background + teal accent bar (brand-ish, no external deps)
const bg = [15, 23, 42, 255];
const accent = [45, 212, 191, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pngForSize(size) {
  const row = Buffer.alloc(1 + size * 4);
  const raw = [];
  for (let y = 0; y < size; y += 1) {
    const rowBuf = Buffer.alloc(1 + size * 4);
    rowBuf[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const inAccent = x >= size * 0.15 && x <= size * 0.35 && y >= size * 0.2 && y <= size * 0.8;
      const color = inAccent ? accent : bg;
      const o = 1 + x * 4;
      rowBuf[o] = color[0];
      rowBuf[o + 1] = color[1];
      rowBuf[o + 2] = color[2];
      rowBuf[o + 3] = color[3];
    }
    raw.push(rowBuf);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const compressed = zlib.deflateSync(Buffer.concat(raw));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(outDir, { recursive: true });
for (const size of sizes) {
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, pngForSize(size));
  console.log(`Wrote ${file}`);
}
