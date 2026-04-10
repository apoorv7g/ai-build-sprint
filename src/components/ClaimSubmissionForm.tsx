"use client";

import React, { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { ClaimInput, ClaimResult, AgentWorkflowStep } from "@/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
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

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  try {
    const json = JSON.stringify(value);
    if (json && json !== "{}") return json;
  } catch {}
  return fallback;
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
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [steps, setSteps] = useState<AgentWorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState(0);
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
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDragDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const [header, base64] = dataUrl.split(",");
        const mediaType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
        setImageBase64(base64);
        setImageMediaType(mediaType);
        setImagePreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearImage = () => {
    setImageBase64(undefined);
    setImageMediaType(undefined);
    setImagePreview(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          const done = logs.filter((s) => ["completed", "failed", "skipped"].includes(s.status)).length;
          setCompletion(Math.round((done / 5) * 100));
        }
      } catch {}
    }, 1500);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSteps([]);
    setCompletion(0);

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

      const data: unknown = await res.json();
      const dataError =
        data && typeof data === "object" && "error" in data
          ? (data as { error?: unknown }).error
          : undefined;

      if (!res.ok) {
        setError(getErrorMessage(dataError, "Processing failed"));
        return;
      }

      setResult(data as ClaimResult);
      if (onResult) onResult(data as ClaimResult);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Network error. Please try again."));
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
      {formLabel && <h3 className="font-semibold text-sm text-muted-foreground">{formLabel}</h3>}

      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">You</p>
        <form onSubmit={handleSubmit} className="mt-2 grid gap-3">
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
            <label className={`block mb-2 font-medium ${fieldClass}`}>
              Upload Image (optional)
            </label>
            {!imagePreview ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDragDrop}
                className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg
                    className="w-8 h-8 text-muted-foreground/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium">Drag & drop image here or click to select</p>
                    <p className="text-muted-foreground/70 mt-1">PNG or JPG (max 5MB)</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative rounded-lg border border-border/60 overflow-hidden bg-muted/30 p-3">
                <div className="relative w-full bg-black/10 rounded-md overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-auto max-h-48 object-contain"
                    width={400}
                    height={192}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-emerald-700 font-medium">✓ Image ready for analysis</p>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="text-xs px-3 py-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Submission Error</AlertTitle>
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary/95 hover:bg-primary">
            {loading ? "Running 5-agent pipeline..." : "Submit Claim"}
          </Button>
        </form>
      </div>

      {(loading || steps.length > 0) && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cache Memory Assistant</p>
          <div className="mt-2 space-y-2">
            <div className="text-sm text-muted-foreground">Interpreting intent, validating policy and computing payout decision.</div>
            <Progress value={completion} />
            <div className="text-xs text-muted-foreground">Pipeline completion: {completion}%</div>
          </div>

          <ScrollArea className="max-h-[460px] mt-4 pr-1">
            <AgentWorkflowVisualizer claimId={claimId} steps={steps} isPolling={loading} />
          </ScrollArea>
        </div>
      )}

      {loading && !result && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4 space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {result && !loading && (
        <div className="mt-2 rounded-2xl border border-border/60 bg-card/80 p-3">
          <ClaimResultCard result={result} />
        </div>
      )}
    </div>
  );
}
