import pool from '../db';
import type { ExamQuestion, ExamQuestionChoice, ExamQuestionWithChoices } from '../types';
import type { RowDataPacket } from 'mysql2';

const EXAM_QUESTION = 'kaca.exam_question';
const EXAM_QUESTION_CHOICE = 'kaca.exam_question_choice';

/**
 * 여러 지문의 문제+선지를 배치로 조회 (N+1 쿼리 방지)
 * 지문당 루프 대신 IN (...) 로 1~3회 쿼리로 처리
 */
export async function fetchQuestionsWithChoicesByPassageIds(
  passageIds: number[],
  questionPatterns?: string[]
): Promise<Map<number, ExamQuestionWithChoices[]>> {
  if (passageIds.length === 0) return new Map();

  // 1) 모든 문제 일괄 조회
  let sql = `SELECT id, passage_id as passageId, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
             question_number as questionNumber, question_text as questionText, question_type as questionType,
             reference_text as referenceText, category, sub_category as subCategory, keywords,
             answer, explanation, question_pattern as questionPattern, insert_time as insertTime
             FROM ${EXAM_QUESTION} WHERE passage_id IN (${passageIds.map(() => '?').join(',')})`;
  const params: (string | number)[] = [...passageIds];

  if (questionPatterns && questionPatterns.length > 0) {
    sql += ` AND question_pattern IN (${questionPatterns.map(() => '?').join(',')})`;
    params.push(...questionPatterns);
  }

  sql += ' ORDER BY passage_id ASC, question_number ASC';
  const [questionRows] = await pool.query<RowDataPacket[]>(sql, params);
  const questions = questionRows as ExamQuestion[];

  if (questions.length === 0) {
    const result = new Map<number, ExamQuestionWithChoices[]>();
    for (const pid of passageIds) result.set(pid, []);
    return result;
  }

  // 2) 모든 선지 일괄 조회
  const questionIds = questions.map(q => q.id);
  const [choiceRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, question_id as questionId, choice_number as choiceNumber,
            choice_text as choiceText, is_answer as isAnswer
     FROM ${EXAM_QUESTION_CHOICE} WHERE question_id IN (${questionIds.map(() => '?').join(',')})
     ORDER BY question_id ASC, choice_number ASC`,
    questionIds
  );
  const choices = (choiceRows as ExamQuestionChoice[]).map(c => ({ ...c, isAnswer: !!c.isAnswer }));

  // 3) 선지를 문제별로 그룹핑
  const choicesByQuestionId = new Map<number, ExamQuestionChoice[]>();
  for (const c of choices) {
    const arr = choicesByQuestionId.get(c.questionId);
    if (arr) arr.push(c);
    else choicesByQuestionId.set(c.questionId, [c]);
  }

  // 4) 문제+선지를 지문별로 그룹핑
  const result = new Map<number, ExamQuestionWithChoices[]>();
  for (const pid of passageIds) result.set(pid, []);

  for (const q of questions) {
    const pid = q.passageId!;
    const qWithChoices: ExamQuestionWithChoices = {
      ...q,
      choices: choicesByQuestionId.get(q.id) || [],
    };
    result.get(pid)!.push(qWithChoices);
  }

  return result;
}
