-- ============================================================
-- 문제 유형 분류 시스템 스키마
-- 실행: mysql -h 168.107.4.234 -u edenmanager -p kaca < scripts/create-question-type-tables.sql
-- ============================================================

-- 1. question_type_ref: 유형 코드 참조 테이블
CREATE TABLE IF NOT EXISTS question_type_ref (
  code VARCHAR(30) PRIMARY KEY,
  category VARCHAR(10) NOT NULL COMMENT '문학|독서|문법|화작',
  name_ko VARCHAR(50) NOT NULL COMMENT '한국어 유형명',
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 초기 데이터: 문학 (9개)
INSERT INTO question_type_ref (code, category, name_ko, sort_order) VALUES
  ('LIT_EXPRESSION', '문학', '표현/서술특징', 0),
  ('LIT_CONTENT',    '문학', '내용이해',       1),
  ('LIT_SPEAKER',    '문학', '화자의태도',     2),
  ('LIT_MEANING',    '문학', '시어/구절의미',  3),
  ('LIT_BOGI',       '문학', '보기감상',       4),
  ('LIT_CHARACTER',  '문학', '인물파악',       5),
  ('LIT_COMPARE',    '문학', '작품비교',       6),
  ('LIT_FUNCTION',   '문학', '소재/배경기능',  7),
  ('LIT_CRITICISM',  '문학', '외적준거감상',   8)
ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko), sort_order = VALUES(sort_order);

-- 초기 데이터: 독서 (9개)
INSERT INTO question_type_ref (code, category, name_ko, sort_order) VALUES
  ('READ_MATCH',     '독서', '내용일치',   0),
  ('READ_DETAIL',    '독서', '세부정보',   1),
  ('READ_STRUCTURE', '독서', '전개방식',   2),
  ('READ_INFER',     '독서', '추론',       3),
  ('READ_APPLY',     '독서', '적용',       4),
  ('READ_COMPARE',   '독서', '비교대조',   5),
  ('READ_VOCAB',     '독서', '어휘',       6),
  ('READ_AUTHOR',    '독서', '필자관점',   7),
  ('READ_LOGIC',     '독서', '논리추론',   8)
ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko), sort_order = VALUES(sort_order);

-- 초기 데이터: 문법 (7개)
INSERT INTO question_type_ref (code, category, name_ko, sort_order) VALUES
  ('GRAM_PHONOL',    '문법', '음운',         0),
  ('GRAM_MORPH',     '문법', '형태소/단어',  1),
  ('GRAM_SYNTAX',    '문법', '문장구조',     2),
  ('GRAM_EXPR',      '문법', '문장표현',     3),
  ('GRAM_HISTORY',   '문법', '국어사',       4),
  ('GRAM_ORTHO',     '문법', '맞춤법/표기',  5),
  ('GRAM_DISCOURSE', '문법', '담화',         6)
ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko), sort_order = VALUES(sort_order);

-- 초기 데이터: 화작 (8개)
INSERT INTO question_type_ref (code, category, name_ko, sort_order) VALUES
  ('HW_SPEAK_METHOD',  '화작', '말하기방식',   0),
  ('HW_SPEAK_CONTENT', '화작', '화법내용이해', 1),
  ('HW_LISTENER',      '화작', '청자반응',     2),
  ('HW_PLAN',          '화작', '글쓰기계획',   3),
  ('HW_MATERIAL',      '화작', '자료활용',     4),
  ('HW_REVISION',      '화작', '고쳐쓰기',     5),
  ('HW_CONDITION',     '화작', '조건표현',     6),
  ('HW_MEDIA',         '화작', '매체',         7)
ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko), sort_order = VALUES(sort_order);

-- 미분류
INSERT INTO question_type_ref (code, category, name_ko, sort_order) VALUES
  ('UNKNOWN', '기타', '미분류', 99)
ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko);

-- 2. parsed_question: HWP 파일에서 파싱한 개별 문제
CREATE TABLE IF NOT EXISTS parsed_question (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_type ENUM('grammar', 'literature') NOT NULL,
  source_meta_id INT NOT NULL COMMENT 'grammar_meta.id 또는 literature_meta.id',
  question_number INT DEFAULT NULL,
  question_text TEXT DEFAULT NULL,
  choices JSON DEFAULT NULL COMMENT '["선택지1", "선택지2", ...]',
  answer VARCHAR(10) DEFAULT NULL,
  question_type VARCHAR(30) DEFAULT NULL COMMENT 'FK → question_type_ref.code',
  confidence FLOAT DEFAULT 0 COMMENT '분류 확신도 (0~1)',
  insert_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source (source_type, source_meta_id),
  INDEX idx_type (question_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. generation_history에 question_types 컬럼 추가
-- 예: [{"number":1,"type":"LIT_EXPRESSION","name":"표현/서술특징"}, ...]
-- MySQL 8.0은 ADD COLUMN IF NOT EXISTS 미지원. 수동 실행:
-- ALTER TABLE generation_history ADD COLUMN question_types JSON DEFAULT NULL AFTER question_count;
