**Saathi — Design Brief for Implementation**

---

**Product context**

Saathi is a family health memory app. Phase 0 has five screens: Health Dashboard (iframe embed), Lab Reports (upload), Chat (talk to your data), Appointment Brief (generate + export), and Health Digest (weekly summary). Users are urban, 25–35, health-aware, already comfortable with AI tools. The tone is calm, trustworthy, clinical-adjacent but not cold.

---

**Design direction**

Minimal and premium. Think Notion meets a private clinic. No gradients, no illustrations, no gamification. Data is the hero — the UI should be invisible infrastructure around it. Every screen should feel like it was designed for someone who is slightly anxious about a health result and needs clarity, not decoration.

---

**Colour system**

```
Navy    #0F2D52   — primary brand, sidebar, headers
Blue    #1A56A0   — interactive elements, links, active states
Teal    #0E7C7B   — positive states, activation tags, source badges
Amber   #A85C00   — warnings, medium-risk flags (e.g. borderline values)
Red     #A8001E   — blocked states, low feasibility, critical flags
Gray 50  #F9FAFB  — page background
Gray 100 #F3F4F6  — card backgrounds, subtle dividers
Gray 700 #374151  — body text
White   #FFFFFF   — card surfaces
```

---

**Typography**

Inter throughout. No display fonts.

```
Page title      — 20px / 600 weight / gray-900
Section header  — 16px / 600 weight / navy
Body            — 14px / 400 weight / gray-700
Caption/meta    — 12px / 400 weight / gray-400
Labels/tags     — 11px / 500 weight / uppercase tracking-wide
```

---

**Layout**

Fixed left sidebar 224px wide, navy background. Main content area scrolls independently. No top nav bar — sidebar handles all navigation. Max content width 720px centred in the main area for all text-heavy screens (chat, brief, digest). Full width for dashboard iframe only.

---

**Component specs by screen**

**Sidebar**
- Logo: "Saathi" in white 18px/700, subtitle "Your family's health memory" in blue-300 12px below
- Nav items: 16px icon + label, active state white text on white/15 background, inactive blue-200
- Persistent disclaimer at bottom: "Saathi shows your data · Not medical advice" in blue-400 11px
- No hover animations — simple colour transitions only

**Lab Reports (`/reports`)**
- Drop zone: 2px dashed border, rounded-2xl, neutral on idle, blue border + blue-50 bg on drag. Upload icon centred, two lines of helper text, one CTA button
- Upload list below: each item is a white card with file icon, filename, status indicator. Success state shows extracted metric names as small blue pill tags (max 6 shown, "+N more" for rest). Error state amber text
- Amber notice bar below drop zone for handwritten report limitation — not a modal, not dismissible, just a quiet inline note

**Chat (`/chat`)**
- No chat chrome — clean white background, messages only
- User bubbles: right-aligned, navy background, white text, rounded-2xl with br-sm cut
- Assistant bubbles: left-aligned, white card with gray-200 border, shadow-sm, rounded-2xl with bl-sm cut
- Blocked messages: amber-50 background, amber border, small warning icon + "Medical query detected" label above content
- Source badges: small pill below each assistant message, teal for lab reports, blue for wearable. Icon + lab name + date
- Persistent disclaimer: 11px gray-400, one line below every assistant message — never above
- Starter prompts: pill buttons in blue-50 with blue-200 border, shown only before first user message, wrap naturally
- Typing indicator: three gray dots bouncing, same bubble style as assistant
- Input bar: full width, rounded-xl border, no shadow. Send button navy, icon only

**Appointment Brief (`/brief`)**
- Appointment type selector: 2-column grid of bordered pill buttons. Selected state blue border + blue-50 bg. No radio icons
- Generate button: full width, navy, rounded-xl
- Output: white card, generous padding. Markdown rendered with prose-saathi styles. Section headers (##) in navy 16px/600, body 14px gray-700
- Action row above output: Copy and Download as ghost buttons with icons, right-aligned
- Data source line: "3 reports · 28 days wearable" in gray-400 12px, left-aligned in same row
- Disclaimer: 11px gray-400 centred below card

**Health Digest (`/digest`)**
- Period selector: three pill toggles (7 days / 14 days / 30 days). Active: navy fill white text. Inactive: white with gray border
- Loading state: spinner centred in a white card placeholder with "Reading your health data…" below it
- Output: same white card + prose-saathi as brief. **This week** section in bold navy. Improving / Watch sections use teal and amber left border respectively (4px left rule, same as callout pattern)
- Refresh icon button top right, spins while loading

---

**Shared patterns**

Cards: `bg-white border border-gray-200 rounded-2xl shadow-sm` — this is the only card style used across all screens. No elevation hierarchy, no card variants.

Tags / pills: `text-xs font-medium px-2 py-0.5 rounded-full` — colour fills as above per semantic meaning.

Callout blocks (used in brief and digest): 4px left border, matching light background fill. Navy for info, teal for positive, amber for caution. No icons in callouts — border colour carries the meaning.

Empty states: centered in the content area, icon in gray-300, one-line message in gray-500, one CTA if applicable. Never use illustrations.

Error states: inline, never toast or modal for Phase 0. Red-50 background, red-600 text, 12px.

---

**What to avoid**

No gradients. No box shadows heavier than `shadow-sm`. No loading skeletons — simple spinner only. No toast notifications. No modals. No animations beyond colour transitions and the typing indicator bounce. No icons larger than 20px in content areas. No dark mode — single light theme only for Phase 0.