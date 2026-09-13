# MABRIG RealityShield AI

**Camera-first authenticity, deepfake, and impersonation defense.**

> Point. Scan. Verify. Protect.

RealityShield is a mobile-first trust layer for suspicious images, short video, captured screens, and public media URLs. It intentionally treats detector output as probabilistic evidence rather than absolute proof.

## MVP features

- **Reality Lens** — open the phone camera, point at another screen, capture a frame, and scan it.
- **Upload & URL analysis** — analyze local media or a public media URL.
- **Model-backed deepfake / AI-generation analysis** — server-side Hive adapter when `HIVE_API_KEY` is configured.
- **Honest fallback** — if no forensic provider is configured, the app returns `Inconclusive` rather than fabricating a score.
- **Evidence fingerprinting** — SHA-256 hash for uploaded/captured media.
- **Provenance signal** — surfaces C2PA-related metadata observed in the provider response.
- **Experimental pixel-anomaly overlay** — local contrast/edge visualization for images. This is explicitly not represented as a deepfake-localization heatmap.
- **Action guidance** — high-risk results tell users to independently verify identity before sending money, credentials, or acting on urgent claims.

## Stack

- Next.js App Router
- React + TypeScript
- Server Route Handler for forensic-provider-calls
- Hive V2 sync adapter
- Browser MediaDevices API for camera capture
- No client-side secret keys

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Enable model-backed detection

Create/configure a Hive model-only project for AI-generated image/video and deepfake detection and add its token:

```bash
HIVE_API_KEY=your_server_side_token
```

Do not expose the key with a `NEXT_PUBLIC_` prefix.

The server submits either the uploaded `media` binary or the public `url` to Hive's V2 synchronous task endpoint and normalizes observed `ai_generated`, `deepfake`, generator-source, and C2PA-related signals into a RealityShield result.

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Add `HIVE_API_KEY` as a server-side Environment Variable.
3. Optionally set `MAX_UPLOAD_BYTES` and `HIVE_API_URL`.
4. Deploy.

For large video in production, use direct object-storage uploads (for example Cloudflare R2) and submit signed media URLs to the forensic provider rather than proxying large files through the Next.js function.

## Detection policy

RealityShield never equates **"no signal detected"** with **"proven authentic"**. Compression, screen recapture, cropping, filters, re-encoding, unseen generation models, and adversarial techniques can reduce detector reliability. C2PA credential presence should also be interpreted as provenance information, not as proof that the media's claim or surrounding caption is true.

## Production roadmap

1. Direct-to-R2 signed uploads and async video jobs.
2. Second independent visual detector and ensemble risk fusion.
3. Dedicated synthetic-audio / voice-clone detector.
4. Native C2PA verification and signer-chain details.
5. Context verification: reverse media search, earliest-source timeline, caption/date/location checks.
6. LiveCall Shield: active liveness challenges and identity verification workflow.
7. WhatsApp/share-sheet intake via Android/iOS wrapper.
8. Signed PDF/JSON forensic evidence reports.
9. Organization policies, analyst review queue, audit trail, and API keys.

## Brand

**MABRIG RealityShield AI** — a MABRIG Technologies product.
