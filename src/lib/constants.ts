export const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Quantitative Aptitude", "Logical Reasoning", "Verbal Ability"] as const;
export type Subject = (typeof SUBJECTS)[number];
export const SUBJECT_SLUGS: Record<Subject, string> = {
  Physics: "physics",
  Chemistry: "chemistry",
  Mathematics: "mathematics",
  "Quantitative Aptitude": "quantitative-aptitude",
  "Logical Reasoning": "logical-reasoning",
  "Verbal Ability": "verbal-ability",
};
/** Subject groups used for navigation and default exam presets. */
export const SUBJECT_GROUPS: { name: string; subjects: Subject[] }[] = [
  { name: "PCM", subjects: ["Physics", "Chemistry", "Mathematics"] },
  { name: "Aptitude", subjects: ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability"] },
];
export const SUBJECT_SHORT: Record<Subject, string> = {
  Physics: "Physics",
  Chemistry: "Chemistry",
  Mathematics: "Maths",
  "Quantitative Aptitude": "Quant",
  "Logical Reasoning": "Reasoning",
  "Verbal Ability": "Verbal",
};

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_VALUES = [...DIFFICULTIES, "Unclassified"] as const;
export type DifficultyValue = (typeof DIFFICULTY_VALUES)[number];

export const QUESTION_TYPES = ["single_correct", "numerical"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = { single_correct: "Single correct MCQ", numerical: "Numerical" };

export const SOURCE_TYPES = ["local_dataset", "csv_upload", "json_upload", "jsonl_upload", "external_api", "manual"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SOURCE_LABELS: Record<SourceType, string> = {
  local_dataset: "Local dataset",
  csv_upload: "CSV upload",
  json_upload: "JSON upload",
  jsonl_upload: "JSONL upload",
  external_api: "External API",
  manual: "Manual",
};

export const VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ASSET_STATUSES = ["ok", "missing", "none"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Validation issues detected on a question. All of them block verification until fixed. */
export const QUESTION_ISSUES = {
  missing_question_text: "Question text is empty",
  missing_answer_key: "Correct answer is missing",
  invalid_answer_key: "Correct answer does not point to an available option",
  incomplete_options: "Fewer than four options are available",
  missing_numerical_answer: "Numerical answer is missing",
  invalid_numerical_answer: "Numerical answer is not a number",
  missing_image_file: "A referenced image file does not exist",
  image_reference_missing: "Question text contains an [IMAGE] placeholder without an image reference",
  ambiguous_image:
    "An image file name is shared by questions from different source papers, so the file may belong to another question — confirm the diagram visually",
  option_image_missing: "An option contains an [IMAGE] placeholder that cannot be displayed",
  unclassified_difficulty: "Difficulty is missing or not recognised",
  unknown_subject: "Subject is not one of Physics, Chemistry, Mathematics, Quantitative Aptitude, Logical Reasoning or Verbal Ability",
} as const;
export type QuestionIssue = keyof typeof QUESTION_ISSUES;

export const EXAM_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const ATTEMPT_STATUSES = ["in_progress", "evaluating", "submitted", "auto_submitted", "terminated", "reset"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
export const FINAL_ATTEMPT_STATUSES: AttemptStatus[] = ["submitted", "auto_submitted", "terminated"];

export const FINALIZATION_REASONS = ["student_submitted", "time_expired", "max_warnings", "exam_closed", "admin_finalized"] as const;
export type FinalizationReason = (typeof FINALIZATION_REASONS)[number];

export const INTEGRITY_EVENT_TYPES = [
  "fullscreen_exit",
  "tab_hidden",
  "fullscreen_unsupported",
  "camera_denied",
  "camera_interrupted",
  "microphone_denied",
  "microphone_interrupted",
  "sound_level",
  "network_offline",
  "network_restored",
] as const;
export type IntegrityEventType = (typeof INTEGRITY_EVENT_TYPES)[number];
export const INTEGRITY_EVENT_LABELS: Record<IntegrityEventType, string> = {
  fullscreen_exit: "Exited fullscreen",
  tab_hidden: "Switched tab / window hidden",
  fullscreen_unsupported: "Fullscreen not supported by browser",
  camera_denied: "Camera permission denied",
  camera_interrupted: "Camera stream interrupted",
  microphone_denied: "Microphone permission denied",
  microphone_interrupted: "Microphone stream interrupted",
  sound_level: "Sound level above threshold",
  network_offline: "Network offline",
  network_restored: "Network restored",
};
/** Event types that can count towards the warning limit, depending on exam settings. */
export const WARNING_EVENT_TYPES: IntegrityEventType[] = ["fullscreen_exit", "tab_hidden"];

export const RESULT_RELEASE_MODES = ["immediate", "after_end", "manual"] as const;
export type ResultReleaseMode = (typeof RESULT_RELEASE_MODES)[number];

export const ACADEMIC_LEVELS = ["Class 11", "Class 12", "Class 12 Passed", "Undergraduate", "Postgraduate", "Other"] as const;

export const ROLES = ["ADMIN", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const SESSION_COOKIE = "sgsu_session";
export const SESSION_TTL_DAYS = 14;
