import { handler, json } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { listAvailableExamsForStudent, studentExamNotices } from "@/services/results.service";

export const GET = handler(async () => {
  const user = await requireStudent();
  const [exams, notices] = await Promise.all([listAvailableExamsForStudent(user.id), studentExamNotices(user.id)]);
  return json({ exams, notices });
});
