"use client";
import { useState, useEffect, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Send, AlertTriangle, FileText, Activity } from "lucide-react";
import { starterPrompts, type ChatMessage, type Source } from "@/mocks/chat";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase";
import { fetchChat } from "@/lib/api";

const DISCLAIMER = "Saathi shows your data · not medical advice";

type Member = { id: string; name: string; relation: string; isSelf?: boolean };

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function ChatPage() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [input,       setInput]       = useState("");
  const [typing,      setTyping]      = useState(false);
  const [members,     setMembers]     = useState<Member[]>([]);
  const [forMember,   setForMember]   = useState<Member | null>(null); // null = All
  const [meta,        setMeta]        = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const name = user.user_metadata?.full_name?.split(" ")[0]
        ?? user.email?.split("@")[0] ?? "You";

      const { data: fam } = await supabase
        .from("family_members").select("*").eq("owner_id", user.id).order("created_at");
      const self: Member = { id: user.id, name, relation: "Self", isSelf: true };
      setMembers([self, ...(fam ?? []).map(m => ({ id: m.id, name: m.name, relation: m.relation }))]);

      const { count: rc } = await supabase
        .from("lab_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: wc } = await supabase
        .from("wearable_snapshots").select("*", { count: "exact", head: true }).eq("user_id", user.id);

      setMeta(`${name} · ${rc ?? 0} report${rc !== 1 ? "s" : ""} · ${wc ?? 0}d wearable data`);
    }
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send(text: string) {
    if (!text.trim() || typing) return;
    const memberContext = forMember
      ? ` (asking about ${forMember.name})`
      : "";
    const queryWithContext = forMember
      ? `[For family member: ${forMember.name} (${forMember.relation})] ${text}`
      : text;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const data = await fetchChat(queryWithContext);
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.response,
        blocked: data.blocked,
        sources: (data.sources ?? []).map((s: any) => ({
          kind: s.type === "lab_report" ? "lab" : "wearable" as "lab" | "wearable",
          label: s.lab ?? s.date_range ?? "Source",
          date: s.date ?? s.date_range ?? "",
        })),
      };
      setMessages(m => [...m, reply]);
    } catch (e: any) {
      setMessages(m => [...m, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: e.name === "AbortError"
          ? "Backend is waking up — please try again in 30 seconds."
          : "Something went wrong. Please try again.",
      }]);
    } finally {
      setTyping(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <PageShell title="Chat" meta={meta}>
      {/* Member switcher */}
      {/* {members.length > 1 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-[12px] text-gray-400 uppercase tracking-wide font-medium mr-1">FOR</span>
          <button
            onClick={() => setForMember(null)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] transition-colors",
              forMember === null
                ? "border-navy bg-navy text-white font-medium"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            )}>
            All · Family
          </button>
          {members.map(m => (
            <button key={m.id} onClick={() => setForMember(m)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[13px] transition-colors",
                forMember?.id === m.id
                  ? "border-navy bg-navy text-white font-medium"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              )}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: forMember?.id === m.id ? "rgba(255,255,255,0.3)" : "#9CA3AF", color: "white" }}>
                {initials(m.name)}
              </span>
              {m.name}
              <span className={cn("text-[11px]", forMember?.id === m.id ? "text-blue-200" : "text-gray-400")}>
                · {m.isSelf ? "You" : m.relation}
              </span>
            </button>
          ))}
        </div>
      )} */}

      {/* Context pill */}
      {/* {forMember && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[12px] text-gray-500">Chatting about</span>
          <span className="text-[12px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: "#EFF6FF", color: "#1A56A0" }}>
            {forMember.name}&apos;s health data
          </span>
          <button onClick={() => setForMember(null)} className="text-[11px] text-gray-400 hover:text-gray-600">
            Switch
          </button>
        </div>
      )} */}

      {/* Messages */}
      <div className="space-y-4 pb-6">
        {isEmpty ? <StarterPrompts onPick={send} /> : messages.map(m => <Bubble key={m.id} msg={m} />)}
        {typing && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input); }}
        className="sticky bottom-6 bg-gray-50 pt-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={forMember ? `Ask about ${forMember.name}'s data…` : "Ask about your family's data…"}
            className="flex-1 bg-transparent outline-none text-[14px] text-gray-700 placeholder:text-gray-400 py-2"
          />
          <button type="submit" disabled={!input.trim() || typing}
            className="bg-navy text-white rounded-lg w-9 h-9 flex items-center justify-center hover:bg-navy/90 disabled:opacity-40"
            aria-label="Send">
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
            <AlertTriangle size={14} /> Medical query detected
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
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }} />
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
        {starterPrompts.map(p => (
          <button key={p} onClick={() => onPick(p)}
            className="text-[13px] px-3 py-1.5 rounded-full border border-blue/30 bg-blue/[0.06] text-blue hover:bg-blue/[0.1] transition-colors">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
