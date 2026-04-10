import { ClaimWorkspaceTabs } from "@/components/ClaimWorkspaceTabs";
import { AuthGate } from "@/components/AuthGate";
import { Suspense } from "react";

export default async function Home() {
  return (
    <div className="min-h-screen pb-10 hard-edge">
      <header className="mesh-band text-slate-50 shadow-xl border-b border-white/15">
        <div className="w-full px-4 md:px-8 py-4 flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/90">Intelligent Claims Workspace</p>
            <h1 className="text-3xl md:text-4xl leading-none">Cache Memory</h1>
          </div>
        </div>
      </header>

      <main className="w-full px-4 md:px-8 py-6">
        <div className="atmo-panel panel-edge p-6 md:p-8 relative overflow-hidden dotted-atmo">
          <div className="grain-overlay pointer-events-none" />
          <div className="relative z-10 mb-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Goal-to-Multi-Agent Orchestrator</p>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Switch tabs to run a single claim, process 3 claims simultaneously, or review full dashboard history.
            </p>
          </div>

          <div className="relative z-10">
            <AuthGate>
              <Suspense
                fallback={
                  <section className="rounded-xl border border-border/60 bg-card/90 p-6 shadow-lg shadow-slate-900/5">
                    <h3 className="text-xl font-semibold">Single Claim</h3>
                    <p className="text-sm text-muted-foreground mt-2">Loading workspace...</p>
                  </section>
                }
              >
                <ClaimWorkspaceTabs />
              </Suspense>
            </AuthGate>
          </div>
        </div>
      </main>
    </div>
  );
}
