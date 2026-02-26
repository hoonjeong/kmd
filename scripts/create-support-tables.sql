-- ============================================================
-- 새 DB(kaca)에 지원 테이블 생성
-- 실행: mysql -h 168.107.4.234 -u edenmanager -p kaca < scripts/create-support-tables.sql
-- ============================================================

-- 사용자/관리자 통합 (role: admin|teacher)
CREATE TABLE IF NOT EXISTS auth_user (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(200) DEFAULT NULL,
  email VARCHAR(200) DEFAULT NULL UNIQUE,
  email_verified DATETIME DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  school_name VARCHAR(200) DEFAULT NULL,
  image TEXT DEFAULT NULL,
  role VARCHAR(50) DEFAULT 'teacher',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- OAuth 계정 (NextAuth)
CREATE TABLE IF NOT EXISTS auth_account (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token TEXT DEFAULT NULL,
  access_token TEXT DEFAULT NULL,
  expires_at BIGINT DEFAULT NULL,
  token_type VARCHAR(50) DEFAULT NULL,
  scope TEXT DEFAULT NULL,
  id_token TEXT DEFAULT NULL,
  session_state TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider_account (provider, provider_account_id),
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 크레딧 잔액
CREATE TABLE IF NOT EXISTS user_credits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  credits INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 크레딧 내역
CREATE TABLE IF NOT EXISTS credit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL COMMENT 'charge|deduct|admin',
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 생성 이력
CREATE TABLE IF NOT EXISTS generation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL COMMENT '문학|문법',
  title VARCHAR(500) DEFAULT NULL,
  generated_text LONGTEXT DEFAULT NULL,
  request_params JSON DEFAULT NULL,
  difficulty VARCHAR(10) DEFAULT NULL,
  question_count INT DEFAULT NULL,
  template VARCHAR(50) DEFAULT NULL,
  hwpx_blob LONGBLOB DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 기출 시험 메타
CREATE TABLE IF NOT EXISTS prev_test_meta_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  region VARCHAR(100) DEFAULT NULL,
  school_type VARCHAR(100) DEFAULT NULL,
  school_name VARCHAR(200) DEFAULT NULL,
  year VARCHAR(10) DEFAULT NULL,
  grade VARCHAR(10) DEFAULT NULL,
  term VARCHAR(10) DEFAULT NULL,
  test_type VARCHAR(50) DEFAULT NULL,
  section VARCHAR(100) DEFAULT NULL,
  publisher VARCHAR(100) DEFAULT NULL,
  file_type VARCHAR(20) DEFAULT NULL,
  insert_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_school_year (school_name, year, grade, term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 기출 시험 파일
CREATE TABLE IF NOT EXISTS prev_test_file_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  info_id INT NOT NULL,
  content LONGBLOB DEFAULT NULL,
  file_name VARCHAR(500) DEFAULT NULL,
  insert_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_info_id (info_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
