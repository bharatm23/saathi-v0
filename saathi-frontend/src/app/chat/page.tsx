"use client";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Send, AlertTriangle, FileText, Activity } from "lucide-react";
// import { mockMessages, starterPrompts, type ChatMessage, type Source } from "@/mocks/chat";
import { starterPrompts, type ChatMessage, type Source } from "@/mocks/chat";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchChat } from "@/lib/api"

const DISCLAIMER = "Saathi shows your data · not medical advice";

export default function ChatPage() {
  // const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const isEmpty = messages.length === 0;

  async function send(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    // TODO: POST /api/chat { messages } → whole-response JSON
    try {
      const data = await fetchChat(text)
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.response,
        blocked: data.blocked,
        sources: (data.sources ?? []).map(s => ({
          kind: s.type === "lab_report" ? "lab" : "wearable" as "lab" | "wearable",
          label: s.lab ?? s.date_range ?? "Source",
          date: s.date ?? s.date_range ?? "",
        })),
      }
      setMessages((m) => [...m, reply])
    } catch {
      setMessages((m) => [...m, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "Something went wrong connecting to Saathi. Is the backend running on port 8000?",
      }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <PageShell title="Chat" meta="Priya · 4 reports · 28d wearable">
      <div className="space-y-4 pb-6">
        {isEmpty ? (
          <StarterPrompts onPick={send} />
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
        {typing && <TypingBubble />}
      </div>

      {/* Input bar — sticky at bottom of content column */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="sticky bottom-6 bg-gray-50 pt-2"
      >
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data…"
            className="flex-1 bg-transparent outline-none text-[14px] text-gray-700 placeholder:text-gray-400 py-2"
          />
          <button
            type="submit"
            className="bg-navy text-white rounded-lg w-9 h-9 flex items-center justify-center hover:bg-navy/90 disabled:opacity-40"
            disabled={!input.trim()}
            aria-label="Send"
          >
            <Send size={16} strokeWidth={2} />
          </button>
        </div>
      </form>
    </PageShell>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-navy text-white text-[14px] leading-[1.5] px-4 py-2.5 rounded-2xl rounded-br-md">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.blocked) {
    return (
      <div className="space-y-1.5">
        <div className="border border-amber/40 bg-amber/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
          <div className="flex items-center gap-2 text-[12px] text-amber font-medium uppercase tracking-wide mb-2">
            <AlertTriangle size={14} />
            Medical query detected
          </div>
          <div className="prose-saathi">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        </div>
        <div className="text-[11px] text-gray-400">{DISCLAIMER}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Card className="rounded-bl-md px-4 py-3 max-w-[85%]">
        <div className="prose-saathi">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {msg.sources.map((s, i) => <SourceBadge key={i} source={s} />)}
          </div>
        )}
      </Card>
      <div className="text-[11px] text-gray-400">{DISCLAIMER}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: Source }) {
  const Icon = source.kind === "lab" ? FileText : Activity;
  return (
    <Pill tone={source.kind === "lab" ? "teal" : "blue"}>
      <Icon size={11} />
      {source.label} · {source.date}
    </Pill>
  );
}

function TypingBubble() {
  return (
    <Card className="rounded-bl-md px-4 py-3 w-fit">
      <div className="flex gap-1 items-end h-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </Card>
  );
}

function StarterPrompts({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="py-8">
      <div className="text-center mb-6">
        <div className="text-[20px] font-semibold text-gray-900">Ask Saathi about your data</div>
        <div className="text-[12px] text-gray-400 mt-1">Try one of these, or type your own</div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {starterPrompts.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className={cn(
              "text-[13px] px-3 py-1.5 rounded-full border border-blue/30 bg-blue/[0.06] text-blue",
              "hover:bg-blue/[0.1] transition-colors"
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
