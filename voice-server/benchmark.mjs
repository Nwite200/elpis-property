const url = (process.env.HEADTTS_SERVER_URL || "http://127.0.0.1:8890").replace(/\/$/, "");
const token = process.env.HEADTTS_SERVER_TOKEN;
if (!token) {
  console.error("Set HEADTTS_SERVER_TOKEN to benchmark.");
  process.exit(1);
}

const samples = [
  "Good afternoon. Welcome to Elpis Property.",
  "I found three available properties in Abuja under ninety million naira. The first is a four bedroom duplex in Gwarinpa, and the second is a three bedroom terrace in Wuse."
];

async function run(text) {
  const started = performance.now();
  const res = await fetch(`${url}/v1/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ input: text, voice: "af_bella", language: "en-us", speed: 1, audioEncoding: "wav" })
  });
  const ms = performance.now() - started;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { ms, chars: text.length, audioBase64: (data.audio || "").length };
}

for (const [index, text] of samples.entries()) {
  const cold = await run(text);
  const warm = await run(text);
  const warm2 = await run(text);
  console.log(JSON.stringify({
    sample: index + 1,
    chars: text.length,
    cold_ms: Math.round(cold.ms),
    warm_ms: [Math.round(warm.ms), Math.round(warm2.ms)],
    audio_kb: Math.round(cold.audioBase64 * 0.75 / 1024)
  }));
}
