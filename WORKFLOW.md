# MargSetu Workflow & Execution Log
**Project:** MargSetu — Highway Corridor Decision Support & Disaster Alert System  
**Initiative:** SIH 2026 / SIH26002 — MDoNER & NDMA  
**Status:** Living Document — Updated at every sprint & milestone transition  
**Last Updated:** 2026-09-20  

---

## 1. Executive Status & Sprint Snapshot

| Metric | Status |
|:---|:---|
| **Current Phase** | Complete — PRD §10 Full Demo Rehearsal & AC-1..12 Certification Passed |
| **System State** | 100% Complete & Verified (73/73 Pytest passed, Next.js UI compiled with 0 errors, 12/12 ACs verified) |
| **Rule 1 Compliance** | 100% — All writes authorized via explicit user directives |
| **Active Blockers** | None |
| **Target Delivery** | SIH 2026 Grand Finale Demo-Ready (C1 Sonapur Landslide -> C2 Haflong Reroute + 4-Layer SOS + Air-Dispatch) |

---

## 2. Rule 1 Approval Audit Log

> **STRICT OPERATING RULE 1:** No code, documentation, configuration, or architectural modification may be introduced without an explicit, verifiable record of user authorization.

| Change Request ID | Timestamp (ISO 8601) | Target Files / Scope | Intent & Description | User Approval Status | Execution Result |
|:---|:---|:---|:---|:---|:---|
| **CR-001** | `2026-09-19T15:41:57Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/`<br>• `ARCHITECTURE.md`<br>• `WORKFLOW.md`<br>• `BUILD_ORDER.md`<br>• `DEBUG_CHECKLIST.md` | Initialize the 4 living markdown files establishing system architecture, execution workflow, build dependency sequence, and verification checklists. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — All 4 living documents generated with complete unabridged specifications. |
| **CR-002** | `2026-09-19T15:45:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `main.py`<br>• `models/` (`enums.py`, `corridor.py`, `config.py`, `incident.py`, `sos.py`)<br>• `services/` (`config_service.py`, `corridor_service.py`, `sos_service.py`)<br>• `data/` (`config.json`, `corridors.geojson`)<br>• `tests/` (`test_health.py`, `test_services.py`) | Implement Build Order Item 1: Backend skeleton with FastAPI, Pydantic models, corridor geojson, config parameters, GET /health endpoint, and 11 unit tests. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Verified by `qa-demo`: 11/11 tests passing, GET /health 200 OK, strict NDMA authority integrity confirmed, zero honesty leaks. |
| **CR-003** | `2026-09-19T16:20:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `services/risk_engine.py`<br>• `models/risk.py`<br>• `tests/test_risk_engine.py` | Implement Build Order Item 2: Deterministic environmental risk engine, seasonal weight transitions, vehicle modifiers, hard veto gates, edge cost formula, and 10 unit test cases. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Audited and signed off by `qa-demo`: 21/21 tests passed (10/10 risk engine tests), all 10 mandated criteria verified, authority integrity confirmed. |
| **CR-004** | `2026-09-19T17:00:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `services/routing_service.py`<br>• `models/route.py`<br>• `routers/routes.py`<br>• `tests/test_routing.py` | Implement Build Order Item 3: Routing Engine Dijkstra, /routes/evaluate endpoint, trade-off matrix (+42km, +56min, +₹1,411 fuel, +39.4kg CO2, -99.2% hazard), multilingual briefs (EN/HI/AS), air-dispatch advisory, and 7 unit tests. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Audited and signed off by `qa-demo`: 28/28 tests passed (7/7 routing tests), trade-off matrix verified, air-dispatch simulated with `live_dispatch_active=False`, zero honesty leaks. |
| **CR-005** | `2026-09-19T17:15:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `services/incident_service.py`<br>• `models/incident.py`<br>• `routers/incidents.py`<br>• `tests/test_clustering_reports.py` | Implement Build Order Item 4: 500m Haversine spatial clustering, compound corroboration (2 reports + rain>50mm or 3 reports), operator triage actions (acknowledge, assign, approve_detour, resolve, false_positive), immutable audit trail, dynamic route linkage, and 9 unit tests. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Audited and signed off by `qa-demo`: 37/37 tests passed (9/9 clustering tests), dynamic route linkage verified, authority integrity confirmed. |
| **CR-006** | `2026-09-19T17:45:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `services/sos_service.py`<br>• `models/sos.py`<br>• `routers/sos.py`<br>• `tests/test_sos_state_machine.py` | Implement Build Order Item 5: Emergency SOS state machine, 4-layer cascade (IP Direct, Delay-Tolerant Mesh, Telephony Hooks tel:1077/tel:112/sms, Evacuation Vector), operator triage actions, audit trail, copy safety ('rescued' absent, is_dispatched=False), and 8 unit tests. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Audited and signed off by `qa-demo`: 45/45 tests passed (8/8 SOS tests), copy safety verified, authority integrity confirmed. |
| **CR-007** | `2026-09-19T17:55:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `services/llm_service.py`<br>• `models/advisory.py`<br>• `routers/advisory.py`<br>• `tests/test_llm_service.py` | Implement Build Order Item 6: LLM advisory service with template fallback, kill-API-key resilience (<1ms, 0.055ms actual), multilingual templates (EN/HI/AS across 4 states), safety post-processor, and 7 unit tests. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Audited and signed off by `qa-demo`: 52/52 tests passed (7/7 LLM service tests), AC-9 kill-key resilience confirmed in 0.055ms, zero honesty leaks. |
| **CR-008** | `2026-09-19T18:30:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/backend/`<br>• `services/scenario_service.py`<br>• `main.py` (`/scenario/apply`, `/scenario/reset`, `/scenario/state`)<br>• `tests/test_scenario_controls.py` | Implement Build Order Items 7 & 8: Real-time scenario stress controls (rainfall slider $0-150\text{ mm}$, Sonapur/Haflong hazard toggles, NDMA administrative override) and byte-identical baseline reset (`/scenario/reset`). | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Verified by `qa-demo`: 58/58 tests passed (6/6 scenario tests), dynamic routing linkage verified, byte-identical reset confirmed. |
| **CR-009** | `2026-09-20T00:15:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/`<br>• `frontend/` (Next.js 14 App Router, Driver Mobile HUD, Ops Console, Leaflet GIS map, $\ge 44\text{px}$ targets, 1500ms SOS ring)<br>• `backend/tests/test_demo_and_acceptance_criteria.py`<br>• `DEBUG_CHECKLIST.md` | Implement Build Order Item 9 (Full Responsive UI) and Execute Full Demo Day Rehearsal (PRD §10) with AC-1 through AC-12 compliance certification. | **APPROVED** (Explicit User Directive via Orchestrator) | **SUCCESS** — Audited and certified by `qa-demo`: 71/71 tests passed across 9 suites (13/13 demo/AC tests), Next.js compiled with 0 errors, 100% pass across all 12 Acceptance Criteria. |
| **CR-010** | `2026-09-20T09:18:12Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/`<br>• `backend/services/route_service.py`<br>• `backend/services/sos_service.py`<br>• `backend/models/schemas.py`<br>• `backend/main.py`<br>• `backend/tests/test_demo_and_acceptance_criteria.py`<br>• `ARCHITECTURE.md`, `DEBUG_CHECKLIST.md`, `WORKFLOW.md`, `BUILD_ORDER.md` | Senior Review Post-Build Fixes: Dynamic rainfall slider binding $R_{\text{rain}} = \min(10.0, (\text{rainfall\_mm}/75.0)\times 4.0)$, C1 baseline calibration ($R_i = 2.4$ at 68mm matching PRD §10), dynamic interpolation in veto reason, Layer 3 SMS URI update (`sms:1077`), multilingual advisory dict schema, and DEC-001 recording. | **APPROVED** (Explicit User Directive) | **SUCCESS** — 71/71 tests passing; sweep confirmed $R_i$ progression ($2.23 \rightarrow 2.44 \rightarrow 2.53 \rightarrow 2.55 \rightarrow 10.0$); 0 rescue terms; Next.js 14 clean build (exit 0). |
| **CR-011** | `2026-09-20T13:25:00Z` | `/home/shubh/.gemini/antigravity/scratch/margsetu/frontend/`<br>• `tailwind.config.js`<br>• `app/globals.css`<br>• `lib/tokens.js`<br>• `lib/labels.jsx`<br>• `lib/adapters/` (`types.js`, `mockAdapter.js`, `realAdapter.js`)<br>• `lib/api.js`<br>• `components/nav/Navbar.jsx`<br>• `app/layout.jsx`<br>• `components/map/DynamicLeafletMap.jsx`<br>• `components/sos/UnifiedSOSButton.jsx`<br>• `components/driver/` (`RouteCard.jsx`, `TradeOffPanel.jsx`, `AudioBriefPlayer.jsx`)<br>• `components/ops/` (`AuditTimeline.jsx`, `RainfallSlider.jsx`)<br>• `app/` (`page.jsx`, `corridors/page.jsx`, `driver/page.jsx`, `report/page.jsx`, `ops/page.jsx`)<br>• `ARCHITECTURE.md` (DEC-002)<br>• `BUILD_ORDER.md`<br>• `DEBUG_CHECKLIST.md`<br>• `WORKFLOW.md` | Frontend Architecture Overhaul to DESIGN.md (FINAL v2) · "Paper Map, Not Cockpit": Light theme only (`#FAF8F5` paper, `#FFFFFF` surface, `#1F2933` ink, zero dark panels/gradients), real multi-route navigation (`/`, `/corridors`, `/driver`, `/report`, `/ops`), CartoDB Positron light tiles, 6px dual-encoded polylines, pluggable simulation adapter bridge, 1.5s UnifiedSOSButton with Space/Enter keyboard hold & `sms:1077`, and subagent audits. | **APPROVED** (Explicit User Directive) | **SUCCESS** — Next.js 14 compiled with 0 errors across all 6 static routes; 73/73 backend tests passing; subagent audits certified. |

---

## 3. Work Completed Log

### Sprint 0: Living Documentation Baseline (2026-09-19)
- Analyzed and synthesized PRD v2.0 specifications for SIH26002 (MDoNER / NDMA).
- Codified geographical definitions and coordinates for C1 (Sonapur Tunnel `25.1147°N, 92.3654°E`), C2 (Haflong Bypass), and C3 (Siliguri-Guwahati).
- Established the 4-tier Data Honesty Badge taxonomy (`LIVE API`, `VERIFIED STATIC`, `SIMULATION`, `USER-SUBMITTED`).
- Formulated multi-factor environmental risk calculation: $R_{\text{total}} = 0.35 R_{\text{rain}} + 0.30 R_{\text{slope}} + 0.20 R_{\text{crowd}} + 0.15 R_{\text{history}}$.
- Generated the 4 core living markdown files under user approval (CR-001).

### Sprint 1: Build Order Item 1 — Backend Foundation & Integrity Verification (2026-09-19)
- **FastAPI Backend Core:** Built application entrypoint (`backend/main.py`) with CORS middleware, lifespan events, and `GET /health` endpoint.
- **Pydantic Domain Schemas:** Implemented strict models with honesty labeling (`LIVE API`, `VERIFIED STATIC`, `SIMULATION`, `USER-SUBMITTED`).
- **Static Geometries & Config Seeding:** Seeded `corridors.geojson` (C1 Sonapur Tunnel at `25.1147°N, 92.3654°E`, C2 Haflong, C3) and `config.json` (PRD §3 seasonal weights, vehicle modifiers, veto thresholds, fuel/carbon metrics).
- **Authority & Honesty Enforcement:** Rule 2 simulation notice enforced verbatim (`"SIMULATION — not connected to official NDMA systems"`). NDMA is sole authority; zero claims of "rescued"; `is_dispatched=False` strictly enforced.
- **QA Verification:** Passed 11/11 tests. Audited and certified by `qa-demo`.

### Sprint 2: Build Order Item 2 — Environmental Risk Engine, Veto Gates & Color States (2026-09-19)
- **Deterministic Risk Computation Engine:** Implemented `backend/services/risk_engine.py` evaluating multi-factor segment risk $R_i = \sum w_k f_k$:
  - Rainfall intensity factor, terrain slope factor, historical landslide frequency, crowd reports with exponential decay, and soil/drainage vulnerability.
  - Seasonal weight transitions: Dynamic vector loading from `config.json` (Monsoon, Post-Monsoon, Winter, Pre-Monsoon summing to 1.0).
  - Vehicle type risk modifiers: Heavy Freight (+0.5), Commercial Light (0.0), Emergency (-1.5), Two-Wheeler (0.0).
- **Hard Veto & Safety Threshold System:**
  - Compound hazard veto: Extreme rain (>75 mm) + steep slope (>30°) triggers immediate blockage (`is_blocked=True`, edge cost = $\infty$).
  - Crowd incident veto: $\ge 3$ corroborated hazard reports trigger blockage.
  - Administrative veto: Explicit NDMA administrative override triggers corridor closure.
  - Vehicle-dependent color classification: Closed segments render as `dark_red` for standard/heavy vehicles, and `purple` for emergency-only transit.
- **Exponential Edge Cost Formulation:** Evaluated $c_i = d_i \cdot (1 + \exp(R_i / 2.5))$ penalizing high-risk routes, with infinite cost on hard-vetoed segments.
- **UI Risk Breakdown Contract:** Implemented `SegmentRiskBreakdown` providing granular factor scores, weighted contributions, percentage shares (summing to 100.0%), and honesty labels.
- **QA Audit & Verification:** All 21/21 tests in suite passing (10/10 in `test_risk_engine.py`, 6/6 in `test_health.py`, 5/5 in `test_services.py`). Signed off by `qa-demo`.

### Sprint 3: Build Order Item 3 — Routing Engine Dijkstra & /routes/evaluate (2026-09-19)
- **Multi-Route Evaluation Service (`backend/services/routing_service.py`):**
  - Implemented Dijkstra routing over corridor network with exponential risk weighting ($c_i = d_i \cdot (1 + \exp(R_i / 2.5))$) and hard-veto infinite cost filtering.
  - Scenario handling: Baseline (C1 fastest & resilient, $R_i = 1.30$, cost 972.87, status `GREEN`); Sonapur hazard injection (C1 hard-vetoed, automated detour failover to C2 Haflong Bypass, status `GREEN`); All-blocked regional emergency (triggers air-dispatch fallback).
- **Heavy Freight Trade-Off Matrix (PRD §4 Benchmark):**
  - Computed dynamic deltas between C1 and C2: Distance (`+42.0 km`), Time (`+56.0 min`), Fuel Cost (`+₹1,411.0`), Carbon Footprint (`+39.4 kg CO2`), and Hazard Exposure Reduction (`-99.2%` avoiding Sonapur tunnel chokepoint).
- **Multilingual Advisory Brief Generator:**
  - Generates route briefings in English (`en`), Hindi (`hi`), and Assamese (`as`) with native typography and mandatory NDMA simulation disclaimers.
- **Air-Dispatch Emergency Advisory:**
  - Provides contingency logistics between Guwahati Borjhar Airbase (GAU/VEGT) and Silchar Kumbhirgram Airfield (IXS/VEKU).
  - Strictly restricted to `ops_view_only=True`, labeled `SIMULATION`, with `live_dispatch_active=False` strictly enforced.
- **QA Audit & Verification:** 28/28 tests passing across all test suites (7/7 in `test_routing.py`). Audited and certified by `qa-demo`.

### Sprint 4: Build Order Item 4 — 500m Haversine Clustering, /reports & Operator Triage (2026-09-19)
- **Haversine Spatial Clustering Engine (`backend/services/incident_service.py`):**
  - Implemented 500m great-circle radius clustering: Reports within 500m merge into single cluster (`action_taken="merged"`), updating running centroid and incrementing count. Reports beyond 500m create distinct clusters.
- **Compound Corroboration Mechanism:**
  - 2 reports + rainfall > 50 mm $\rightarrow$ automatic promotion to `VERIFIED` (`is_confirmed_blockage=True`).
  - 3 reports regardless of rainfall $\rightarrow$ automatic promotion to `VERIFIED` (`is_confirmed_blockage=True`).
  - 2 reports with rainfall $\le$ 50 mm $\rightarrow$ status `CORROBORATED` (amber, unconfirmed).
- **Operator Triage Actions & Audit Trail (`POST /ops/incidents/{id}/action`):**
  - Supports full lifecycle: `acknowledge`, `assign`, `approve_detour`, `resolve`, `false_positive`.
  - Generates immutable `IncidentAuditLogEntry` with operator details, timestamp, state delta, reason, NDMA authority, and mandatory simulation notice.
- **Dynamic Route Linkage (`GET /routes/evaluate`):**
  - Confirmed blockage cluster at Sonapur Tunnel automatically imposes C1 hard veto in routing engine, triggering C2 Haflong reroute.
  - Operator resolving the incident unblocks C1 dynamically on subsequent queries.
- **QA Audit & Verification:** 37/37 tests passing across all 5 test suites (9/9 in `test_clustering_reports.py`). Audited and certified by `qa-demo`.

### Sprint 5: Build Order Item 5 — Emergency SOS State Machine, 4-Layer Cascade & Audit Trail (2026-09-19)
- **Emergency SOS State Machine (`backend/services/sos_service.py`):**
  - Full state lifecycle: `initiated` $\rightarrow$ `sending` $\rightarrow$ `delivered` $\rightarrow$ `acknowledged` $\rightarrow$ `assigned` $\rightarrow$ `resolved`.
  - Degraded/offline network transitions: `fallback_offered` $\rightarrow$ `queued_offline` $\rightarrow$ `retry_pending` $\rightarrow$ `delivered`.
- **4-Layer Resilient Cascade Architecture:**
  - Layer 1 (IP Direct REST `/sos`): Labeled `SIMULATION` with 5s timeout.
  - Layer 2 (Delay-Tolerant Mountain Mesh): Labeled `SIMULATION`, store-and-forward hopping across verified corridor relay nodes (Guwahati, Shillong, Sonapur, Silchar).
  - Layer 3 (Telephony Native OS Call/SMS Hooks): Labeled `VERIFIED STATIC`. Provides real OS URI hooks (`tel:1077` DDMA, `tel:112` National Emergency, compact `<160 char` SMS intent).
  - Layer 4 (Physical Evacuation Vector): Labeled `SIMULATION`, restricted to `ops_view_only=True` and `live_dispatch_active=False`.
- **Operator Triage Actions & Immutable Audit Trail (`POST /ops/sos/{id}/action`):**
  - Lifecycle actions: `acknowledge`, `assign`, `resolve`, `trigger_fallback`.
  - Appends immutable `SOSAuditLogEntry` with dual mandatory disclaimers:
    1. `"SIMULATION — not connected to official NDMA systems"`
    2. `"MargSetu is not a replacement for official emergency services."`
- **Strict Copy Safety & Authority Invariants:**
  - State `delivered` is verified labeled as `"Signal Delivered to Queue - Awaiting Operator Review"`. Forbidden string `"rescued"` is completely absent.
  - `is_dispatched = False` is permanently enforced at the schema and state transition level (zero live dispatch claimed).
- **QA Audit & Verification:** 45/45 tests passing across all 6 test suites (8/8 in `test_sos_state_machine.py`). Audited and certified by `qa-demo`.

### Sprint 6: Build Order Item 6 — LLM Advisory Service with Template Fallback (2026-09-19)
- **Resilient Advisory Engine (`backend/services/llm_service.py`):**
  - Primary generator uses Gemini LLM for situational route polish.
  - Secondary deterministic template engine with instant fallback on missing API key, timeout, or quota errors.
  - **AC-9 Kill-API-Key Test:** Latency measured at 0.055ms (<1ms), returning `is_fallback=True`, `source="template_fallback"`, `fallback_reason="api_key_missing_or_killed"`.
- **Multilingual Templates Across 4 State Matrices:**
  - Verified authentic regional phrasing in English (`en`), Hindi (`hi`), and Assamese (`as_` / `as`) for:
    1. Blocked Corridor (C1 Sonapur Tunnel RED ALERT)
    2. Recommended Resilient Detour (C2 Haflong Bypass with +42km, +56min)
    3. All Ground Lifelines Blocked (Air Bridge trigger)
    4. Baseline Open Corridor (Passable under caution)
- **Strict Safety Boundaries & Authority Rules:**
  - LLM never computes risk scores, alters veto flags, invents coordinates, or claims live dispatch.
  - Post-processor enforces NDMA disclaimer retention. Prohibited agencies (NDRF, SDRF, NHAI, BRO, Police, Army) and forbidden term `"rescued"` are absent.
- **Endpoint & QA Verification:** `POST /advisory/polish` tested and certified. Pytest suite passing 52/52 tests (7/7 in `test_llm_service.py`). Signed off by `qa-demo`.

---

### Sprint 7: Build Order Items 7 & 8 — Scenario Stress Controls & Baseline Reset (2026-09-19)
- **Real-Time Simulation Adjustment (`backend/services/scenario_service.py`):**
  - Implemented dynamic parameter control via `POST /scenario/apply` supporting rainfall slider ($0-150\text{ mm}$), Sonapur hazard toggle, Haflong hazard toggle, NDMA administrative override toggle, and seasonal profile selector.
  - Setting rainfall to 85mm automatically triggers compound hazard veto on Corridor C1 at Sonapur Tunnel (Slope $34.2^\circ > 30.0^\circ$ and Rain $85\text{ mm} > 75\text{ mm}$), setting status to `dark_red` ($R_i = 7.65$, cost $\infty$).
  - Dynamic routing link: `GET /routes/evaluate` immediately reflects active scenario state without server restart, automatically triggering resilient failover to C2 Haflong Bypass.
- **Byte-Identical Baseline Reset (`POST /scenario/reset`):**
  - Restores nominal parameters in $< 5\text{ ms}$: rainfall restored to baseline $68.0\text{ mm}$ (or $24.5\text{ mm}$), corridor vetoes flushed (`active_corridor_vetoes = []`), crowdsourced reports purged and pre-seeded baseline clusters restored, SOS queue flushed (`total_records = 0`), C1 unblocked and restored as primary recommended lifeline (`is_blocked = False`, classification `green`).
  - Strict invariance verified across multiple stress-and-reset cycles (PRD §11 AC-12 compliant).
- **QA Audit & Verification:** 58/58 tests passing across 8 test suites (6/6 in `test_scenario_controls.py`). Signed off by `qa-demo`.

### Sprint 8: Build Order Item 9 — Next.js 14 Responsive UI Frontend (2026-09-19)
- **Architecture & Tooling (`frontend/`):**
  - Built with Next.js 14 App Router, React 18, and Tailwind CSS.
  - System landing page (`app/page.jsx`) providing role-based navigation and high-level architectural overview.
- **Mobile-First Driver HUD (`app/driver/page.jsx`):**
  - **Ergonomics & Touch Targets (Rule 3):** All buttons and interactive elements strictly meet or exceed $\ge 44\text{px} \times 44\text{px}$. High-contrast styling optimized for bright daylight outdoor readability.
  - **1.5s Press-and-Hold SOS Button (`components/driver/SOSButton.jsx`):** Circular SVG progress ring requires continuous 1500ms hold to activate; premature release immediately aborts trigger and displays educational hint. Upon activation, fires `POST /sos` and displays 4-layer cascade status.
  - **Route Cards & Trade-Off Comparison (`components/driver/RouteCard.jsx`):** Displays base distance, transit ETA, composite risk index, fuel cost ₹, carbon footprint kg $\text{CO}_2$, hazard exposure reduction %, and 5-factor component breakdown bar.
  - **Multilingual Audio Briefs (`components/driver/AudioBriefPlayer.jsx`):** Web Speech API synthesizer with native pronunciation in English, Hindi, and Assamese with fallback script rendering.
  - **Crowdsourced Incident Modal (`components/driver/ReportModal.jsx`):** Optimistic local state submission, location autofill, and automatic sync.
- **NDMA Operations Console (`app/ops/page.jsx`):**
  - **Interactive GIS Corridor Map (`components/ops/OpsMap.jsx`):** Leaflet map rendering GeoJSON layers for C1 (NH-6), C2 (NH-27), C3 (NH-27 West), Sonapur Tunnel portal beacon ($25.1147^\circ\text{N}, 92.3654^\circ\text{E}$), incident markers, and SOS distress beacons.
  - **Scenario Controls Tab (`components/ops/ScenarioControlsTab.jsx`):** Live rainfall slider, hazard injection toggles, NDMA override, and one-click baseline reset.
  - **SOS Queue Tab (`components/ops/SOSQueueTab.jsx`):** Real-time monitoring of distress signals with operator triage actions (`acknowledge`, `assign`, `resolve`) and 4-layer cascade inspection.
  - **Incidents Triage Tab (`components/ops/IncidentsTab.jsx`):** 500m cluster triage (`acknowledge`, `assign`, `approve_detour`, `resolve`, `false_positive`) with dynamic route unblocking.
  - **Air-Dispatch Emergency Advisory (`components/ops/AirDispatchAdvisory.jsx`):** High-level airlift logistics display restricted to `ops_view_only=True`, labeled `SIMULATION`, with `live_dispatch_active=False` strictly enforced.
- **Transparency & Honesty UI Enforcers:**
  - `components/common/HonestyBadge.jsx`: Unambiguous color-coded chips for `LIVE API`, `VERIFIED STATIC`, `SIMULATION`, and `USER-SUBMITTED`.
  - `components/common/SimulationBanner.jsx`: Prominent persistent header with verbatim Rule 2 notice `"SIMULATION — not connected to official NDMA systems"`.
- **Frontend Production Build:** Verified clean `next build` compiling all 6 routes with 0 errors and 0 type warnings.

### Sprint 9: Build Order Item 10 — Full Demo Day Rehearsal & AC-1..12 Certification (2026-09-20)
- **PRD §10 Demo Day Rehearsal Sequence Verification:**
  - **Step 1 (Baseline Check):** C1 Guwahati-Silchar via Sonapur active, $R_i = 1.30$ (`GREEN`), nominal ETA 9.5h, trade-off matrix is `None`.
  - **Step 2 (Disruption):** Rainfall adjusted to 85mm via `POST /scenario/apply` $\rightarrow$ Sonapur compound hazard veto triggers $\rightarrow$ C1 transitions to `DARK_RED` (cost $\infty$) $\rightarrow$ automated failover selects C2 Haflong Bypass $\rightarrow$ Trade-Off Matrix displays exact PRD §4 heavy freight benchmark ($+42.0\text{ km}$, $+56.0\text{ min}$, $+₹1,411.0$ fuel, $+39.4\text{ kg CO}_2$, $-99.2\%$ hazard reduction) $\rightarrow$ Multilingual advisory plays in English, Hindi, and Assamese.
  - **Step 3 (Blackout SOS):** 1.5s press-and-hold activation verified on `/driver` $\rightarrow$ ingested via `POST /sos` $\rightarrow$ beacon pinned on Ops map at Sonapur Tunnel portal ($25.1147^\circ\text{N}, 92.3654^\circ\text{E}$) $\rightarrow$ 4-layer cascade metadata rendered (IP Direct `SIMULATION`, Mesh `SIMULATION`, Native Telephony `VERIFIED STATIC` with `tel:1077`/`tel:112`/SMS, Airlift `SIMULATION`) $\rightarrow$ Operator triage lifecycle completed (`acknowledge` $\rightarrow$ `assign` $\rightarrow$ `resolve`).
  - **Step 4 (One-Click Reset):** `POST /scenario/reset` executed $\rightarrow$ exact baseline restored in $< 5\text{ ms}$.
- **PRD §11 All 12 Acceptance Criteria Verified:**
  - AC-1: $\ge 2$ route alternatives visible in both UI views. `[PASS]`
  - AC-2: Dynamic risk and recommendation update without page reload. `[PASS]`
  - AC-3: Route cards display distance, ETA, risk, fuel, carbon, and hazard exposure. `[PASS]`
  - AC-4: Incident submission visible with clustering status and honesty label. `[PASS]`
  - AC-5: 1.5s press-and-hold SOS trigger prevents accidental activation. `[PASS]`
  - AC-6: Operator can acknowledge, assign, and resolve SOS events with audit trail. `[PASS]`
  - AC-7: Layer 3 native call/SMS actions visible and labeled `VERIFIED STATIC`. `[PASS]`
  - AC-8: Mesh/satellite/airlift layers strictly labeled `SIMULATION` with Rule 2 notice. `[PASS]`
  - AC-9: Kill-key resilience verified in 0.055ms with structured multilingual output. `[PASS]`
  - AC-10: Offline simulation mode renders last-known state and queues sync. `[PASS]`
  - AC-11: Full copy safety audit: 0 live dispatch claims, 0 occurrences of forbidden word `"rescued"`, NDMA strictly sole authority, verbatim simulation disclaimer on all views. `[PASS]`
  - AC-12: Byte-identical reset restores nominal baseline state. `[PASS]`
- **QA Certification:** 71/71 tests passing across 9 test suites in 1.16s (`tests/test_demo_and_acceptance_criteria.py`: 13/13 passed). Certified by `qa-demo`.

### Sprint 10: Senior Review Audit & Post-Build Calibrations (2026-09-20)
- **Dynamic Rainfall Engine Integration:**
  - Implemented dynamic rainfall calculation $R_{\text{rain}} = \min(10.0, (\text{rainfall\_mm} / 75.0) \times 4.0)$ in `backend/services/route_service.py`.
  - Wired `active_rainfall_mm` from `scenario_service` (or query param) into `GET /routes/evaluate`.
  - Interpolated actual numeric rainfall string into `veto_reason` (e.g. `Extreme Rainfall (76.0mm > 75.0mm)` instead of hardcoded 85.0mm).
- **Exact Baseline $R_i = 2.4$ Calibration:**
  - Calibrated baseline physical parameters so that at 68.0mm baseline rainfall, C1 composite risk evaluates to $R_i = 2.40$ (`GREEN`), matching PRD §10 demo script benchmark exactly.
- **Layer 3 Telephony SOS Scheme Alignment:**
  - Unified telephony SMS intent hook on `sms:1077?body=...` (DDMA helpline) across backend `sos_service.py`, tests, and frontend.
- **Multilingual Advisory Schema Unification:**
  - Updated `RouteEvaluation.advisory_brief` to dictionary `{en, hi, as}`, ensuring seamless multilingual rendering without raw string fallback errors.
- **Documentation & Decision Log (DEC-001):**
  - Documented Next.js 14 + React 18, Python 3.10.12 runtime, and exact carbon calculation ($42.0 \times 0.35 \times 2.68 = 39.4\text{ kg}$) in `ARCHITECTURE.md`.
- **Linguistic Safety Audit:**
  - Ripgrep verified 0 occurrences of prohibited rescue claims in Hindi and Assamese scripts across all product code and templates.
- **Full Verification:**
  - 71/71 backend unit & integration tests pass.
  - Next.js production build (`npm run build`) compiles with 0 errors across all 6 static routes.

### Sprint 11: Canonical Frontend Architecture Overhaul — DESIGN.md (FINAL v2) · "Paper Map, Not Cockpit" (2026-09-20)
- **Visual Design & Token Redesign:**
  - Standardized warm off-white paper theme (`#FAF8F5` background, `#FFFFFF` cards/surfaces, `#1F2933` ink typography, 1px `#E5E0D8` soft borders). Zero dark panels, zero neon gradients, zero glassmorphism.
  - Quiet, low-contrast data honesty badges (`LIVE API`, `VERIFIED STATIC`, `SIMULATION`, `USER-SUBMITTED`) and high-contrast risk badges with subtle backgrounds (`#EDF7ED` safe, `#FFF8E1` caution, `#FDE8E8` danger, `#FBEBEB` blocked, `#F3EAFD` emergency).
- **Multi-Route Application Architecture:**
  - Implemented real multi-page routing with working browser back/forward history and deep links:
    * `/`: Landing page with motto *"Know which road is open before you leave."*, two primary action cards (Driver vs Operator), and Observe $\rightarrow$ Assess $\rightarrow$ Decide $\rightarrow$ Act 4-step strip.
    * `/corridors`: Public transparency page featuring interactive Leaflet map, 6-state dual-encoded legend, and click-to-view corridor records.
    * `/driver`: 360px mobile HUD with >500px viewport notice, 44px tap targets, Best route teal border, 5 factor risk bars, AudioBriefPlayer (EN/HI/AS), TradeOffPanel on detour, and UnifiedSOSButton.
    * `/report`: 1-tap hazard reporting with 4 prominent categories (Landslide, Waterlogging, Road Damage, Clear), geolocation consent gate, and control room status strip.
    * `/ops`: 65/35 desktop command center with rainfall slider (0–150 mm) in the map toolbar, live polyline repaint, Demo-Mode pill (no fake login), and vertical AuditTimeline.
- **Cartographic Refactoring:**
  - Replaced dark map tiles with CartoDB Positron light tiles (`light_all`).
  - 6px route polylines with dual encoding: solid lines for standard states (safe green `#2E7D32`, caution amber `#E08A00`, danger red `#C62828`) and dashed patterns for non-standard states (emergency purple `#6A3FA0`, blocked dark red `#8B1A1A`).
  - Sonapur chokepoint beacon with subtle alive pulse (`.pulse-alive`).
- **Resilient Adapter Bridge:**
  - Implemented pluggable `MockAdapter` and `RealAdapter` adhering to unified metadata envelope (`source`, `honesty_label`, `latency_ms`, `cached`, `timestamp`).
  - `MockAdapter` hosts deterministic in-memory simulation with PRD §3 & §10 math, dynamic slider sweep, and 4-layer SOS cascade.
  - Zero disruption fallback via `getDeterministicRouteFallback()` ensuring AC-10 acceptance criteria pass.
- **Ergonomics & Safety:**
  - Unified 88px circular `UnifiedSOSButton` with 1.5s rAF progress ring, Space/Enter keyboard hold with visible focus ring, Layer 3 real OS hooks (`sms:1077`, `tel:1077`, `tel:112`), and strictly zero claims of rescue/live dispatch.
- **Verification:**
  - `npm run build`: Exit 0; all 6 static routes compiled with zero errors.
  - `pytest tests`: 73/73 passed across all 9 test suites in 1.43s.
  - Subagents `ui-ux-reviewer` and `sih-judge-simulator` audited all 5 surfaces.

### Sprint 11.1: Runtime Browser CSS Delivery & Leaflet PostCSS Decoupling (2026-09-20)
- **Problem Investigated:** User reported unstyled raw HTML at `http://localhost:3000` in Brave Browser despite passing static source code audits.
- **Root Cause Identified:**
  1. `@import 'leaflet/dist/leaflet.css';` in `globals.css` failed PostCSS bundling from `node_modules` during dev server compilation.
  2. Manual `<head>` tag in `app/layout.jsx` linking external Google Fonts was aggressively blocked by Brave Shields (22 blocked items) and disrupted Next.js App Router stylesheet streaming.
  3. Running `next dev` server had stale JIT cache in `.next/cache`.
- **Fixes Applied (User Approved under Rule 1):**
  1. Removed `@import 'leaflet/dist/leaflet.css';` from `app/globals.css`.
  2. Added JavaScript import `import 'leaflet/dist/leaflet.css';` to `app/layout.jsx`.
  3. Removed manual `<head>` tag with Google Fonts from `app/layout.jsx`; switched to zero-latency native system font stack in `tailwind.config.js`.
  4. Purged `.next` build cache (`rm -rf .next`) and verified fresh production build (`npm run build`).
- **Verification:**
  - Compiled stylesheet `.next/static/css/a8e8c1464bbf9e96.css` (57,415 bytes) confirmed containing `#FAF8F5`, `#0F6E5D`, `.leaflet-tile`, and `min-height: 44px`.
  - SSR HTML confirmed containing direct link to `/_next/static/css/a8e8c1464bbf9e96.css` with 0 external blocking font dependencies.
  - 73/73 backend tests passing.

---

## 4. Immediate Next Steps / Final Handover

All build milestones and verification sequences from PRD §9, §10, and §11 are 100% complete and certified:

1. **Jury & Grand Finale Presentation:**
   - Standby on local servers:
     - Backend API: `http://localhost:8000` (FastAPI Core Engine)
     - Frontend Application: `http://localhost:3000` (Next.js 14 Driver HUD & Ops Console)
   - Execute the verified PRD §10 demonstration sequence according to [`DEBUG_CHECKLIST.md`](file:///home/shubh/.gemini/antigravity/scratch/margsetu/DEBUG_CHECKLIST.md#L323-L352).
2. **PostGIS Phase 2 Migration (Future Scaling):**
   - The shipped architecture is fully decoupled via the Repository Pattern; ready for PostgreSQL 16 + PostGIS 3.4 drop-in container.

---

## 5. Architectural & Operational Decisions Log

| Decision ID | Description | Options Considered | Decision & Implementation Status | Status |
|:---|:---|:---|:---|:---|
| **DEC-001** | Frontend Architecture & Tooling | A) Next.js 14 / React<br>B) Vite + React / TypeScript<br>C) Vanilla TS + Vite | **Option A (Next.js 14 App Router + Tailwind CSS):** Implemented. Provided excellent server/client component boundary, zero-config production bundling (`next build` compiled 6/6 routes with 0 errors), clean Leaflet dynamic SSR imports, and full Rule 3 compliance ($\ge 44\text{px}$ touch targets). | **IMPLEMENTED** |
| **DEC-002** | Simulation Controls & Baseline Reset Strategy | A) Dynamic in-memory state with JSON baseline snapshot<br>B) Ephemeral SQLite in-memory database | **Option A (In-Memory ScenarioService + JSON Snapshot):** Implemented. Provides sub-millisecond dynamic parameter adjustment and guaranteed byte-identical reset via `backend/data/scenario_reset.json` (AC-12). | **IMPLEMENTED** |
| **DEC-003** | Local Dev Port Allocation | Standard default ports | Backend: `http://localhost:8000`<br>Frontend: `http://localhost:3000` | **IMPLEMENTED** |
| **DEC-004** | DEFERRED: Crowd-verification hardening — post-demo roadmap | A) Implement reputation consensus & env-gated drills in prototype<br>B) Defer to post-demo roadmap, rely on operator triage as arbiter | **Option B (Deferred):** The false-report hardening (reputation-weighted consensus + environment-gated blocks + Scenario 4 "Misinformation Drill") is parked for the post-hackathon roadmap. In this prototype, the operator triage layer is the primary arbiter for crowd inputs; environmental compound hazard veto functions completely independently of crowd reports.<br>*Judge Defense Strategy:* "In this prototype the operator triage layer is the arbiter; reputation-weighted consensus is in the roadmap, and environmental veto works independently of crowd input." | **DEFERRED (ROADMAP)** |
