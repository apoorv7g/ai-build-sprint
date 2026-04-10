"use client";

import React from "react";
import { ClaimResult, AgentWorkflowStep } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface ClaimResultCardProps {
  result: ClaimResult;
  compact?: boolean;
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "Approved"
      ? "success"
      : status === "Rejected"
      ? "destructive"
      : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function ConfidenceBar({
  score,
  breakdown,
}: {
  score: number;
  breakdown?: Array<{ label: string; delta: number }>;
}) {
  const color =
    score >= 0.8
      ? "bg-green-500"
      : score >= 0.6
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span>Confidence</span>
        <span className="font-medium">{(score * 100).toFixed(0)}%</span>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Progress value={score * 100} indicatorClassName={color} />
            </div>
          </TooltipTrigger>
          {breakdown && breakdown.length > 0 && (
            <TooltipContent>
              <div className="space-y-1">
                {breakdown.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span>{f.label}</span>
                    <span className="text-red-600">{f.delta.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function PayoutTable({ result }: { result: ClaimResult }) {
  const { payoutBreakdown } = result;
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        <tr className="border-b">
          <td className="py-1 text-gray-600">Claim Amount</td>
          <td className="py-1 text-right font-medium">{formatCurrency(payoutBreakdown.claimAmount)}</td>
        </tr>
        <tr className="border-b">
          <td className="py-1 text-gray-600">× Payout %</td>
          <td className="py-1 text-right font-medium">{payoutBreakdown.payoutPercentage}%</td>
        </tr>
        <tr className="border-b">
          <td className="py-1 text-gray-600">Gross Payout</td>
          <td className="py-1 text-right font-medium">{formatCurrency(payoutBreakdown.grossPayout)}</td>
        </tr>
        <tr className="border-b">
          <td className="py-1 text-gray-600">− Deductible</td>
          <td className="py-1 text-right font-medium text-red-600">
            −{formatCurrency(payoutBreakdown.deductible)}
          </td>
        </tr>
        <tr className="border-t-2">
          <td className="py-1 font-bold">Final Payout</td>
          <td className="py-1 text-right font-bold text-green-700">
            {formatCurrency(payoutBreakdown.netPayout)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function AgentLogsTable({ steps }: { steps: AgentWorkflowStep[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Step</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Tokens</TableHead>
          <TableHead>Latency</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {steps.map((step) => (
          <TableRow key={step.stepNumber}>
            <TableCell>{step.stepNumber}</TableCell>
            <TableCell className="font-medium">{step.agentName}</TableCell>
            <TableCell className="text-xs">
              {step.modelUsed?.includes("llama-4") ? "llama-4-scout" : "llama-3.3-70b"}
            </TableCell>
            <TableCell>#{step.groqKeySlot + 1}</TableCell>
            <TableCell>{step.tokensUsed}</TableCell>
            <TableCell>{step.latencyMs}ms</TableCell>
            <TableCell>
              <Badge
                variant={
                  step.status === "completed"
                    ? "success"
                    : step.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
              >
                {step.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ClaimResultCard({ result, compact = false }: ClaimResultCardProps) {
  return (
    <div className="border border-border/60 rounded-xl p-4 space-y-4 bg-card/90 shadow-lg shadow-slate-900/5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-lg">Claim {result.claimId}</h3>
          <p className="text-xs text-muted-foreground">{result.processingTimeMs}ms total</p>
        </div>
        <StatusBadge status={result.status} />
      </div>

      <div className="text-center py-2">
        {result.estimatedPayout > 0 ? (
          <div className="text-3xl font-bold text-green-700">
            {formatCurrency(result.estimatedPayout)}
          </div>
        ) : (
          <div className="text-xl font-bold text-gray-400">₹0 — Not covered</div>
        )}
      </div>

      <ConfidenceBar score={result.confidenceScore} breakdown={result.confidenceBreakdown} />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Damage:</span>
        <Badge variant="secondary">{result.damageType}</Badge>
        <Badge variant="secondary">Fraud: {result.fraudRisk}</Badge>
        <Badge variant="secondary">Key #{result.groqKeySlotUsed + 1}</Badge>
      </div>

      {result.fraudFlags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.fraudFlags.map((flag, i) => (
            <Badge key={i} variant="destructive" className="text-xs">
              {flag}
            </Badge>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground leading-relaxed">{result.reason}</p>

      {!compact && (
        <>
          <PayoutTable result={result} />

          <div className="flex gap-2 flex-wrap">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  View Customer Letter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{result.customerMessageSubject}</DialogTitle>
                </DialogHeader>
                <div className="text-sm whitespace-pre-wrap leading-relaxed bg-secondary/60 p-4 rounded-lg">
                  {result.customerMessage}
                </div>
              </DialogContent>
            </Dialog>

            {result.agentWorkflow.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View Agent Logs
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Agent Logs — Claim {result.claimId}</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[420px]">
                    <AgentLogsTable steps={result.agentWorkflow} />
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </>
      )}
    </div>
  );
}
