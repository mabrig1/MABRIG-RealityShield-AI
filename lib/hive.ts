import type { RealityAnalysis, RiskSignal, Verdict } from "./types";

type AnyRecord = Record<string, unknown>;

type ScoredClass = {
  className: string;
  score: number;
};

function collectScoredClasses(value: unknown, out: ScoredClass[] = []): ScoredClass[] {
  if (Array.isArray(value)) {
    for (const item of value) collectScoredClasses(item, out);
    return out;
  }

  if (value && typeof value === "object") {
    const record = value as AnyRecord;
    const className =
      typeof record.class === "string"
        ? record.class
        : typeof record.label === "string"
          ? record.label
          : null;
    const rawScore =
      typeof record.score === "number"
        ? record.score
        : typeof record.confidence === "number"
          ? record.confidence
          : null;

    if (className && rawScore !== null && Number.isFinite(rawScore)) {
      out.push({ className: className.toLowerCase(), score: Math.max(0, Math.min(1, rawScore)) });
    }

    for (const child of Object.values(record)) collectScoredClasses(child, out);
  }

  return out;
}

function containsC2pa(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsC2pa);
  if (!value || typeof value !== "object") return false;

  for (const [key, child] of Object.entries(value as AnyRecord)) {
    if (key.toLowerCase().includes("c2pa")) {
      if (child !== null && child !== "" && !(Array.isArray(child) && child.length === 0)) return true;
    }
    if (containsC2pa(child)) return true;
  }
  return false;
}

const GENERATOR_CLASSES = new Set([
  "sora", "pika", "haiper", "kling", "luma", "hedra", "runway", "hailuo", "mochi",
  "flux", "hallo", "hunyuan", "recraft", "leonardo", "dalle", "adobefirefly",
  "stablediffusion", "stablediffusionxl", "midjourney", "imagen", "ideogram", "veo3",
  "higgsfield", "heygen", "pixverse", "seedance", "seedance2", "gptimage1_5", "meta",
  "gemini", "grok", "other_image_generators"
]);

function maxScore(classes: ScoredClass[], names: Set<string>): number | null {
  const values = classes.filter((item) => names.has(item.className)).map((item) => item.score);
  return values.length ? Math.max(...values) : null;
}

function levelFor(score: number | null): RiskSignal["level"] {
  if (score === null) return "info";
  if (score >= 0.8) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function verdictFor(risk: number | null): Verdict {
  if (risk === null) return "inconclusive";
  if (risk >= 0.9) return "likely_manipulated";
  if (risk >= 0.55) return "suspicious";
  return "low_risk";
}

export function normalizeHiveResponse(payload: unknown, id: string): RealityAnalysis {
  const classes = collectScoredClasses(payload);
  const aiGeneratedRisk = maxScore(classes, new Set(["ai_generated"]));
  const deepfakeRisk = maxScore(classes, new Set(["deepfake"]));
  const manipulationRisk =
    aiGeneratedRisk === null && deepfakeRisk === null
      ? null
      : Math.max(aiGeneratedRisk ?? 0, deepfakeRisk ?? 0);

  const sourceCandidates = classes
    .filter((item) => GENERATOR_CLASSES.has(item.className))
    .sort((a, b) => b.score - a.score);
  const sourceModel =
    sourceCandidates.length && sourceCandidates[0].score >= 0.35
      ? sourceCandidates[0].className
      : null;

  const c2pa = containsC2pa(payload);
  const verdict = verdictFor(manipulationRisk);
  const realityScore = manipulationRisk === null ? null : Math.round((1 - manipulationRisk) * 100);

  const signals: RiskSignal[] = [
    {
      label: "AI-generated media",
      score: aiGeneratedRisk,
      level: levelFor(aiGeneratedRisk),
      detail:
        aiGeneratedRisk === null
          ? "The provider response did not expose an AI-generation score."
          : "Probability signal returned by the configured forensic provider.",
    },
    {
      label: "Deepfake / face manipulation",
      score: deepfakeRisk,
      level: levelFor(deepfakeRisk),
      detail:
        deepfakeRisk === null
          ? "No deepfake score was observed in this response."
          : "Highest observed deepfake confidence in the provider response.",
    },
    {
      label: "Content provenance",
      score: null,
      level: c2pa ? "info" : "medium",
      detail: c2pa
        ? "C2PA-related metadata was present. Presence alone does not prove the media is truthful."
        : "No C2PA-related credential was observed in the provider response. Absence does not mean the media is fake.",
    },
  ];

  let recommendation =
    "Treat this result as one signal. Verify the source, context, and identity through an independent channel before taking consequential action.";
  if (verdict === "likely_manipulated") {
    recommendation =
      "High manipulation risk detected. Do not send money, disclose credentials, or act on identity claims until you independently verify the source.";
  } else if (verdict === "suspicious") {
    recommendation =
      "Suspicious signals detected. Pause before sharing or acting and verify the media through another trusted source.";
  } else if (verdict === "low_risk") {
    recommendation =
      "No strong manipulation signal was detected, but this is not proof of authenticity. Continue provenance and context checks for high-stakes decisions.";
  }

  return {
    id,
    verdict,
    realityScore,
    manipulationRisk,
    aiGeneratedRisk,
    deepfakeRisk,
    sourceModel,
    provenance: {
      status: c2pa ? "credential_present" : "not_observed",
      summary: c2pa
        ? "A C2PA-related provenance signal was observed."
        : "No C2PA-related provenance signal was observed.",
    },
    provider: "hive",
    signals,
    recommendation,
    caveat:
      "Automated deepfake detection is probabilistic and can produce false positives and false negatives, especially after screen recapture, compression, cropping, filters, or re-encoding.",
  };
}
