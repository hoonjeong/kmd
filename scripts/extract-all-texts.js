/**
 * extract-all-texts.js
 * DB에서 prev_test_meta_info + prev_test_file_info를 조회하여
 * HWP/HWPX/PDF 텍스트를 추출, data/extracted/ 에 저장
 *
 * 실행: node scripts/extract-all-texts.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const CFB = require('cfb');
const zlib = require('zlib');
const JSZip = require('jszip');

// ── 환경변수 로드 ──
const envPath = path.resolve(__dirname, '../apps/root/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim();
    if (key) env[key] = val;
  }
});

const OUTPUT_DIR = path.resolve(__dirname, '../data/extracted');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── HWP 텍스트 추출 (인라인) ──
const HWPTAG_PARA_TEXT = 67;

function extractTextFromHwp(buffer) {
  const cfb = CFB.read(buffer, { type: 'buffer' });

  let compressed = true;
  const headerEntry = findCFBEntry(cfb, 'FileHeader');
  if (headerEntry && headerEntry.content) {
    const headerBuf = Buffer.from(headerEntry.content);
    if (headerBuf.length >= 40) {
      const properties = headerBuf.readUInt32LE(36);
      compressed = (properties & 0x01) !== 0;
    }
  }

  const texts = [];
  const sectionEntries = findSectionEntries(cfb);
  if (sectionEntries.length === 0) {
    throw new Error('HWP 파일에서 본문 섹션을 찾을 수 없습니다.');
  }

  for (const entry of sectionEntries) {
    if (!entry.content || entry.size === 0) continue;
    let data = Buffer.from(entry.content);
    if (compressed) {
      data = decompressSection(data);
    }
    const sectionTexts = parseRecords(data);
    texts.push(...sectionTexts);
  }

  return texts.join('\n');
}

function findCFBEntry(cfb, name) {
  const upperName = name.toUpperCase();
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const fullPath = cfb.FullPaths[i].toUpperCase().replace(/\/$/, '');
    const parts = fullPath.split('/');
    const entryName = parts[parts.length - 1];
    if (entryName === upperName) return cfb.FileIndex[i];
  }
  return null;
}

function findSectionEntries(cfb) {
  const entries = [];
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const p = cfb.FullPaths[i].toUpperCase();
    const match = p.match(/BODYTEXT\/SECTION(\d+)/);
    if (match) entries.push({ index: parseInt(match[1], 10), entry: cfb.FileIndex[i] });
  }
  entries.sort((a, b) => a.index - b.index);
  return entries.map(e => e.entry);
}

function decompressSection(raw) {
  try { return zlib.inflateRawSync(raw); } catch {
    try { return zlib.inflateSync(raw); } catch { return raw; }
  }
}

function parseRecords(data) {
  const texts = [];
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
      if (text.trim()) texts.push(text);
    }
    offset += size;
  }
  return texts;
}

function isExtendedControl(code) {
  return [1,2,3,11,12,13,14,15,16,17,18,21,22,23,24].includes(code);
}

function parseParaText(data, offset, size) {
  const chars = [];
  const end = offset + size;
  let pos = offset;
  while (pos + 1 < end) {
    const code = data.readUInt16LE(pos);
    pos += 2;
    if (code === 0) break;
    if (isExtendedControl(code)) { pos += 12; if (pos > end) break; continue; }
    switch (code) {
      case 4: case 0x0a: case 0x0d: chars.push('\n'); break;
      case 9: case 10: chars.push('\t'); break;
      case 30: case 31: chars.push(' '); break;
      default: if (code >= 32) chars.push(String.fromCharCode(code)); break;
    }
  }
  return chars.join('');
}

// ── HWPX 텍스트 추출 (인라인) ──
async function extractTextFromHwpx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const texts = [];
  for (let i = 0; ; i++) {
    const sectionFile = zip.file('Contents/section' + i + '.xml');
    if (!sectionFile) break;
    const xml = await sectionFile.async('string');
    const matches = xml.match(/<hp:t[^>]*>([^<]*)<\/hp:t>/g);
    if (matches) {
      for (const match of matches) {
        const text = match.replace(/<hp:t[^>]*>/, '').replace(/<\/hp:t>/, '');
        if (text.trim()) texts.push(text);
      }
    }
  }
  return texts.join('\n');
}

// ── PDF 텍스트 추출 ──
async function extractTextFromPdf(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// ── 통합 텍스트 추출 ──
async function extractText(buffer, fileName) {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'hwp': return extractTextFromHwp(buffer);
    case 'hwpx': return await extractTextFromHwpx(buffer);
    case 'pdf': return await extractTextFromPdf(buffer);
    default: throw new Error('지원하지 않는 파일 형식: .' + ext);
  }
}

// ── 메인 ──
async function main() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    database: env.DB_NAME || 'edenschool',
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
  });

  console.log('Querying all prev_test files...');
  const [rows] = await pool.query(
    `SELECT m.id as metaId, m.region, m.school_type as schoolType, m.school_name as schoolName,
            m.year, m.grade, m.term, m.test_type as testType, m.section, m.publisher, m.file_type as fileType,
            f.id as fileId, f.file_name as fileName, f.content
     FROM prev_test_meta_info m
     JOIN prev_test_file_info f ON f.info_id = m.id
     ORDER BY m.id ASC`
  );

  console.log('Total files to process:', rows.length);

  const manifest = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const outputFile = 'meta_' + row.metaId + '_file_' + row.fileId + '.txt';
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    const meta = {
      metaId: row.metaId,
      fileId: row.fileId,
      fileName: row.fileName,
      region: row.region,
      schoolName: row.schoolName,
      year: row.year,
      grade: row.grade,
      term: row.term,
      testType: row.testType,
      section: row.section,
      publisher: row.publisher,
      fileType: row.fileType,
      outputFile: outputFile,
    };

    if (!row.content || row.content.length === 0) {
      meta.status = 'skip';
      meta.reason = 'no content';
      manifest.push(meta);
      skipCount++;
      console.log('[' + (i+1) + '/' + rows.length + '] SKIP (no content): meta=' + row.metaId + ' file=' + row.fileId);
      continue;
    }

    try {
      const buffer = Buffer.from(row.content);
      const text = await extractText(buffer, row.fileName || 'file.hwp');

      if (text.trim().length < 50) {
        meta.status = 'skip';
        meta.reason = 'too short (image-based?)';
        meta.textLength = text.trim().length;
        manifest.push(meta);
        skipCount++;
        console.log('[' + (i+1) + '/' + rows.length + '] SKIP (short text ' + text.trim().length + ' chars): meta=' + row.metaId + ' file=' + row.fileId);
        continue;
      }

      fs.writeFileSync(outputPath, text, 'utf8');
      meta.status = 'success';
      meta.textLength = text.length;
      manifest.push(meta);
      successCount++;
      console.log('[' + (i+1) + '/' + rows.length + '] OK (' + text.length + ' chars): meta=' + row.metaId + ' file=' + row.fileId + ' ' + (row.fileName || ''));
    } catch (err) {
      meta.status = 'error';
      meta.reason = err.message;
      manifest.push(meta);
      errorCount++;
      console.log('[' + (i+1) + '/' + rows.length + '] ERROR: meta=' + row.metaId + ' file=' + row.fileId + ' - ' + err.message);
    }
  }

  // manifest 저장
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n=== Summary ===');
  console.log('Total:', rows.length);
  console.log('Success:', successCount);
  console.log('Skipped:', skipCount);
  console.log('Errors:', errorCount);
  console.log('Manifest:', manifestPath);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
