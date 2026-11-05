export type Speaker = "me" | "them";

export interface TranscriptSegment {
  id: string;
  speaker: Speaker;
  text: string;
  /** milliseconds since the recording of this meeting started */
  t: number;
}

export interface EnhancedItem {
  text: string;
  /** "user" = the point came from the user's own notes; "ai" = added from the transcript */
  source: "user" | "ai";
}

export interface EnhancedSection {
  heading: string;
  items: EnhancedItem[];
}

export interface ActionItem {
  task: string;
  owner: string;
}

export interface EnhancedNotes {
  summary: string;
  sections: EnhancedSection[];
  action_items: ActionItem[];
  templateId: string;
  generatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Meeting {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** scheduled start, when created from a calendar event */
  scheduledAt?: string;
  attendees: string[];
  folderId: string | null;
  templateId: string;
  notes: string;
  transcript: TranscriptSegment[];
  /** total ms recorded so far, so resumed recordings keep a monotonic clock */
  recordedMs: number;
  enhanced: EnhancedNotes | null;
  chat: ChatMessage[];
  shareId: string | null;
  calendarEventId?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  sections: string[];
  instructions: string;
  builtin: boolean;
}

export interface Settings {
  userName: string;
  icsUrl: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  description: string;
}

export interface DB {
  meetings: Meeting[];
  folders: Folder[];
  templates: Template[];
  settings: Settings;
}
