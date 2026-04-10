export interface ClaimInput {
  claimId: string;
  description: string;
  policyType: "Comprehensive" | "Third-Party";
  claimAmount: number;
  pastClaims: number;
  documentsStatus: "Complete" | "Missing";
  imageUrl?: string;
  imageBase64?: string;
  imageMediaType?: string;
}

export interface AgentWorkflowStep {
  stepNumber: number;
  agentName: string;
  modelUsed: string;
  groqKeySlot: number;
  status: "waiting" | "running" | "completed" | "failed" | "skipped";
  latencyMs: number;
  tokensUsed: number;
  inputSummary?: string;
  outputSummary?: string;
}

export interface PayoutBreakdown {
  claimAmount: number;
  payoutPercentage: number;
  grossPayout: number;
  deductible: number;
  netPayout: number;
}

export interface ClaimResult {
  claimId: string;
  status: "Approved" | "Rejected" | "Pending";
  estimatedPayout: number;
  payoutBreakdown: PayoutBreakdown;
  confidenceScore: number;
  confidenceBreakdown?: Array<{ label: string; delta: number }>;
  damageType: string;
  fraudRisk: string;
  fraudFlags: string[];
  coverageValid: boolean;
  reason: string;
  customerMessage: string;
  customerMessageSubject: string;
  groqKeySlotUsed: number;
  agentWorkflow: AgentWorkflowStep[];
  processingTimeMs: number;
  error?: string;
}

export interface BatchResult {
  results: ClaimResult[];
  batchProcessingTimeMs: number;
}

// Agent output types
export interface ClaimAnalysisOutput {
  incidentType: string;
  affectedComponent: string;
  initialDamageSeverity: "Minor" | "Moderate" | "Major";
  linguisticFlags: string[];
  summaryForDownstreamAgents: string;
  reasoning: string;
}

export interface CoverageAndFraudOutput {
  coverageValid: boolean;
  coverageReason: string;
  documentIssue: string;
  fraudRisk: "None" | "Low" | "Medium" | "High";
  fraudFlags: string[];
  fraudScore: number;
  recommendation: string;
  reasoning: string;
}

export interface DamageAssessmentOutput {
  finalDamageType: "Minor" | "Moderate" | "Major";
  imageMatchesDescription: boolean;
  imageAnalysisSummary: string;
  confidenceFromImage: number;
  reasoning: string;
}

export interface PayoutEstimationOutput {
  status: "Approved" | "Rejected" | "Pending";
  payoutPercentage: number;
  grossPayout: number;
  deductibleApplied: number;
  estimatedPayout: number;
  justification: string;
  reasoning: string;
}

export interface CustomerCommunicationOutput {
  subject: string;
  customerMessage: string;
}
