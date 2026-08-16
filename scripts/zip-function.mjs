import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

/** Упаковывает функцию в zip средствами Node.
 *  Через `tar -a` результат зависит от того, какой tar оказался в PATH:
 *  Windows-версия делает zip, GNU-версия молча кладёт tar под именем .zip,
 *  и облако отвергает такой архив. */
const SOURCE = 'dist-server';
const OUTPUT = 'function.zip';
const FILES = ['index.js', 'handler.js', 'auth.js', 'github.js', 'package.json'];

const DOS_DATE = 33; // 1 января 1980: фиксированная дата даёт воспроизводимый архив

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const name of FILES) {
  const data = readFileSync(join(SOURCE, name));
  const compressed = deflateRawSync(data);
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  localParts.push(local, nameBytes, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // права на файл в unix-формате
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBytes);

  offset += local.length + nameBytes.length + compressed.length;
}

const directory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(FILES.length, 8);
end.writeUInt16LE(FILES.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

writeFileSync(OUTPUT, Buffer.concat([...localParts, directory, end]));
console.log(`${OUTPUT}: файлов ${FILES.length}`);
