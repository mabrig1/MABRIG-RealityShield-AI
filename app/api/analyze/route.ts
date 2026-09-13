import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeHiveResponse } from "../../../lib/hive";
import type { RealityAnalysis } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function maxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

function localPreflight(file: File | null, url: string | null, id: string, sha256?: string): RealityAnalysis {
  const signals = [
    {
      label: "Forensic provider",
      score: null,
      level: "info" as const,
      detail: "No HIVE_API_KEY is configured, so no model-backed deepfake claim has been made.",
    },
    {
      label: "Media intake",
      score: null,
      level: "info" as const,
      detail: file
        ? `Received ${file.type || "unknown MIME type"} media (${Math.round(file.size / 1024)} KB).`
        : `Received public media URL: ${url ? "yes" : "no"}.`,
    },
  ];

  if (sha256) {
    signals.push({
      label: "Evidence fingerprint",
      score: null,
      level: "info" as const,
      detail: `SHA-256: ${sha256}`,
    });
  }

  return {
    id,
    verdict: "inconclusive",
    realityScore: null,
    manipulationRisk: null,
    aiGeneratedRisk: null,
    deepfakeRisk: null,
    sourceModel: null,
    provenance: {
      status: "unknown",
      summary: "Provenance was not checked because no forensic provider is configured.",
    },
    provider: "local-preflight",
    signals,
    recommendation:
      "Configure HIVE_API_KEY on the server to enable model-backed analysis. Until then, verify the media through an independent source before acting.",
    sha256,
    caveat:
      "This preflight intentionally does not invent a fake/real probability. A media hash proves file identity, not authenticity.",
  };
}

export async function POST(request: Request) {
  const id = `RS-${randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const form = await request.formData();
    const mediaEntry = form.get("media");
    const urlEntry = form.get("url");
    const media = mediaEntry instanceof File && mediaEntry.size > 0 ? mediaEntry : null;
    const mediaUrl = typeof urlEntry === "string" && urlEntry.trim() ? urlEntry.trim() : null;

    if (!media && !mediaUrl) {
      return NextResponse.json({ error: "Provide a media file or a public media URL." }, { status: 400 });
    }

    if (media && media.size > maxUploadBytes()) {
      return NextResponse.json(
        {
          error: `File is too large for this MVP route. Maximum is ${Math.round(maxUploadBytes() / 1024 / 1024)} MB. Use a public media URL for larger files.`,
        },
        { status: 413 },
      );
    }

    let sha256: string | undefined;
    if (media) {
      const bytes = Buffer.from(await media.arrayBuffer());
      sha256 = createHash("sha256").update(bytes).digest("hex");
    }

    const apiKey = process.env.HIVE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(localPreflight(media, mediaUrl, id, sha256), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const hiveForm = new FormData();
    if (media) {
      hiveForm.append("media", media, media.name || "realityshield-media");
    } else if (mediaUrl) {
      hiveForm.append("url", mediaUrl);
    }

    const apiUrl = process.env.HIVE_API_URL || "https://api.thehive.ai/api/v2/task/sync";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `token ${apiKey}`,
        Accept: "application/json",
      },
      body: hiveForm,
      cache: "no-store",
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "The configured forensic provider rejected the analysis request.",
          providerStatus: response.status,
          providerMessage:
            payload && typeof payload === "object" && "message" in payload
              ? String((payload as { message?: unknown }).message ?? "")
              : undefined,
        },
        { status: 502 },
      );
    }

    const normalized = normalizeHiveResponse(payload, id);
    normalized.sha256 = sha256;
    return NextResponse.json(normalized, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("RealityShield analysis failed", error);
    return NextResponse.json(
      { error: "Analysis failed unexpectedly. Please try another file or media URL." },
      { status: 500 },
    );
  }
}
