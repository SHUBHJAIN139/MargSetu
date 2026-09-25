# MargSetu
Project Title & Context: SIH 2026 Problem Statement (MDoNER & NDMA: AI-Based Smart Logistics and Accessibility Intelligence Platform for Northeast Region).
The Core Problem: Mountain chokepoint vulnerability (Sonapur Tunnel on NH-6, Haflong on NH-27, Barak Valley / Tripura isolation during monsoons) and why commercial navigation fails during landslides.
Architectural Pillars:
5-Factor Mathematical Risk Engine (Ri=0.40⋅Rain+0.30⋅Slope+0.15⋅Soil+0.10⋅Crowd+0.05⋅Hist) with structural veto thresholds.
Offline-First 4-Layer Failover SOS Relay with anti-panic 1.5s hold and direct 1077 / 112 telecom hooks.
NDMA Operations Console (incident clustering, operator triage workflow, airhead logistics contingencies).
Driver Emergency HUD (lightweight 360px mobile view with English, Hindi, and Assamese translations).
Mermaid Architecture Diagram: Visual system data flow from Drivers 
→
→ Gateway 
→
→ FastAPI 
→
→ SQLite WAL 
→
→ Telemetry.
Repository Directory Tree: Explaining /backend, /frontend, tests, and configuration.
Quickstart Guide: Step-by-step instructions for setting up Python venv, running all 73 pytest tests, starting FastAPI, and building the Next.js frontend.
Honesty Disclaimers & MIT License: Formal NDMA simulation notices and 
LICENSE
 file.
