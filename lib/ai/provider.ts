import { AISummaryOutput } from "@/lib/validation/schemas";

export interface SummaryInput {
  patientDisplayName: string;
  periodStart: string;
  periodEnd: string;
  checkIns: {
    date: string;
    mood: number | null;
    energy: number | null;
    sleep_hours: number | null;
    medication_taken: boolean | null;
    note: string | null;
  }[];
  sharedJournalEntries: { created_at: string; content: string }[];
  discussionItems: { title: string; description: string | null; status: string }[];
}

export interface AIProvider {
  name: string;
  generateSummary(input: SummaryInput): Promise<AISummaryOutput>;
}

// Swapping providers later (Anthropic, OpenAI, a self-hosted model) means
// writing one new file that implements this interface -- nothing that
// calls generateSummary() needs to change.
