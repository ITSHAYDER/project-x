import { z } from "zod";

// Every form submission is validated against one of these on the server
// before it ever touches the database -- never trust client-side
// validation alone (the HTML `required`/`min` attributes are a UX
// nicety, not a security boundary; a request can always be sent
// without going through the form at all).

export const checkInSchema = z.object({
  mood: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  sleep_hours: z.coerce.number().min(0).max(24).optional(),
  medication_taken: z.enum(["yes", "no", "not_applicable"]).optional(),
  note: z.string().max(2000).optional(),
  wants_to_discuss: z.coerce.boolean().optional(),
});

export const journalEntrySchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, "Write something first.").max(10000),
  is_shared_with_psychiatrist: z.coerce.boolean().optional(),
});

export const discussionItemSchema = z.object({
  title: z.string().min(1, "Give it a short title.").max(200),
  description: z.string().max(2000).optional(),
});

// Structured AI summary output. If the model's response doesn't match
// this shape exactly, it is never stored or shown (see lib/ai/provider.ts)
// -- an unvalidated AI response is treated as a failure, not a summary.
export const aiSummarySchema = z.object({
  major_changes: z.array(z.string()).max(10),
  recurring_themes: z.array(z.string()).max(10),
  medication_experiences: z.array(z.string()).max(10),
  patient_reported_concerns: z.array(z.string()).max(10),
  discussion_topics: z.array(z.string()).max(10),
  questions_for_review: z.array(z.string()).max(10),
  uncertainties: z.array(z.string()).max(10),
});

export type AISummaryOutput = z.infer<typeof aiSummarySchema>;
