# GhostQ v1 go-live checklist

v1.0.0 must be live at https://ghostq.xyz, free and without login, before the submission (30 Oct 2026, 23:45 ET) and until judging ends (16 Nov). Keep hosting and API budgets alive to about 23 Nov.

`[x]` done · `[ ]` to do. Owner in brackets.

## 1. Done on 21 Oct

- [x] Code moved to `hackathon-projects/ghostq/ghostq`; typecheck, lint, 31 unit tests and the production build pass from the new folder.
- [x] v1.0.0 committed and tagged.
- [x] Public GitHub repo: https://github.com/T04435/ghostq (MIT licence detected, run instructions in the README).
- [x] Vercel project `ghostq` in the cubanos-dev team, linked to this folder; `vercel.json` pins the Next.js framework.
- [x] Environment variables on Vercel in production, preview and development: `QLOO_API_KEY`, `GEMINI_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `QLOO_API_BASE_URL`. No `AI_GATEWAY_API_KEY`: the AI SDK would send any placeholder as the key and skip the project's OIDC token (found 21 Oct), so the gateway authenticates with OIDC, as Busk Map does.
- [x] Neon database `ghostq-db` provisioned through the Vercel integration and connected; `DATABASE_URL` and the Postgres variables differ per environment.
- [x] Domain `ghostq.xyz` and `www.ghostq.xyz` attached to the project.
- [x] Real keys on Vercel in production, preview and development: Qloo and Spotify (the same as Busk Map's), Gemini.
- [x] Neon Object Storage (beta): private bucket `ghostq-audio` on the main branch; `AWS_*` storage variables and `NEON_STORAGE_BUCKET` on Vercel in all environments.
- [x] Neon branches: `main` for production and preview, `development` for local work and Vercel's development environment, so test songs never reach the live Library.
- [x] Song store moved to Neon and checked live on 21 Oct (a full run, singing, the song page and the Library, with the MP3 read back byte for byte): songs, crowd and research in Postgres (table `songs`, created on first use), sung MP3s in the `ghostq-audio` bucket. Local development without `DATABASE_URL` still uses files under `.data/`.

## 2. Accounts and keys [you]

- [ ] Check the cubanos-dev team has AI Gateway credit (GhostQ's runs are now billed to the ghostq project).
- [ ] Gemini: paid tier with prepay credit and auto-reload on, so singing doesn't stop during judging.
- [ ] Spotify: GhostQ shares Busk Map's Spotify app on purpose; nothing to do unless its limits bite.
- [ ] Qloo: ask #api-help for a second key (Busk Map and GhostQ share 10,000 calls a month).
- [ ] Neon: confirm the plan in the Vercel dashboard (the integration's default; not checked).
- [ ] DNS: the registry still listed its default nameservers on 21 Oct, minutes after purchase. Run `vercel domains verify ghostq.xyz --scope cubanos-dev`; if it hasn't switched within a day, set the nameservers to `ns1.vercel-dns.com` and `ns2.vercel-dns.com` in the Vercel domain settings.

## 3. Code that must change before the first deploy [Claude]

- [ ] Rate limits and spend caps (ROADMAP item 1): per-visitor limits on `/api/write`, `/api/sing` and `/api/spotify`; a daily cap on singing (US$0.08 a song); Vercel BotID on the write and sing routes; a clear message when a limit is hit.
- [ ] Function duration: `/api/write` and `/api/sing` declare up to 300 s (a run takes about 30–45 s, singing about 50 s). Check the team's plan allows it.
- [ ] MusicBrainz: its service is free for non-commercial use; note the User-Agent contact and check terms before any commercial launch.

## 4. Release [both]

- [ ] Connect the GitHub repo to the Vercel project (pushes to `main` then deploy). It isn't connected yet, so pushes don't deploy anything.
- [ ] First production deploy, after you approve.
- [ ] Smoke test on https://ghostq.xyz: write a song for a known artist; a run where Qloo lacks data asks and carries on; sing it; open its share link in a private window; find it in the Library; /how compares with plain AI.
- [ ] End-to-end test and one QA pass at 390, 768 and 1440 px.
- [ ] No Qloo response data in the repo (only synthetic test fixtures); keys only on the server.

## 5. Submission [you]

- [ ] Devpost text: the problem, which Qloo calls and why, what was built in the hackathon period, and a first paragraph on how GhostQ differs from Busk Map (another job, another buyer, other Qloo calls, separate repo and brand).
- [ ] Screenshots without credentials; optional short video (no copyrighted music).
- [ ] Live URL works without login; repo public with the licence shown in About.
- [ ] Submit at least 6 hours before the deadline.
