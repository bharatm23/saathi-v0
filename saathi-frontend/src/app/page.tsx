"use client";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";

// TODO: replace with real wearable dashboard iframe URL
const IFRAME_URL = "http://localhost:3000";

export default function DashboardPage() {
  return (
    <PageShell title="Dashboard" meta="Priya · updated 2h ago" wide>
      <Card className="overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        <iframe
          src={IFRAME_URL}
          title="Wearable dashboard"
          className="w-full h-full block"
          sandbox="allow-scripts allow-same-origin"
        />
      </Card>
    </PageShell>
  );
}
