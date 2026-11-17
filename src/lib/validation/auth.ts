import { z } from "zod";
import { ACADEMIC_LEVELS } from "@/lib/constants";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .regex(/[A-Za-z]/, "Password must contain a letter.")
  .regex(/\d/, "Password must contain a number.");

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^\+?\d[\d\s-]{8,14}\d$/, "Enter a valid mobile number.");

export const profileFields = {
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  mobile: mobileSchema,
  academicLevel: z.enum(ACADEMIC_LEVELS, { message: "Select your academic level." }),
  institutionName: z.string().trim().min(2, "Enter your school or college name.").max(200),
};

export const signupSchema = z
  .object({
    ...profileFields,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export const profileUpdateSchema = z.object(profileFields);

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

/** Only same-origin relative paths are accepted as post-login destinations (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^\/(api|_next)\//.test(next)) return fallback;
  return next;
}
