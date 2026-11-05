import type { Template } from "./types";

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Let FrostedFlakes pick the structure that fits the conversation.",
    sections: [],
    instructions:
      "Choose 3-6 section headings that best fit what was actually discussed. Prefer topic-based headings over generic ones.",
    builtin: true,
  },
  {
    id: "one-on-one",
    name: "1:1",
    description: "Manager / report check-ins.",
    sections: ["Updates & Wins", "Blockers & Concerns", "Feedback", "Career & Growth", "Next Steps"],
    instructions:
      "Capture how the person is doing, what is blocking them, and any feedback exchanged in either direction. Be candid but kind.",
    builtin: true,
  },
  {
    id: "standup",
    name: "Stand-up",
    description: "Daily team sync.",
    sections: ["Yesterday", "Today", "Blockers"],
    instructions:
      "Group updates per person where possible (e.g. 'Sam: shipped the billing fix'). Keep each line short.",
    builtin: true,
  },
  {
    id: "customer-discovery",
    name: "Customer Discovery",
    description: "Learn about a customer's problems and workflow.",
    sections: ["Customer Background", "Current Workflow", "Pain Points", "Notable Quotes", "Buying Signals", "Follow-ups"],
    instructions:
      "Focus on the customer's own words. Put verbatim, memorable quotes in 'Notable Quotes' with quotation marks. Note budget, timeline, and decision makers if mentioned.",
    builtin: true,
  },
  {
    id: "sales-call",
    name: "Sales Call",
    description: "BANT-style qualification notes.",
    sections: ["Company & Contacts", "Needs", "Budget", "Authority", "Timeline", "Objections", "Next Steps"],
    instructions:
      "Qualify the deal. If a BANT field was not discussed, write a single item saying it was not covered so the rep knows to ask.",
    builtin: true,
  },
  {
    id: "interview",
    name: "Candidate Interview",
    description: "Hiring interview scorecard.",
    sections: ["Background", "Strengths", "Concerns", "Role Fit", "Recommendation"],
    instructions:
      "Stay evidence-based: tie every strength or concern to something the candidate said. Do not invent a hire/no-hire verdict if the interviewer did not express one; summarize the signal instead.",
    builtin: true,
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "Ideas, options and decisions.",
    sections: ["Problem", "Ideas", "Pros & Cons", "Decisions", "Open Questions"],
    instructions: "Capture every idea raised, even rejected ones, and who suggested it when clear.",
    builtin: true,
  },
];
