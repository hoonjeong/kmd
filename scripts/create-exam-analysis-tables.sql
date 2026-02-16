-- 시험지 분석 결과 저장 테이블
-- 기존 question 테이블과의 충돌 방지를 위해 exam_ 접두사 사용

-- 지문 테이블
CREATE TABLE IF NOT EXISTS passage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prev_test_meta_id INT NOT NULL,
  prev_test_file_id INT NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(20) NOT NULL COMMENT '문학|문법|화작|독서|기타',
  sub_category VARCHAR(50) DEFAULT NULL,
  title VARCHAR(200) DEFAULT NULL,
  author VARCHAR(100) DEFAULT NULL,
  keywords VARCHAR(500) DEFAULT NULL,
  insert_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_passage_content (content),
  FULLTEXT INDEX ft_passage_keywords (keywords),
  INDEX idx_passage_meta (prev_test_meta_id),
  INDEX idx_passage_file (prev_test_file_id),
  INDEX idx_passage_category (category, sub_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 문제 테이블 (exam_question: 기존 question 테이블과 구분)
CREATE TABLE IF NOT EXISTS exam_question (
  id INT AUTO_INCREMENT PRIMARY KEY,
  passage_id INT DEFAULT NULL,
  prev_test_meta_id INT NOT NULL,
  prev_test_file_id INT NOT NULL,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL DEFAULT '객관식' COMMENT '객관식|서술형',
  reference_text TEXT DEFAULT NULL COMMENT '보기 텍스트',
  category VARCHAR(20) DEFAULT NULL,
  sub_category VARCHAR(50) DEFAULT NULL,
  keywords VARCHAR(500) DEFAULT NULL,
  answer VARCHAR(100) DEFAULT NULL,
  explanation TEXT DEFAULT NULL,
  question_pattern VARCHAR(100) DEFAULT NULL COMMENT '문제 유형 패턴',
  insert_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_exam_question_text (question_text),
  FULLTEXT INDEX ft_exam_question_keywords (keywords),
  INDEX idx_exam_question_passage (passage_id),
  INDEX idx_exam_question_meta (prev_test_meta_id),
  INDEX idx_exam_question_file (prev_test_file_id),
  INDEX idx_exam_question_category (category, sub_category),
  INDEX idx_exam_question_pattern (question_pattern),
  CONSTRAINT fk_exam_question_passage FOREIGN KEY (passage_id) REFERENCES passage(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 선지 테이블
CREATE TABLE IF NOT EXISTS exam_question_choice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  choice_number TINYINT NOT NULL COMMENT '1~5',
  choice_text TEXT NOT NULL,
  is_answer TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_exam_choice_question FOREIGN KEY (question_id) REFERENCES exam_question(id) ON DELETE CASCADE,
  INDEX idx_exam_choice_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
