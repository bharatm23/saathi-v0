export type Source = {
  kind: "lab" | "wearable";
  label: string;
  date: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  blocked?: boolean;
};

// TODO: fetch from /api/chat (POST — send message, receive whole response)
export const mockMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "What was my last cholesterol reading?",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "Your most recent lipid panel was on **28 Feb 2026**. Total cholesterol was **196 mg/dL**, LDL **128 mg/dL** (flagged borderline), HDL **48 mg/dL**, and triglycerides **142 mg/dL**. Compared to your Jan panel, LDL dropped from 142 → 128.",
    sources: [{ kind: "lab", label: "Lipid panel", date: "28 Feb 2026" }],
  },
  {
    id: "m3",
    role: "user",
    content: "And my sleep average this month?",
  },
  {
    id: "m4",
    role: "assistant",
    content:
      "Over the last 28 days, your average sleep was **7h 12min** per night, with a median bedtime of 11:24 PM. Your longest run of ≥7h nights was 9 days (4–12 Apr).",
    sources: [{ kind: "wearable", label: "Wearable", date: "last 28 days" }],
  },
];

export const starterPrompts = [
  "Summarise my last 3 reports",
  "How has my HRV changed?",
  "What's been borderline recently?",
  "Sleep vs. steps last month",
  "Any values worth watching?",
];
