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

// 문법 메타 (grammar_meta)
export interface GrammarMeta {
  id: number;
  grade: string;
  publisher: string;
  category: string;
  subCategory: string | null;
  insertTime: Date;
}

// 문법 파일 (grammar_file)
export interface GrammarFile {
  id: number;
  metaId: number;
  fileName: string;
  content: Buffer | string;
  insertTime: Date;
}

// 문학 메타 (literature_meta)
export interface LiteratureMeta {
  id: number;
  grade: string;
  publisher: string;
  category: string;
  title: string | null;
  author: string | null;
  insertTime: Date;
}

// 문학 파일 (literature_file)
export interface LiteratureFile {
  id: number;
  metaId: number;
  fileName: string;
  content: Buffer | string;
  insertTime: Date;
}
