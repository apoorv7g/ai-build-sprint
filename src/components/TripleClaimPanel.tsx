"use client";

import React, { useState, useRef, useCallback } from "react";
import { ClaimInput, ClaimResult, AgentWorkflowStep } from "@/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AgentWorkflowVisualizer } from "./AgentWorkflowVisualizer";
import { ClaimResultCard } from "./ClaimResultCard";
import { tripleClaimDefaults } from "@/data/sampleClaims";

interface ClaimFormState {
  claimId: string;
  description: string;
  policyType: "Comprehensive" | "Third-Party";
  claimAmount: string;
  pastClaims: string;
  documentsStatus: "Complete" | "Missing";
  imageBase64?: string;
  imageMediaType?: string;
  imageUrl?: string;
}

function makeDefault(claim: Partial<ClaimInput>): ClaimFormState {
  return {
    claimId: claim.claimId || "",
    description: claim.description || "",
    policyType: (claim.policyType as "Comprehensive" | "Third-Party") || "Comprehensive",
    claimAmount: claim.claimAmount?.toString() || "",
    pastClaims: claim.pastClaims?.toString() || "0",
    documentsStatus: (claim.documentsStatus as "Complete" | "Missing") || "Complete",
    imageUrl: claim.imageUrl,
  };
}

function CompactClaimForm({
  value,
  onChange,
  label,
}: {
  value: ClaimFormState;
  onChange: (v: ClaimFormState) => void;
  label: string;
}) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      onChange({ ...value, imageBase64: base64, imageMediaType: mediaType });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-gray-50">
      <h4 className="font-semibold text-sm text-blue-700">{label}</h4>

      <div>
        <label className="block mb-0.5 font-medium text-xs">Claim ID</label>
        <Input
          value={value.claimId}
          onChange={(e) => onChange({ ...value, claimId: e.target.value })}
          placeholder="C1"
          className="text-xs h-8"
        />
      </div>

      <div>
        <label className="block mb-0.5 font-medium text-xs">Description</label>
        <Textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          rows={2}
          className="text-xs"
        />
      </div>

      <div>
        <label className="block mb-0.5 font-medium text-xs">Policy Type</label>
        <Select
          value={value.policyType}
          onValueChange={(v) =>
            onChange({ ...value, policyType: v as "Comprehensive" | "Third-Party" })
          }
        >
          <SelectTrigger className="text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Comprehensive">Comprehensive</SelectItem>
            <SelectItem value="Third-Party">Third-Party</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block mb-0.5 font-medium text-xs">Amount (₹)</label>
          <Input
            type="number"
            value={value.claimAmount}
            onChange={(e) => onChange({ ...value, claimAmount: e.target.value })}
            className="text-xs h-8"
            min={1}
          />
        </div>
        <div>
          <label className="block mb-0.5 font-medium text-xs">Past Claims</label>
          <Input
            type="number"
            value={value.pastClaims}
            onChange={(e) => onChange({ ...value, pastClaims: e.target.value })}
            className="text-xs h-8"
            min={0}
            max={20}
          />
        </div>
      </div>

      <div>
        <label className="block mb-0.5 font-medium text-xs">Documents</label>
        <Select
          value={value.documentsStatus}
          onValueChange={(v) =>
            onChange({ ...value, documentsStatus: v as "Complete" | "Missing" })
          }
        >
          <SelectTrigger className="text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Complete">Complete</SelectItem>
            <SelectItem value="Missing">Missing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block mb-0.5 font-medium text-xs">Image (optional)</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleImageUpload}
          className="text-xs w-full"
        />
        {value.imageBase64 && (
          <p className="text-xs text-green-600">✓ Image loaded</p>
        )}
      </div>
    </div>
  );
}

export function TripleClaimPanel() {
  const [forms, setForms] = useState<ClaimFormState[]>([
    makeDefault(tripleClaimDefaults[0]),
    makeDefault(tripleClaimDefaults[1]),
    makeDefault(tripleClaimDefaults[2]),
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(ClaimResult | null)[]>([null, null, null]);
  const [stepsPerClaim, setStepsPerClaim] = useState<AgentWorkflowStep[][]>([[], [], []]);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [wallClockMs, setWallClockMs] = useState<number | null>(null);
  const pollRefs = useRef<(ReturnType<typeof setInterval> | null)[]>([null, null, null]);

  const startPollingForClaim = useCallback((claimId: string, index: number) => {
    if (pollRefs.current[index]) clearInterval(pollRefs.current[index]!);
    pollRefs.current[index] = setInterval(async () => {
      try {
        const res = await fetch(`/api/claims/${claimId}/logs`);
        if (res.ok) {
          const data = await res.json();
          const logs: AgentWorkflowStep[] = (data.logs || []).map((log: Record<string, unknown>) => ({
            stepNumber: log.step_number,
            agentName: log.agent_name,
            modelUsed: log.model_used,
            groqKeySlot: log.groq_key_slot,
            status: log.status,
            latencyMs: log.latency_ms,
            tokensUsed: log.tokens_used,
          }));
          setStepsPerClaim((prev) => {
            const updated = [...prev];
            updated[index] = logs;
            return updated;
          });
        }
      } catch {}
    }, 1500);
  }, []);

  const handleProcessAll = async () => {
    setError(null);
    setResults([null, null, null]);
    setStepsPerClaim([[], [], []]);
    setCompletedCount(0);
    setWallClockMs(null);

    // Validate all forms
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      if (!form.claimId.trim()) {
        setError(`Claim ${i + 1}: Claim ID is required`);
        return;
      }
      if (form.description.length < 20) {
        setError(`Claim ${i + 1}: Description must be at least 20 characters`);
        return;
      }
      if (!form.claimAmount || Number(form.claimAmount) <= 0) {
        setError(`Claim ${i + 1}: Enter a valid claim amount`);
        return;
      }
    }

    setLoading(true);
    const wallStart = Date.now();

    // Start polling for each claim
    forms.forEach((form, i) => {
      startPollingForClaim(form.claimId.trim(), i);
    });

    try {
      const claimsPayload: ClaimInput[] = forms.map((form) => ({
        claimId: form.claimId.trim(),
        description: form.description,
        policyType: form.policyType,
        claimAmount: Number(form.claimAmount),
        pastClaims: Number(form.pastClaims),
        documentsStatus: form.documentsStatus,
        imageBase64: form.imageBase64,
        imageMediaType: form.imageMediaType,
        imageUrl: form.imageUrl,
      }));

      const res = await fetch("/api/claims/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claims: claimsPayload }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Batch processing failed");
        return;
      }

      setWallClockMs(Date.now() - wallStart);
      setResults(data.results);
      setCompletedCount(data.results.length);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      // Stop polling
      pollRefs.current.forEach((ref) => {
        if (ref) clearInterval(ref);
      });
      pollRefs.current = [null, null, null];
    }
  };

  const updateForm = (index: number, v: ClaimFormState) => {
    setForms((prev) => {
      const updated = [...prev];
      updated[index] = v;
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forms.map((form, i) => (
          <CompactClaimForm
            key={i}
            value={form}
            onChange={(v) => updateForm(i, v)}
            label={`Claim ${i + 1} — Key #${i + 1}`}
          />
        ))}
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-3">
          <div className="text-blue-600 font-medium text-sm">
            ⟳ Processing 3 claims simultaneously...{" "}
            <span className="text-gray-500">{completedCount}/3 complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
        </div>
      )}

      <Button
        onClick={handleProcessAll}
        disabled={loading}
        className="w-full text-base py-3 h-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⟳</span> Processing All 3 Claims Simultaneously...
          </span>
        ) : (
          "⚡ Process All 3 Claims Now"
        )}
      </Button>

      {/* Agent Workflow Visualizers */}
      {(loading || stepsPerClaim.some((s) => s.length > 0)) && (
        <div>
          <h3 className="font-semibold text-sm text-gray-700 mb-3">Agent Pipelines (Running Simultaneously)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forms.map((form, i) => (
              <AgentWorkflowVisualizer
                key={i}
                claimId={form.claimId}
                steps={stepsPerClaim[i]}
                isPolling={loading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.some((r) => r !== null) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-700">Results</h3>
            {wallClockMs && (
              <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                ✓ All 3 completed in {wallClockMs.toLocaleString()}ms (simultaneous)
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.map((result, i) =>
              result ? (
                <ClaimResultCard key={i} result={result} compact={false} />
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
