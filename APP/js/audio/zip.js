(function defineZip(S) {
  "use strict";

  const CRC_TABLE = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    CRC_TABLE[index] = value >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  }

  function u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function create(entries) {
    const normalized = entries.map(entry => ({
      name: String(entry.name),
      nameBytes: S.Core.utf8(entry.name),
      bytes: entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes)
    })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const entry of normalized) {
      const crc = crc32(entry.bytes);
      const localHeader = S.Core.concatBytes([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(33),
        u32(crc), u32(entry.bytes.length), u32(entry.bytes.length), u16(entry.nameBytes.length), u16(0), entry.nameBytes
      ]);
      localParts.push(localHeader, entry.bytes);
      const centralHeader = S.Core.concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(33),
        u32(crc), u32(entry.bytes.length), u32(entry.bytes.length), u16(entry.nameBytes.length), u16(0),
        u16(0), u16(0), u16(0), u32(0), u32(offset), entry.nameBytes
      ]);
      centralParts.push(centralHeader);
      offset += localHeader.length + entry.bytes.length;
    }
    const central = S.Core.concatBytes(centralParts);
    const end = S.Core.concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(normalized.length), u16(normalized.length),
      u32(central.length), u32(offset), u16(0)
    ]);
    return S.Core.concatBytes([...localParts, central, end]);
  }

  S.Audio.Zip = Object.freeze({ crc32, create });
})(window.SPECTRAL);
