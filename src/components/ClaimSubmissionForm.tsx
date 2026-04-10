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

interface ClaimSubmissionFormProps {
  onResult?: (result: ClaimResult) => void;
  compact?: boolean;
  defaultValues?: Partial<ClaimInput>;
  formLabel?: string;
}

export function ClaimSubmissionForm({
  onResult,
  compact = false,
  defaultValues,
  formLabel,
}: ClaimSubmissionFormProps) {
  const [claimId, setClaimId] = useState(defaultValues?.claimId || "");
  const [description, setDescription] = useState(defaultValues?.description || "");
  const [policyType, setPolicyType] = useState<"Comprehensive" | "Third-Party">(
    (defaultValues?.policyType as "Comprehensive" | "Third-Party") || "Comprehensive"
  );
  const [claimAmount, setClaimAmount] = useState(
    defaultValues?.claimAmount?.toString() || ""
  );
  const [pastClaims, setPastClaims] = useState(
    defaultValues?.pastClaims?.toString() || "0"
  );
  const [documentsStatus, setDocumentsStatus] = useState<"Complete" | "Missing">(
    (defaultValues?.documentsStatus as "Complete" | "Missing") || "Complete"
  );
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMediaType, setImageMediaType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [steps, setSteps] = useState<AgentWorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      setImageBase64(base64);
      setImageMediaType(mediaType);
    };
    reader.readAsDataURL(file);
  };

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/claims/${id}/logs`);
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
            inputSummary: log.input_summary,
            outputSummary: log.output_summary,
          }));
          setSteps(logs);
        }
      } catch {}
    }, 1500);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSteps([]);

    if (!claimId.trim()) {
      setError("Claim ID is required");
      return;
    }
    if (description.length < 20) {
      setError("Description must be at least 20 characters");
      return;
    }
    if (!claimAmount || Number(claimAmount) <= 0) {
      setError("Enter a valid claim amount");
      return;
    }

    setLoading(true);
    startPolling(claimId.trim());

    try {
      const res = await fetch("/api/claims/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: claimId.trim(),
          description,
          policyType,
          claimAmount: Number(claimAmount),
          pastClaims: Number(pastClaims),
          documentsStatus,
          imageBase64,
          imageMediaType,
          imageUrl: defaultValues?.imageUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Processing failed");
        return;
      }

      setResult(data);
      if (onResult) onResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  };

  const fieldClass = compact ? "text-xs" : "text-sm";

  return (
    <div className="space-y-4">
      {formLabel && <h3 className="font-semibold text-sm text-gray-700">{formLabel}</h3>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>Claim ID</label>
          <Input
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="e.g. C1"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>Incident Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the incident (min. 20 chars)"
            rows={compact ? 2 : 3}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>Policy Type</label>
          <Select
            value={policyType}
            onValueChange={(v) => setPolicyType(v as "Comprehensive" | "Third-Party")}
          >
            <SelectTrigger className={fieldClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Comprehensive">Comprehensive</SelectItem>
              <SelectItem value="Third-Party">Third-Party</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>Claim Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
            <Input
              type="number"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              className={`pl-7 ${fieldClass}`}
              placeholder="25000"
              min={1}
              required
            />
          </div>
        </div>

        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>Past Claims</label>
          <Input
            type="number"
            value={pastClaims}
            onChange={(e) => setPastClaims(e.target.value)}
            min={0}
            max={20}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>Documents Status</label>
          <Select
            value={documentsStatus}
            onValueChange={(v) => setDocumentsStatus(v as "Complete" | "Missing")}
          >
            <SelectTrigger className={fieldClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Complete">Complete</SelectItem>
              <SelectItem value="Missing">Missing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className={`block mb-1 font-medium ${fieldClass}`}>
            Upload Image (optional)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageUpload}
            className="text-xs w-full"
          />
          {imageBase64 && (
            <p className="text-xs text-green-600 mt-1">✓ Image ready for vision analysis</p>
          )}
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⟳</span> Processing...
            </span>
          ) : (
            "Submit Claim"
          )}
        </Button>
      </form>

      {(loading || steps.length > 0) && (
        <div className="mt-4">
          <AgentWorkflowVisualizer
            claimId={claimId}
            steps={steps}
            isPolling={loading}
          />
        </div>
      )}

      {result && !loading && (
        <div className="mt-4">
          <ClaimResultCard result={result} />
        </div>
      )}
    </div>
  );
}
