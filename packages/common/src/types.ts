// PrevTestMetaInfo.java (Admin)
export interface PrevTestMetaInfo {
  id: number;
  region?: string;
  schoolType?: string;
  schoolName?: string;
  year?: string;
  grade?: string;
  term?: string;
  testType?: string;
  section?: string;
  publisher?: string;
  fileType?: string;
  insertTime?: string;
}

// PrevTestFileInfo.java (Admin)
export interface PrevTestFileInfo {
  id: number;
  infoId: number;
  content?: Buffer | null;
  fileName?: string;
  insertTime?: string;
}

// PdfToHwp.java (Admin)
export interface PdfToHwp {
  id?: number;
  fileId: number;
  userId: number;
  work?: number;
}

// 지문
export interface Passage {
  id: number;
  prevTestMetaId: number;
  prevTestFileId: number;
  content: string;
  category: string; // 문학|문법|화작|독서|기타
  subCategory?: string;
  title?: string;
  author?: string;
  keywords?: string;
  insertTime?: string;
}

// 문제
export interface ExamQuestion {
  id: number;
  passageId?: number | null;
  prevTestMetaId: number;
  prevTestFileId: number;
  questionNumber: number;
  questionText: string;
  questionType: string; // 객관식|서술형
  referenceText?: string | null;
  category?: string;
  subCategory?: string;
  keywords?: string;
  answer?: string;
  explanation?: string;
  questionPattern?: string;
  insertTime?: string;
}

// 선지
export interface ExamQuestionChoice {
  id: number;
  questionId: number;
  choiceNumber: number;
  choiceText: string;
  isAnswer: boolean;
}

// 지문 + 문제 + 선지 조합
export interface PassageWithQuestions extends Passage {
  questions: ExamQuestionWithChoices[];
}

export interface ExamQuestionWithChoices extends ExamQuestion {
  choices: ExamQuestionChoice[];
}

// 문학 지문 (kaca.literature)
export interface Literature {
  id: number;
  prevTestMetaId: number;
  prevTestFileId: number;
  content: string;
  category: string;
  subCategory?: string;
  title?: string;
  author?: string;
  insertTime?: string;
}

// 독서 지문 (kaca.reading)
export interface Reading {
  id: number;
  prevTestMetaId: number;
  prevTestFileId: number;
  content: string;
  category: string;
  subCategory?: string;
  keywords?: string;
  insertTime?: string;
}

// 문법 파일 메타 (kaca.split_file_meta_info)
export interface GrammarFileMeta {
  id: number;
  grade?: string;
  subject?: string;
  publisher?: string;
  searchKeyword?: string;
  schoolName?: string;
  year?: number;
  term?: number;
  testType?: number;
  fileType?: string;
  insertTime?: string;
}

// 문법 파일 콘텐츠 (kaca.split_file_content)
export interface GrammarFileContent {
  id: number;
  metaId: number;
  fileName?: string;
  content?: Buffer | string | null;
  insertTime?: string;
}

