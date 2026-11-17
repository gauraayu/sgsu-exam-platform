import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { notFound, badRequest } from "@/lib/errors";
import { getExamByToken } from "@/services/exam.service";
import { requestAccommodation } from "@/services/attempt.service";

const schema = z.object({
  reason: z.string().trim().min(10, "Please describe your situation in at least 10 characters.").max(1000),
  camera: z.boolean().default(false),
  microphone: z.boolean().default(false),
  fullscreen: z.boolean().default(false),
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStudent();
  const input = await parseBody(req, schema);
  if (!input.camera && !input.microphone && !input.fullscreen) throw badRequest("Select at least one requirement you need an exemption from.");
  const exam = await getExamByToken(params.id);
  if (!exam) throw notFound("Exam");
  const doc = await requestAccommodation(exam._id, user.id, input);
  return json({ accommodation: { status: doc?.status } }, 201);
});
