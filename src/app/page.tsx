import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GroqKeyStatusBar } from "@/components/GroqKeyStatusBar";
import { ClaimSubmissionForm } from "@/components/ClaimSubmissionForm";
import { TripleClaimPanel } from "@/components/TripleClaimPanel";
import { ClaimsDashboard } from "@/components/ClaimsDashboard";
import { db } from "@/db";
import { claims } from "@/db/schema";
import { sql } from "drizzle-orm";

async function getTotalClaims(): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(claims);
    return Number(result[0]?.count || 0);
  } catch {
    return 0;
  }
}

export default async function Home() {
  const totalClaims = await getTotalClaims();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">
              🧠 ClaimIQ
            </span>
            <span className="text-blue-200 text-sm">Multi-Agent Orchestrator</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <GroqKeyStatusBar />
            <Badge className="bg-blue-700 text-white border-blue-600 hover:bg-blue-700">
              Powered by Groq + LLaMA
            </Badge>
            <Badge className="bg-indigo-700 text-white border-indigo-600 hover:bg-indigo-700">
              {totalClaims} claim{totalClaims !== 1 ? "s" : ""} processed
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="mb-6 w-full max-w-md">
            <TabsTrigger value="single" className="flex-1">
              Single Claim
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex-1">
              ⚡ Process 3 Simultaneously
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <div className="max-w-xl">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Submit a Single Claim</h2>
                <p className="text-sm text-gray-500">
                  Process one insurance claim through the 5-agent AI pipeline
                </p>
              </div>
              <div className="bg-white rounded-lg border p-6 shadow-sm">
                <ClaimSubmissionForm />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="batch">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Process 3 Claims Simultaneously</h2>
              <p className="text-sm text-gray-500">
                Each claim runs its own dedicated 5-agent pipeline with a separate Groq API key (key rotation)
              </p>
            </div>
            <div className="bg-white rounded-lg border p-6 shadow-sm">
              <TripleClaimPanel />
            </div>
          </TabsContent>
        </Tabs>

        {/* Historical Claims Dashboard */}
        <div className="bg-white rounded-lg border p-6 shadow-sm mt-6">
          <ClaimsDashboard />
        </div>
      </main>
    </div>
  );
}
