import type { Metadata } from "next";
import { ResultView } from "@/components/student/result-view";

export const metadata: Metadata = { title: "Result" };

export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ResultView attemptId={attemptId} />;
}
