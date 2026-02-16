/**
 * analyze-texts.js
 * 추출된 텍스트 파일들을 분석하여 지문/문제 구조화된 JSON 생성
 * data/extracted/*.txt -> data/analyzed/*.json
 */

const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = path.resolve(__dirname, '../data/extracted');
const ANALYZED_DIR = path.resolve(__dirname, '../data/analyzed');
fs.mkdirSync(ANALYZED_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(EXTRACTED_DIR, 'manifest.json'), 'utf8'));
const successFiles = manifest.filter(f => f.status === 'success');

// ── 원 숫자 → 숫자 변환 ──
const CIRCLE_NUMS = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10 };

// 답안 마커 패턴: [xxx] 뒤에 원숫자 또는 숫자
// [미래엔 국어]계남고24년1학기기말 ③
// [이든] ②
// [이든]②
const ANSWER_LINE_RE = /\[[^\]]+\][^\n]*([①②③④⑤⑥⑦⑧⑨⑩])\s*$/;
const ANSWER_LINE_RE2 = /\[[^\]]+\][^\n]*\s(\d)\s*$/;

function isAnswerLine(line) {
  const t = line.trim();
  return ANSWER_LINE_RE.test(t) || ANSWER_LINE_RE2.test(t);
}

function extractAnswerFromLine(line) {
  const t = line.trim();
  let m = t.match(ANSWER_LINE_RE);
  if (m) return String(CIRCLE_NUMS[m[1]] || m[1]);
  m = t.match(ANSWER_LINE_RE2);
  if (m) return m[1];
  return null;
}

// ── 선지 패턴 ──
const CHOICE_RE = /^([①②③④⑤])\s*(.*)/;

function isChoiceLine(line) {
  return CHOICE_RE.test(line.trim());
}

// ── 카테고리 판별 ──
function classifyFromFileName(fileName) {
  if (!fileName) return { category: '기타', subCategory: '' };
  const match = fileName.match(/\[([^\]]*)\]/);
  const tag = match ? match[1] : fileName;

  if (/문학/.test(tag)) return { category: '문학', subCategory: '' };
  if (/독서/.test(tag)) return { category: '독서', subCategory: '' };
  if (/화작|화법과\s*작문/.test(tag)) return { category: '화작', subCategory: '' };
  if (/언매|언어와\s*매체/.test(tag)) return { category: '기타', subCategory: '언어와매체' };
  if (/문법/.test(tag)) return { category: '문법', subCategory: '' };
  if (/국어/.test(tag)) return { category: '기타', subCategory: '국어(통합)' };
  return { category: '기타', subCategory: '' };
}

// ── 지문 카테고리 세분류 ──
function classifyPassageContent(text) {
  // 작가/제목 추출
  const authorMatch = text.match(/[-–—]\s*([가-힣]{2,5})\s*[,，]\s*[「『《<'"]([^」』》>'"]+)[」』》>'"]/);
  const authorMatch2 = text.match(/[-–—]\s*([가-힣]{2,5})\s*[,，]\s*「([^」]+)」/);

  let author = null;
  let title = null;

  if (authorMatch) {
    author = authorMatch[1];
    title = authorMatch[2];
  } else if (authorMatch2) {
    author = authorMatch2[1];
    title = authorMatch2[2];
  }

  // 고전 작가 목록
  const classicAuthors = ['정철', '윤선도', '정극인', '박인로', '허균', '김만중', '맹사성',
    '이황', '이이', '정약용', '박지원', '허난설헌', '황진이', '성삼문', '이색', '이제현',
    '신흠', '이현보', '이정보', '홍랑', '정몽주', '이방원', '조식', '신사임당',
    '송순', '이서', '김천택', '이중환', '허균'];

  if (author || title) {
    if (classicAuthors.includes(author)) {
      return { category: '문학', subCategory: '고전시가', title, author };
    }
    // 시 vs 소설 판별
    const lines = text.split('\n').filter(l => l.trim());
    const avgLen = lines.length > 0 ? lines.reduce((s, l) => s + l.length, 0) / lines.length : 0;
    if (avgLen < 40 && lines.length < 80) {
      return { category: '문학', subCategory: '현대시', title, author };
    }
    if (/희곡|시나리오|무대|막이\s*오르|#/.test(text)) {
      return { category: '문학', subCategory: '희곡', title, author };
    }
    if (/수필|에세이/.test(text)) {
      return { category: '문학', subCategory: '수필', title, author };
    }
    if (text.length > 300) {
      return { category: '문학', subCategory: '현대소설', title, author };
    }
    return { category: '문학', subCategory: '', title, author };
  }

  // 고전 텍스트 패턴
  if (/님|하노라|하노이다|이시니|하시니|하였더니|하니라|도다|로다/.test(text) && text.length < 500) {
    return { category: '문학', subCategory: '고전시가', title: null, author: null };
  }

  // 비문학 주제 판별
  if (/경제|시장|수요|공급|화폐|금리|무역|자본/.test(text)) return { category: '독서', subCategory: '사회', title: null, author: null };
  if (/과학|물리|화학|생물|유전|세포|분자|에너지/.test(text)) return { category: '독서', subCategory: '과학', title: null, author: null };
  if (/기술|컴퓨터|알고리즘|인공지능|로봇|소프트웨어/.test(text)) return { category: '독서', subCategory: '기술', title: null, author: null };
  if (/철학|윤리|사상|존재론|인식론/.test(text)) return { category: '독서', subCategory: '인문', title: null, author: null };
  if (/예술|미학|음악|미술|건축|무용/.test(text)) return { category: '독서', subCategory: '예술', title: null, author: null };
  if (/법률|헌법|민법|소송|판결/.test(text)) return { category: '독서', subCategory: '사회', title: null, author: null };
  if (/역사|조선|고려|삼국|일제/.test(text)) return { category: '독서', subCategory: '인문', title: null, author: null };

  return { category: '', subCategory: '', title: null, author: null };
}

// ── 문법 세분류 ──
function classifyGrammar(text) {
  if (/음운|발음|음절|자음|모음|변동|된소리|거센소리|구개음화|비음화|유음화|축약|탈락|첨가/.test(text))
    return '음운';
  if (/형태소|어근|접사|접두|접미|파생|합성/.test(text))
    return '형태소';
  if (/품사|명사|동사|형용사|부사|관형사|감탄사/.test(text))
    return '단어';
  if (/문장.*성분|주어|서술어|목적어|보어|부사어|관형어|독립어|안은문장|이어진/.test(text))
    return '문장구조';
  if (/높임|경어|존대|하십시오|해요/.test(text))
    return '높임표현';
  if (/맞춤법|띄어쓰기|사이시옷|표준어|외래어/.test(text))
    return '맞춤법';
  if (/국어사|중세|옛말|훈민정음|고어|이두|향찰/.test(text))
    return '국어사';
  if (/담화|텍스트|매체|의미관계|사전/.test(text))
    return '담화';
  return '';
}

// ── 문제 유형 패턴 판별 ──
function classifyQuestionPattern(qt) {
  if (/일치하는|일치하지\s*않는|내용으로\s*(적절|옳)/.test(qt)) return '내용이해';
  if (/표현.*특징|표현.*적절|수사법|표현법/.test(qt)) return '표현감상';
  if (/추론|추리|짐작|유추/.test(qt)) return '추론';
  if (/공통점|차이점|비교/.test(qt)) return '비교분석';
  if (/밑줄|㉠|㉡|의미.*가장\s*가까운|사전적/.test(qt)) return '어휘';
  if (/<보기>를\s*(참고|바탕|활용)/.test(qt)) return '적용';
  if (/서술.*방식|전개.*방식|설명.*방식/.test(qt)) return '서술방식';
  if (/빈칸|빈 칸|괄호/.test(qt)) return '빈칸추론';
  if (/음운|발음|형태소|단어.*설명|문장|높임|맞춤법|띄어쓰기|국어사|훈민정음/.test(qt)) return '문법규칙';
  if (/자료|도표|그래프/.test(qt)) return '자료해석';
  if (/감상으로|이해로/.test(qt)) return '감상이해';
  if (/적절하지\s*않은|적절한/.test(qt)) return '내용이해';
  return '';
}

// ── 키워드 추출 ──
function extractKeywords(text, info) {
  const keywords = [];
  if (info.title) keywords.push(info.title);
  if (info.author) keywords.push(info.author);
  const titleMatches = text.match(/[「『《]([^」』》]+)[」』》]/g);
  if (titleMatches) {
    titleMatches.forEach(m => {
      const t = m.replace(/[「『《」』》]/g, '');
      if (t && !keywords.includes(t) && t.length < 30) keywords.push(t);
    });
  }
  return keywords.join(',');
}

// ══════════════════════════════════════════
// 메인 분석 함수
// ══════════════════════════════════════════
function analyzeText(text, meta) {
  const lines = text.split('\n');
  const fileCategory = classifyFromFileName(meta.fileName);

  // Step 1: 모든 답안 마커 위치 찾기 (줄 인덱스)
  const answerPositions = [];
  for (let i = 0; i < lines.length; i++) {
    if (isAnswerLine(lines[i])) {
      answerPositions.push(i);
    }
  }

  // Step 2: 답안 마커 사이를 문제 블록으로 분리
  const questionBlocks = [];
  let blockStart = 0;

  for (let ai = 0; ai < answerPositions.length; ai++) {
    const answerIdx = answerPositions[ai];
    const answer = extractAnswerFromLine(lines[answerIdx]);

    // 이 블록은 blockStart ~ answerIdx
    const blockLines = lines.slice(blockStart, answerIdx); // 답안 마커 줄 제외
    questionBlocks.push({ lines: blockLines, answer });
    blockStart = answerIdx + 1;
  }

  // 마지막 답안 마커 이후 남은 텍스트 처리
  if (blockStart < lines.length) {
    const remaining = lines.slice(blockStart);
    const hasChoices = remaining.some(l => isChoiceLine(l));
    if (hasChoices) {
      questionBlocks.push({ lines: remaining, answer: null });
    }
  }

  // Step 3: 각 블록에서 지문/질문/선지 파싱
  const passages = [];
  const standaloneQuestions = [];
  let currentPassage = null;
  let lastPassageKey = '';

  for (let qi = 0; qi < questionBlocks.length; qi++) {
    const block = questionBlocks[qi];
    const parsed = parseBlock(block.lines, block.answer);
    if (!parsed || (!parsed.questionText && parsed.choices.length === 0)) continue;

    // 지문 처리
    if (parsed.passageText && parsed.passageText.length > 30) {
      const passageKey = parsed.passageText.substring(0, 100);
      if (passageKey !== lastPassageKey) {
        // 새 지문
        const info = classifyPassageContent(parsed.passageText);
        currentPassage = {
          content: parsed.passageText.trim(),
          category: info.category || fileCategory.category,
          subCategory: info.subCategory || fileCategory.subCategory,
          title: info.title || null,
          author: info.author || null,
          keywords: extractKeywords(parsed.passageText, info),
          questions: []
        };
        passages.push(currentPassage);
        lastPassageKey = passageKey;
      }
    }

    // 문제 카테고리 결정
    let qCat = fileCategory.category;
    let qSub = fileCategory.subCategory;
    const allText = (parsed.questionText || '') + ' ' + parsed.choices.map(c => c.choiceText).join(' ');
    const grammarSub = classifyGrammar(allText);
    if (grammarSub) {
      qCat = '문법';
      qSub = grammarSub;
    } else if (currentPassage) {
      qCat = currentPassage.category;
      qSub = currentPassage.subCategory;
    }

    const question = {
      questionNumber: qi + 1,
      questionText: parsed.questionText || '',
      questionType: parsed.choices.length > 0 ? '객관식' : '서술형',
      referenceText: parsed.referenceText || null,
      answer: block.answer || null,
      explanation: null,
      questionPattern: classifyQuestionPattern(parsed.questionText || ''),
      category: qCat,
      subCategory: qSub,
      keywords: '',
      choices: parsed.choices.map(c => ({
        ...c,
        isAnswer: block.answer ? (String(c.choiceNumber) === block.answer) : false
      }))
    };

    if (currentPassage) {
      currentPassage.questions.push(question);
    } else {
      standaloneQuestions.push(question);
    }
  }

  return {
    metaId: meta.metaId,
    fileId: meta.fileId,
    passages,
    standaloneQuestions
  };
}

// ── 블록 파싱: 지문/질문/선지 분리 ──
function parseBlock(blockLines, answer) {
  const trimmedLines = blockLines.map(l => l.trim());

  // 선지 위치 찾기
  const choiceIndices = [];
  for (let i = 0; i < trimmedLines.length; i++) {
    if (isChoiceLine(trimmedLines[i])) {
      choiceIndices.push(i);
    }
  }

  if (choiceIndices.length === 0) {
    // 선지 없는 블록 = 서술형 문제이거나 지문만 있는 블록
    return null;
  }

  const firstChoiceIdx = choiceIndices[0];

  // 선지 추출
  const choices = [];
  for (let ci = 0; ci < choiceIndices.length; ci++) {
    const idx = choiceIndices[ci];
    const m = trimmedLines[idx].match(CHOICE_RE);
    if (!m) continue;

    const num = CIRCLE_NUMS[m[1]];
    let choiceText = m[2].trim();

    // 다음 선지까지의 줄을 이어붙이기
    const nextIdx = ci + 1 < choiceIndices.length ? choiceIndices[ci + 1] : trimmedLines.length;
    for (let j = idx + 1; j < nextIdx; j++) {
      if (trimmedLines[j] && !isAnswerLine(trimmedLines[j])) {
        choiceText += ' ' + trimmedLines[j];
      }
    }

    choices.push({
      choiceNumber: num,
      choiceText: choiceText.trim(),
      isAnswer: false
    });
  }

  // 질문문 찾기: 선지 바로 위쪽에서 물음/요구 문장 탐색
  let questionStartIdx = firstChoiceIdx;
  for (let i = firstChoiceIdx - 1; i >= Math.max(0, firstChoiceIdx - 10); i--) {
    const line = trimmedLines[i];
    if (!line) continue;

    // 질문 시작 패턴 검출
    if (/것은\??$|고르시오|답하시오|고른\s*것은|보기.*서.*고른|맞[는게]|옳[는은]|적절한|적절하지/.test(line) ||
        /설명으로|이해로|감상으로|탐구한|다음.*물음|평가한/.test(line) ||
        /\?$|？$/.test(line)) {
      questionStartIdx = i;
      // 물음 시작 앞으로 더 탐색 (여러 줄 질문)
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = trimmedLines[j];
        if (!prev) break;
        // 지문 구분자나 빈 줄이면 중단
        if (/^[※]|^$|^[-–—]\s*[가-힣]/.test(prev)) break;
        // 선지 패턴이면 중단 (이전 문제의 마지막 선지)
        if (isChoiceLine(prev) || isAnswerLine(prev)) break;
        questionStartIdx = j;
      }
      break;
    }
  }

  // "※ 다음 글을 읽고" 패턴 포함 여부 체크
  let passageStartIdx = 0;
  for (let i = 0; i < questionStartIdx; i++) {
    if (/^※\s*다음\s*글을\s*읽고/.test(trimmedLines[i])) {
      passageStartIdx = i;
      break;
    }
  }

  // 질문문 추출
  const questionLines = trimmedLines.slice(questionStartIdx, firstChoiceIdx).filter(l => l);
  let questionText = questionLines.join(' ').trim();

  // <보기> 추출
  let referenceText = null;
  const fullBlock = blockLines.join('\n');
  const bogiMatch = fullBlock.match(/<보기>([\s\S]*?)(?=①|$)/);
  if (bogiMatch && bogiMatch[1].trim().length > 10) {
    referenceText = bogiMatch[1].trim();
  }

  // 지문 텍스트: questionStart 이전
  const passageLines = trimmedLines.slice(passageStartIdx, questionStartIdx).filter(l => l);
  const passageText = passageLines.join('\n').trim();

  return {
    passageText,
    questionText,
    referenceText,
    choices
  };
}

// ── 메인 실행 ──
console.log('Analyzing', successFiles.length, 'files...');

let analyzedCount = 0;
let errorCount = 0;
let totalPassages = 0;
let totalQuestions = 0;

for (let i = 0; i < successFiles.length; i++) {
  const meta = successFiles[i];
  const inputPath = path.join(EXTRACTED_DIR, meta.outputFile);
  const outputFile = 'meta_' + meta.metaId + '_file_' + meta.fileId + '.json';
  const outputPath = path.join(ANALYZED_DIR, outputFile);

  try {
    const text = fs.readFileSync(inputPath, 'utf8');
    const result = analyzeText(text, meta);

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

    const pCount = result.passages.length;
    const qCount = result.passages.reduce((s, p) => s + p.questions.length, 0) + result.standaloneQuestions.length;
    totalPassages += pCount;
    totalQuestions += qCount;
    analyzedCount++;

    if ((i + 1) % 200 === 0 || i === 0 || i === successFiles.length - 1) {
      console.log('[' + (i + 1) + '/' + successFiles.length + '] ' + outputFile + ' -> ' + pCount + 'p/' + qCount + 'q');
    }
  } catch (err) {
    errorCount++;
    console.error('[' + (i + 1) + '] ERROR: meta=' + meta.metaId + ' - ' + err.message);
  }
}

console.log('\n=== Analysis Summary ===');
console.log('Files analyzed:', analyzedCount);
console.log('Errors:', errorCount);
console.log('Total passages:', totalPassages);
console.log('Total questions:', totalQuestions);
