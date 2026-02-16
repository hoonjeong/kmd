-- 문학/독서 탭 분리를 위한 인덱스 추가
-- 실행: mysql -h 27.96.131.14 -u edenmanager -p kaca < scripts/add-indexes.sql

-- kaca.literature: 작품명/작가명 LIKE 검색용 + 본문 FULLTEXT
CREATE INDEX idx_literature_title ON kaca.literature (title(100));
CREATE INDEX idx_literature_author ON kaca.literature (author(50));
ALTER TABLE kaca.literature ADD FULLTEXT INDEX ft_literature_content (content);

-- kaca.reading: sub_category 단독 필터용
CREATE INDEX idx_reading_sub_category ON kaca.reading (sub_category);
