import * as CFB from 'cfb';
import { inflateRawSync, inflateSync } from 'zlib';

const HWPTAG_PARA_TEXT = 67;

/**
 * HWP v5 바이너리 파일에서 텍스트를 추출합니다.
 * OLE2/CFB 컨테이너 → BodyText/Section* → zlib 해제 → 레코드 파싱
 */
export function extractTextFromHwp(buffer: Buffer): string {
  const cfb = CFB.read(buffer, { type: 'buffer' });

  // FileHeader에서 압축 여부 확인
  let compressed = true;
  const headerEntry = findEntry(cfb, 'FileHeader');
  if (headerEntry?.content) {
    const headerBuf = Buffer.from(headerEntry.content);
    if (headerBuf.length >= 40) {
      const properties = headerBuf.readUInt32LE(36);
      compressed = (properties & 0x01) !== 0;
    }
  }

  const texts: string[] = [];

  // BodyText/Section0, Section1, ... 순회
  const sectionEntries = findSectionEntries(cfb);

  if (sectionEntries.length === 0) {
    throw new Error('HWP 파일에서 본문 섹션을 찾을 수 없습니다.');
  }

  for (const entry of sectionEntries) {
    if (!entry.content || entry.size === 0) continue;

    let data: Buffer;
    const raw = Buffer.from(entry.content);

    if (compressed) {
      data = decompressSection(raw);
    } else {
      data = raw;
    }

    const sectionTexts = parseRecords(data);
    texts.push(...sectionTexts);
  }

  return texts.join('\n');
}

/**
 * CFB 컨테이너에서 엔트리를 이름으로 찾습니다.
 */
function findEntry(cfb: CFB.CFB$Container, name: string): CFB.CFB$Entry | null {
  // FullPaths에서 직접 검색 (가장 확실한 방법)
  const upperName = name.toUpperCase();
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const fullPath = cfb.FullPaths[i].toUpperCase().replace(/\/$/, '');
    const parts = fullPath.split('/');
    const entryName = parts[parts.length - 1];
    if (entryName === upperName) {
      return cfb.FileIndex[i];
    }
  }
  return null;
}

/**
 * BodyText/Section* 엔트리를 순서대로 찾습니다.
 */
function findSectionEntries(cfb: CFB.CFB$Container): CFB.CFB$Entry[] {
  const entries: { index: number; entry: CFB.CFB$Entry }[] = [];

  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const path = cfb.FullPaths[i].toUpperCase();
    const match = path.match(/BODYTEXT\/SECTION(\d+)/);
    if (match) {
      entries.push({ index: parseInt(match[1], 10), entry: cfb.FileIndex[i] });
    }
  }

  entries.sort((a, b) => a.index - b.index);
  return entries.map((e) => e.entry);
}

/**
 * HWP 섹션 데이터의 압축을 해제합니다.
 * HWP는 raw deflate (zlib/gzip 헤더 없음) 사용
 */
function decompressSection(raw: Buffer): Buffer {
  try {
    return inflateRawSync(raw);
  } catch {
    try {
      return inflateSync(raw);
    } catch {
      return raw;
    }
  }
}

function parseRecords(data: Buffer): string[] {
  const texts: string[] = [];
  let offset = 0;

  while (offset + 4 <= data.length) {
    const header = data.readUInt32LE(offset);
    offset += 4;

    const tagId = header & 0x3ff;
    let size = (header >> 20) & 0xfff;

    if (size === 0xfff) {
      if (offset + 4 > data.length) break;
      size = data.readUInt32LE(offset);
      offset += 4;
    }

    if (offset + size > data.length) break;

    if (tagId === HWPTAG_PARA_TEXT) {
      const text = parseParaText(data, offset, size);
      if (text.trim()) {
        texts.push(text);
      }
    }

    offset += size;
  }

  return texts;
}

/**
 * HWPTAG_PARA_TEXT 레코드에서 UTF-16LE 텍스트를 파싱합니다.
 * 확장 컨트롤 문자는 12바이트의 추가 데이터를 건너뜁니다.
 */
function parseParaText(data: Buffer, offset: number, size: number): string {
  const chars: string[] = [];
  const end = offset + size;
  let pos = offset;

  while (pos + 1 < end) {
    const code = data.readUInt16LE(pos);
    pos += 2;

    if (code === 0) break;

    // 확장 컨트롤 문자: 추가 12바이트 건너뜀
    if (isExtendedControl(code)) {
      pos += 12;
      if (pos > end) break;
      continue;
    }

    switch (code) {
      case 4:    // 강제 줄나눔
      case 0x0a: // LF
      case 0x0d: // CR
        chars.push('\n');
        break;
      case 9:  // 탭
      case 10: // HWP 탭
        chars.push('\t');
        break;
      case 30: // 묶음 빈칸
      case 31: // 고정폭 빈칸
        chars.push(' ');
        break;
      default:
        if (code >= 32) {
          chars.push(String.fromCharCode(code));
        }
        break;
    }
  }

  return chars.join('');
}

function isExtendedControl(code: number): boolean {
  return (
    code === 1 || code === 2 || code === 3 ||
    code === 11 || code === 12 || code === 13 ||
    code === 14 || code === 15 || code === 16 ||
    code === 17 || code === 18 ||
    code === 21 || code === 22 || code === 23 || code === 24
  );
}
