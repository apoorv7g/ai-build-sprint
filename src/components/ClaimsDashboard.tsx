"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ClaimResultCard } from "./ClaimResultCard";
import { ClaimResult } from "@/types";

interface ClaimRow {
  claim_id: string;
  description: string;
  policy_type: string;
  claim_amount: number;
  submitted_at: string;
  status?: string;
  estimated_payout?: number;
  confidence_score?: string;
  damage_type?: string;
  payout_percentage?: number;
  groq_key_slot?: number;
  processing_time_ms?: number;
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="secondary">Processing</Badge>;
  const variant =
    status === "Approved" ? "success" : status === "Rejected" ? "destructive" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

export function ClaimsDashboard() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimResult | null>(null);
  const [total, setTotal] = useState(0);

  const fetchClaims = async (status?: string) => {
    setLoading(true);
    try {
      const url =
        status && status !== "All"
          ? `/api/claims?status=${status}`
          : "/api/claims";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setClaims(data.data || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims(filter);
  }, [filter]);

  const handleRowClick = async (claimId: string) => {
    try {
      const [claimRes, logsRes] = await Promise.all([
        fetch(`/api/claims/${claimId}`),
        fetch(`/api/claims/${claimId}/logs`),
      ]);
      if (!claimRes.ok) return;
      const claimData = await claimRes.json();
      const logsData = logsRes.ok ? await logsRes.json() : { logs: [] };

      const result: ClaimResult = {
        claimId: claimData.claim?.claim_id || claimId,
        status: claimData.result?.status || "Pending",
        estimatedPayout: claimData.result?.estimated_payout || 0,
        payoutBreakdown: {
          claimAmount: claimData.claim?.claim_amount || 0,
          payoutPercentage: claimData.result?.payout_percentage || 0,
          grossPayout: Math.round(
            (claimData.claim?.claim_amount || 0) *
              ((claimData.result?.payout_percentage || 0) / 100)
          ),
          deductible: 3000,
          netPayout: claimData.result?.estimated_payout || 0,
        },
        confidenceScore: parseFloat(claimData.result?.confidence_score || "0"),
        damageType: claimData.result?.damage_type || "Unknown",
        fraudRisk: "Unknown",
        fraudFlags: claimData.result?.fraud_flags || [],
        coverageValid: claimData.result?.coverage_valid ?? true,
        reason: claimData.result?.reason || "",
        customerMessage: claimData.result?.customer_message || "",
        customerMessageSubject: "",
        groqKeySlotUsed: claimData.result?.groq_key_slot || 0,
        agentWorkflow: (logsData.logs || []).map((log: Record<string, unknown>) => ({
          stepNumber: log.step_number,
          agentName: log.agent_name,
          modelUsed: log.model_used,
          groqKeySlot: log.groq_key_slot,
          status: log.status,
          latencyMs: log.latency_ms,
          tokensUsed: log.tokens_used,
        })),
        processingTimeMs: claimData.result?.processing_time_ms || 0,
      };
      setSelectedClaim(result);
    } catch {}
  };

  const filters = ["All", "Approved", "Rejected", "Pending"];

  return (
    <div className="mt-2 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-semibold">Claims Dashboard</h2>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-secondary/70">
            {filters.map((f) => (
              <TabsTrigger key={f} value={f} className="text-xs">
                {f}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card/70 p-4 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-border/60 rounded-xl bg-card/60">
          No claims found. Submit a claim to get started.
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-hidden bg-card/70">
          <ScrollArea className="max-h-[420px]">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Damage</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <Dialog key={claim.claim_id}>
                  <DialogTrigger asChild>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => handleRowClick(claim.claim_id)}
                    >
                      <TableCell className="font-medium">{claim.claim_id}</TableCell>
                      <TableCell>{claim.policy_type}</TableCell>
                      <TableCell>₹{claim.claim_amount?.toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <StatusBadge status={claim.status} />
                      </TableCell>
                      <TableCell>
                        ₹{(claim.estimated_payout || 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        {claim.confidence_score
                          ? `${(parseFloat(claim.confidence_score) * 100).toFixed(0)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>{claim.damage_type || "—"}</TableCell>
                      <TableCell>
                        {claim.groq_key_slot !== undefined ? `#${claim.groq_key_slot + 1}` : "—"}
                      </TableCell>
                      <TableCell>
                        {claim.processing_time_ms
                          ? `${claim.processing_time_ms}ms`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  </DialogTrigger>
                  {selectedClaim?.claimId === claim.claim_id && (
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Claim {claim.claim_id} Details</DialogTitle>
                      </DialogHeader>
                      <ClaimResultCard result={selectedClaim} />
                    </DialogContent>
                  )}
                </Dialog>
              ))}
            </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      <div className="text-xs text-muted-foreground text-right">
        Total: {total} claim{total !== 1 ? "s" : ""}
        <button
          onClick={() => fetchClaims(filter)}
          className="ml-3 text-primary hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
