export type Verdict = "verified" | "low_risk" | "suspicious" | "likely_manipulated" | "inconclusive";

export type RiskSignal = {
  label: string;
  score: number | null;
  level: "low" | "medium" | "high" | "info";
  detail: string;
};

export type ProvenanceSignal = {
  status: "credential_present" | "not_observed" | "unknown";
  summary: string;
};

export type RealityAnalysis = {
  id: string;
  verdict: Verdict;
  realityScore: number | null;
  manipulationRisk: number | null;
  aiGeneratedRisk: number | null;
  deepfakeRisk: number | null;
  sourceModel: string | null;
  provenance: ProvenanceSignal;
  provider: "hive" | "local-preflight";
  signals: RiskSignal[];
  recommendation: string;
  sha256?: string;
  caveat: string;
};
