"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { RealityAnalysis } from "../lib/types";

type Mode = "camera" | "upload" | "url";

function pct(value: number | null) {
  return value === null ? "—" : Math.round(value * 100) + "%";
}

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("camera");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState<RealityAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError("Camera unavailable. Upload a file or use a public media URL instead.");
    }
  }

  function chooseFile(next: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setUrl("");
    setPreview(URL.createObjectURL(next));
    setResult(null);
    setError("");
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (blob) chooseFile(new File([blob], "realityshield-capture.jpg", { type: "image/jpeg" }));
    stopCamera();
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (next) chooseFile(next);
  }

  async function analyze() {
    if (!file && !url.trim()) {
      setError("Capture, upload, or link media before scanning.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      if (file) form.append("media", file);
      else form.append("url", url.trim());
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data as RealityAnalysis);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  const verdict =
    result?.verdict === "likely_manipulated" ? "HIGH MANIPULATION RISK" :
    result?.verdict === "suspicious" ? "SUSPICIOUS" :
    result?.verdict === "low_risk" ? "LOW DETECTED RISK" :
    result?.verdict === "verified" ? "VERIFIED PROVENANCE" :
    "INCONCLUSIVE";

  return (
    <main>
      <nav className="nav shell">
        <div className="brand"><b>R</b><span><strong>MABRIG</strong><small>REALITYSHIELD AI</small></span></div>
        <span className="engine"><i /> TRUST ENGINE • MVP</span>
      </nav>

      <section className="hero shell">
        <div className="copy">
          <p className="kicker">CAMERA-FIRST AUTHENTICITY DEFENSE</p>
          <h1>Know what&apos;s real <em>before you act.</em></h1>
          <p className="lead">Scan suspicious images, video, captured screens or public media links. RealityShield combines forensic AI signals, provenance clues and practical fraud-safety guidance.</p>
          <div className="chips"><span>Deepfake risk</span><span>AI-generation</span><span>Provenance</span><span>Evidence hash</span></div>
        </div>

        <div className="scanner">
          <div className="tabs">
            {(["camera","upload","url"] as Mode[]).map((item) => (
              <button key={item} className={mode === item ? "active" : ""} onClick={() => { setMode(item); setResult(null); if (item !== "camera") stopCamera(); }}>
                {item === "url" ? "Public URL" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          <div className="viewport">
            <span className="corner a" /><span className="corner b" /><span className="corner c" /><span className="corner d" />
            {mode === "camera" && !cameraOn && !preview && (
              <div className="empty"><div className="lens">◎</div><h2>Reality Lens</h2><p>Point your phone at another screen, image or suspicious video.</p><button className="primary" onClick={startCamera}>Open camera</button></div>
            )}
            {mode === "camera" && cameraOn && <><video ref={videoRef} muted playsInline className="media" /><div className="scanline" /><span className="live">● LIVE CAMERA</span></>}
            {mode === "upload" && !preview && (
              <label className="empty drop"><div className="lens">↑</div><h2>Upload suspicious media</h2><p>Choose an image, short video or audio clip.</p><input hidden type="file" accept="image/*,video/*,audio/*" onChange={onFile} /><span className="secondary">Choose file</span></label>
            )}
            {mode === "url" && (
              <div className="empty"><div className="lens">↗</div><h2>Analyze a public media link</h2><p>Useful for larger media already hosted online.</p><input className="url" type="url" value={url} placeholder="https://example.com/video.mp4" onChange={(e) => { setUrl(e.target.value); setFile(null); setPreview(""); }} /></div>
            )}
            {preview && mode !== "url" && (
              file?.type.startsWith("video/") ? <video className="media" src={preview} controls playsInline /> :
              file?.type.startsWith("audio/") ? <div className="empty"><div className="lens">≋</div><strong>{file.name}</strong><audio src={preview} controls /></div> :
              <img className="media" src={preview} alt="Selected media" />
            )}
          </div>

          <div className="actions">
            {cameraOn ? <><button className="primary" onClick={capture}>Capture & prepare scan</button><button className="ghost" onClick={stopCamera}>Cancel</button></> :
              <button className="primary wide" disabled={busy || (!file && !url.trim())} onClick={analyze}>{busy ? "Running Reality Scan…" : "Run Reality Scan"}</button>}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      {result && (
        <section className="results shell" id="results">
          <div className={"verdict " + result.verdict}>
            <div><p className="kicker">REALITY SCAN • {result.id}</p><h2>{verdict}</h2><p>{result.recommendation}</p></div>
            <div className="score"><strong>{result.realityScore ?? "—"}</strong><small>REALITY SCORE</small></div>
          </div>

          <div className="metrics">
            <article><small>Manipulation risk</small><strong>{pct(result.manipulationRisk)}</strong></article>
            <article><small>AI-generated risk</small><strong>{pct(result.aiGeneratedRisk)}</strong></article>
            <article><small>Deepfake risk</small><strong>{pct(result.deepfakeRisk)}</strong></article>
            <article><small>Provenance</small><strong>{result.provenance.status === "credential_present" ? "Observed" : "Not verified"}</strong></article>
          </div>

          <div className="details">
            <article className="panel">
              <div className="panelTitle"><div><p className="kicker">FORENSIC SIGNALS</p><h3>Why RealityShield reached this result</h3></div><span className="badge">{result.provider === "hive" ? "MODEL-BACKED" : "PREFLIGHT ONLY"}</span></div>
              {result.signals.map((signal) => <div className="signal" key={signal.label}><i className={signal.level} /><div><strong>{signal.label}</strong><p>{signal.detail}</p></div><b>{pct(signal.score)}</b></div>)}
            </article>
            <article className="panel protect"><p className="kicker">PROTECT YOURSELF</p><h3>Before you believe, pay, share or act</h3><p>Verify the person through a separate trusted channel. Check original context and provenance. Never treat a detector score as absolute proof. For money or credentials, stop and independently confirm the request.</p></article>
          </div>

          <div className="evidence"><div><small>EVIDENCE FINGERPRINT</small><code>{result.sha256 || "Available for uploaded media"}</code></div><p>{result.caveat}</p></div>
        </section>
      )}

      <section className="features shell">
        <article><b>01</b><h3>Reality Lens</h3><p>Capture suspicious media directly from another screen.</p></article>
        <article><b>02</b><h3>Evidence Mode</h3><p>SHA-256 fingerprint identifies the exact analyzed file.</p></article>
        <article><b>03</b><h3>Scam Shield</h3><p>Guidance prioritizes impersonation, urgent payment and identity fraud.</p></article>
        <article><b>04</b><h3>Provider-ready</h3><p>Designed to grow into a multimodel visual, audio and provenance ensemble.</p></article>
      </section>

      <footer className="shell"><div className="brand"><b>R</b><span><strong>MABRIG</strong><small>REALITYSHIELD AI</small></span></div><p>MABRIG Technologies • Point. Scan. Verify. Protect.</p></footer>
    </main>
  );
}
