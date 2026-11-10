# Elpis HeadTTS server

Optional Node.js service for HeadTTS/Kokoro server inference. The browser
adapter is the default; this service is only used when the browser cannot run
the model (or a signed-in user chooses server inference).

## Requirements

- Node.js 20+
- 4 GB RAM minimum (model + ONNX runtime), CPU inference
- ~300 MB disk for the model/voice cache and dependencies

## Run

```bash
cd voice-server
npm install
export HEADTTS_SERVER_TOKEN="$(openssl rand -hex 32)"
npm start
```

The authenticated proxy listens on `http://127.0.0.1:8890`; the raw HeadTTS
service stays bound to `127.0.0.1:8882`. Health: `GET /health`.

Synthesis:

```bash
curl -s -X POST http://127.0.0.1:8890/v1/synthesize \
  -H "Authorization: Bearer $HEADTTS_SERVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"Good afternoon, this is Elpis Property.","voice":"af_bella","language":"en-us","speed":1,"audioEncoding":"wav"}'
```

## Connect the Worker

```bash
npx wrangler secret put HEADTTS_SERVER_TOKEN   # same token as above
# set HEADTTS_SERVER_URL in wrangler.toml to the externally reachable HTTPS URL
```

Do not expose the raw 8882 service. The Worker proxy enforces sign-in, persona
validation, 500-character text, 30 requests/10 minutes and a 22-second timeout.

## Hosting

This repository does **not** deploy the Node service. A production host needs
approval (CPU VM / container). Cloudflare Workers cannot host the Kokoro ONNX
model. Paid GPU hosting is explicitly out of scope until approved.

## Benchmark

```bash
HEADTTS_SERVER_URL=http://127.0.0.1:8890 HEADTTS_SERVER_TOKEN=... npm run benchmark
```

The script reports cold/warm latency for a short and a long sentence.
