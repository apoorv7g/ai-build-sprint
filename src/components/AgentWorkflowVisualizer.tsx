"use client";

import React from "react";
import { AgentWorkflowStep } from "@/types";

interface AgentWorkflowVisualizerProps {
  claimId: string;
  steps?: AgentWorkflowStep[];
  isPolling?: boolean;
}

const AGENT_LABELS: Record<number, string> = {
  2: "Claim Analysis",
  3: "Coverage + Fraud Check",
  4: "Damage Assessment",
  5: "Payout Estimation",
  6: "Customer Message",
};

function StepNode({
  step,
  isSkipped,
  isWaiting,
}: {
  step?: AgentWorkflowStep;
  stepNumber: number;
  label: string;
  isSkipped?: boolean;
  isWaiting?: boolean;
}) {
  const status = step?.status || (isWaiting ? "waiting" : "waiting");

  const bgColor =
    isSkipped
      ? "bg-gray-100 border-dashed border-gray-300 text-gray-400"
      : status === "waiting"
      ? "bg-gray-100 border-gray-300 text-gray-500"
      : status === "running"
      ? "bg-blue-50 border-blue-400 text-blue-700 animate-pulse"
      : status === "completed"
      ? "bg-green-50 border-green-400 text-green-700"
      : status === "failed"
      ? "bg-red-50 border-red-400 text-red-700"
      : "bg-gray-100 border-gray-300 text-gray-500";

  const icon =
    isSkipped
      ? "—"
      : status === "waiting"
      ? "○"
      : status === "running"
      ? "●"
      : status === "completed"
      ? "✓"
      : status === "failed"
      ? "✗"
      : "○";

  return (
    <div
      className={`border-2 rounded-lg p-3 text-sm w-full ${bgColor}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{step ? AGENT_LABELS[step.stepNumber] : "Waiting..."}</div>
          {step && step.status === "completed" && (
            <div className="text-xs mt-1 space-y-0.5 text-gray-500">
              <div className="truncate">
                Model: {step.modelUsed?.includes("llama-4") ? "llama-4-scout" : "llama-3.3-70b"}
              </div>
              <div className="flex gap-2">
                <span>Key #{step.groqKeySlot + 1}</span>
                <span>{step.latencyMs}ms</span>
                <span>{step.tokensUsed} tokens</span>
              </div>
              {step.modelUsed?.includes("llama-4") && (
                <span className="inline-block bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">
                  Vision Model
                </span>
              )}
            </div>
          )}
          {step && step.status === "failed" && (
            <div className="text-xs text-red-500 mt-1">Failed</div>
          )}
          {isSkipped && <div className="text-xs mt-1">Skipped (short-circuit)</div>}
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center py-1">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2 L10 15 M6 12 L10 16 L14 12" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function DecisionDiamond({ valid }: { valid?: boolean | null }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="relative w-24 h-12 flex items-center justify-center">
        <svg viewBox="0 0 96 48" className="absolute inset-0 w-full h-full">
          <polygon
            points="48,4 92,24 48,44 4,24"
            fill={valid === true ? "#dcfce7" : valid === false ? "#fef2f2" : "#f9fafb"}
            stroke={valid === true ? "#16a34a" : valid === false ? "#dc2626" : "#9ca3af"}
            strokeWidth="2"
          />
        </svg>
        <span className="relative z-10 text-xs font-medium text-gray-700 text-center leading-tight px-2">
          Valid?
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
        <span className="text-green-600">YES ↓</span>
        <span className="text-red-600">NO →</span>
      </div>
    </div>
  );
}

export function AgentWorkflowVisualizer({
  claimId,
  steps = [],
  isPolling = false,
}: AgentWorkflowVisualizerProps) {
  const stepMap: Record<number, AgentWorkflowStep> = {};
  for (const step of steps) {
    stepMap[step.stepNumber] = step;
  }

  const allDone = steps.length > 0 && steps.every((s) => s.status === "completed" || s.status === "failed" || s.status === "skipped");

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="text-xs text-center text-gray-500 mb-2 font-medium">
        Claim {claimId} — Agent Pipeline
        {isPolling && !allDone && (
          <span className="ml-2 inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        )}
      </div>

      <div className="flex flex-col items-stretch gap-0">
        {/* Step 2 */}
        <StepNode
          step={stepMap[2]}
          stepNumber={2}
          label="Claim Analysis"
          isWaiting={!stepMap[2]}
        />
        <Arrow />

        {/* Step 3 */}
        <StepNode
          step={stepMap[3]}
          stepNumber={3}
          label="Coverage + Fraud Check"
          isWaiting={!stepMap[3]}
        />

        <DecisionDiamond valid={stepMap[3]?.outputSummary?.includes("true") ? true : undefined} />

        {/* Steps 4 & 5 — skipped if early rejection */}
        <StepNode
          step={stepMap[4]}
          stepNumber={4}
          label="Damage Assessment"
          isSkipped={!stepMap[4] && allDone}
          isWaiting={!stepMap[4] && !allDone}
        />
        <Arrow />

        <StepNode
          step={stepMap[5]}
          stepNumber={5}
          label="Payout Estimation"
          isSkipped={!stepMap[5] && allDone}
          isWaiting={!stepMap[5] && !allDone}
        />
        <Arrow />

        {/* Step 6 */}
        <StepNode
          step={stepMap[6]}
          stepNumber={6}
          label="Customer Message"
          isWaiting={!stepMap[6]}
        />
      </div>

      {allDone && (
        <div className="mt-3 text-center">
          <span className="text-xs text-green-600 font-medium">✓ Pipeline Complete</span>
        </div>
      )}
    </div>
  );
}
