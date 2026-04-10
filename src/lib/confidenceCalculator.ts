interface ConfidenceFactors {
  fraudRisk: string;
  documentsStatus: string;
  imageMatchesDescription: boolean | null;
  pastClaims: number;
  coverageValid: boolean;
}

export interface ConfidenceFactor {
  label: string;
  delta: number;
}

export function calculateConfidence(factors: ConfidenceFactors): {
  score: number;
  breakdown: ConfidenceFactor[];
} {
  let base = 0.85;
  const breakdown: ConfidenceFactor[] = [];

  if (factors.fraudRisk === "High") {
    base = 0.20;
    breakdown.push({ label: "Fraud Risk High", delta: -(0.85 - 0.20) });
  } else if (factors.fraudRisk === "Medium") {
    base -= 0.20;
    breakdown.push({ label: "Fraud Risk Medium", delta: -0.20 });
  }

  if (factors.documentsStatus === "Missing") {
    base -= 0.15;
    breakdown.push({ label: "Missing Documents", delta: -0.15 });
  }

  if (factors.imageMatchesDescription === false) {
    base -= 0.10;
    breakdown.push({ label: "Image-description mismatch", delta: -0.10 });
  }

  if (factors.pastClaims > 3) {
    base -= 0.10;
    breakdown.push({ label: "Past claims > 3", delta: -0.10 });
  } else if (factors.pastClaims >= 1) {
    base -= 0.05;
    breakdown.push({ label: "Past claims 1–3", delta: -0.05 });
  }

  if (factors.coverageValid === false) {
    base = 0.30;
    breakdown.push({ label: "Coverage invalid", delta: -(0.85 - 0.30) });
  }

  // Clamp to [0.10, 0.95]
  const score = Math.min(0.95, Math.max(0.10, base));

  return { score: parseFloat(score.toFixed(2)), breakdown };
}
