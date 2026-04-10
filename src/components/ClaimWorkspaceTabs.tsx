"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClaimSubmissionForm } from "@/components/ClaimSubmissionForm";
import { TripleClaimPanel } from "@/components/TripleClaimPanel";
import { ClaimsDashboard } from "@/components/ClaimsDashboard";

type ViewTab = "single" | "multi" | "dashboard";

const viewMeta: Record<ViewTab, { title: string; description: string; tabLabel: string }> = {
  single: {
    title: "Single Claim",
    description: "Run one claim through the complete 5-agent orchestration pipeline.",
    tabLabel: "Single Claim",
  },
  multi: {
    title: "Process 3 Claims",
    description: "Process 3 claims simultaneously with slot-based key isolation.",
    tabLabel: "Process 3 Claims",
  },
  dashboard: {
    title: "Dashboard",
    description: "Review processed claims, outcomes, payout, and confidence.",
    tabLabel: "Dashboard",
  },
};

function parseView(value: string | null): ViewTab {
  if (value === "single" || value === "multi" || value === "dashboard") return value;
  return "single";
}

function getViewFromUrl(): ViewTab {
  if (typeof window === "undefined") return "single";
  const params = new URLSearchParams(window.location.search);
  return parseView(params.get("view"));
}

export function ClaimWorkspaceTabs() {
  const [activeTab, setActiveTab] = useState<ViewTab>(getViewFromUrl);

  const meta = useMemo(() => viewMeta[activeTab], [activeTab]);

  useEffect(() => {
    document.title = `ClaimIQ - ${meta.title}`;
  }, [meta.title]);

  useEffect(() => {
    const onPopState = () => {
      setActiveTab(getViewFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const onTabChange = (value: string) => {
    const next = parseView(value);
    setActiveTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <div className="mb-5">
        <h2 className="manifesto-heading text-4xl md:text-5xl leading-[0.95]">{meta.title}</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
      </div>

      <TabsList className="w-full max-w-2xl mb-6 bg-secondary/70">
        <TabsTrigger value="single" className="flex-1 uppercase tracking-[0.08em] text-xs md:text-sm">
          {viewMeta.single.tabLabel}
        </TabsTrigger>
        <TabsTrigger value="multi" className="flex-1 uppercase tracking-[0.08em] text-xs md:text-sm">
          {viewMeta.multi.tabLabel}
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="flex-1 uppercase tracking-[0.08em] text-xs md:text-sm">
          {viewMeta.dashboard.tabLabel}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single">
        <section className="rounded-xl border border-border/60 bg-card/90 p-6 shadow-lg shadow-slate-900/5 lift-hover">
          <ClaimSubmissionForm />
        </section>
      </TabsContent>

      <TabsContent value="multi">
        <section className="rounded-xl border border-border/60 bg-card/90 p-6 shadow-lg shadow-slate-900/5 lift-hover">
          <TripleClaimPanel />
        </section>
      </TabsContent>

      <TabsContent value="dashboard">
        <section className="rounded-xl border border-border/60 bg-card/90 p-6 shadow-lg shadow-slate-900/5 lift-hover">
          <ClaimsDashboard />
        </section>
      </TabsContent>
    </Tabs>
  );
}
