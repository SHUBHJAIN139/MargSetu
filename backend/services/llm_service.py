"""LLM Service (llmService) for MargSetu.

PRD Reference: PRD v2.0 §1, §7 (Gemini Adapter — Template-First), §9 (Item 6), §11 (AC-9)
Authority Integrity: NDMA is the ONLY authority named anywhere.
Disclaimer: SIMULATION — not connected to official NDMA systems.

Strict Rules:
1. Template-First Architecture: Deterministic templates in EN, HI, AS are the absolute source of truth.
2. If GEMINI_API_KEY is missing, empty, or unconfigured, the deterministic template returns immediately (<1ms).
3. If Gemini times out (>2.0s) or fails with network/schema error, instantly falls back to deterministic template.
4. Gemini NEVER computes risk, alters veto gates, selects routes, invents coordinates, or claims live dispatch.
"""

import json
import os
import time
from typing import Any, Dict, Optional
import urllib.error
import urllib.request

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    AdvisoryPolishRequest,
    AdvisoryPolishResponse,
    HonestyLabel,
    MultilingualAdvisory,
)


class LLMService:
    """Template-first advisory generator with resilient Gemini language polishing and instant fallback."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.authority_notice = AUTHORITY_NOTICE

    def generate_deterministic_template(
        self, request: AdvisoryPolishRequest
    ) -> MultilingualAdvisory:
        """Generate deterministic multilingual emergency advisory in English, Hindi, and Assamese.
        
        This serves as the unalterable ground truth.
        """
        corridor = request.corridor_name
        risk = request.risk_score
        rain = request.rainfall_mm
        detour_km = request.detour_km or 42.0
        eta_min = request.eta_minutes or 56.0
        reason = request.veto_reason or request.hazard_type or "Severe multi-hazard condition"

        if request.all_blocked:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] ALL GROUND CORRIDORS IMPASSABLE. "
                "NH-6 and NH-27 both obstructed by severe hazard clusters. Stand fast; air bridge advisory activated. "
                f"Notice: {self.authority_notice}"
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] सभी जमीनी मार्ग बंद हैं। "
                "एनएच-6 और एनएच-27 दोनों बाधित हैं। जहाँ हैं वहीं सुरक्षित रहें; हवाई संपर्क परामर्श सक्रिय किया गया है। "
                f"सूचना: {self.authority_notice}"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] সকলো স্থলপথ অচল হৈ পৰিছে। "
                "এনএইচ-৬ আৰু এনএইচ-২৭ দুয়োটা পথ বন্ধ। সুৰক্ষিত স্থানত থাকক; বিমান সেৱা পৰামৰ্শ সক্ৰিয় কৰা হৈছে। "
                f"জাননী: {self.authority_notice}"
            )
        elif request.is_blocked:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] RED ALERT: {corridor} is IMPASSABLE. "
                f"Blockage reason: {reason}. Rainfall: {rain:.1f}mm | Multi-hazard Risk Index: {risk:.1f}/10. "
                f"Transit prohibited. Notice: {self.authority_notice}"
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] रेड अलर्ट: {corridor} अवरुद्ध है। "
                f"बाधा का कारण: {reason}। वर्षा: {rain:.1f} मिमी | आपदा जोखिम सूचकांक: {risk:.1f}/10। "
                f"पारगमन निषेध। सूचना: {self.authority_notice}"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] ৰেড এলাৰ্ট: {corridor} বন্ধ হৈ পৰিছে। "
                f"বাধাৰ কাৰণ: {reason}। বৰষুণ: {rain:.1f} মিমি | দুৰ্যোগ বিপদাশংকা সূচক: {risk:.1f}/10। "
                f"যাতায়াত নিষিদ্ধ। জাননী: {self.authority_notice}"
            )
        elif request.is_detour:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] RECOMMENDED RESILIENT ROUTE: {corridor}. "
                f"Bypasses Sonapur Tunnel landslide chokepoint (+{detour_km:.1f}km, +{eta_min:.0f}min). "
                f"Maintain convoy caution near Haflong. Notice: {self.authority_notice}"
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] अनुशंसित लचीला मार्ग: {corridor}। "
                f"सोनापुर सुरंग भूस्खलन स्थल से बचाव (+{detour_km:.1f} किमी, +{eta_min:.0f} मिनट)। "
                f"हाफलोंग के पास काफिले में सावधानी से चलें। सूचना: {self.authority_notice}"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] অনুমোদন কৰা স্থিতিস্থাপক পথ: {corridor}। "
                f"সোণাপুৰ সুৰংগৰ ভূমিস্খলন এৰাই চলক (+{detour_km:.1f} কিমি, +{eta_min:.0f} মিনিট)। "
                f"হাফলং অঞ্চলত সাৱধানে গাড়ী চলাওক। জাননী: {self.authority_notice}"
            )
        else:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] {corridor} is PASSABLE under standard vigilance. "
                f"Multi-hazard Risk Index: {risk:.1f}/10 | 24h Rainfall: {rain:.1f}mm. "
                f"Maintain convoy spacing near chokepoints. Notice: {self.authority_notice}"
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] {corridor} सामान्य सतर्कता के साथ चालू है। "
                f"आपदा जोखिम सूचकांक: {risk:.1f}/10 | 24 घंटे की वर्षा: {rain:.1f} मिमी। "
                f"संवेदनशील स्थानों पर दूरी बनाए रखें। सूचना: {self.authority_notice}"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] {corridor} স্বাভাৱিক সতৰ্কতাৰ সৈতে খোলা আছে। "
                f"দুৰ্যোগ বিপদাশংকা সূচক: {risk:.1f}/10 | ২৪ ঘণ্টাৰ বৰষুণ: {rain:.1f} মিমি। "
                f"সুৰক্ষিত দূৰত্ব বজাই ৰাখক। জাননী: {self.authority_notice}"
            )

        return MultilingualAdvisory(en=en, hi=hi, as_=as_text)

    def _call_gemini_api(self, prompt: str, api_key: str) -> Dict[str, Any]:
        """Execute HTTP request to Google Gemini API with 2.0s strict socket timeout."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        req_body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        }
        data = json.dumps(req_body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2.0) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            candidates = resp_data.get("candidates", [])
            if not candidates:
                raise ValueError("No candidates returned from Gemini API")
            text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            return json.loads(text)

    def polish_advisory(self, request: AdvisoryPolishRequest) -> AdvisoryPolishResponse:
        """Polish emergency advisory using Gemini with deterministic fallback and kill-key resilience."""
        start_time = time.perf_counter()

        # Step 1: Render deterministic template as immediate ground truth
        deterministic_advisory = self.generate_deterministic_template(request)

        # Step 2: Kill-API-Key Check (PRD §11 AC-9)
        active_key = self.api_key if self.api_key is not None else os.environ.get("GEMINI_API_KEY", "")
        active_key = active_key.strip() if active_key else ""

        if not active_key:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return AdvisoryPolishResponse(
                advisory_brief=deterministic_advisory,
                is_fallback=True,
                source="template_fallback",
                fallback_reason="api_key_missing_or_killed",
                latency_ms=round(latency_ms, 2),
                authority=AUTHORITY_NAME,
                disclaimer=self.authority_notice,
                honesty_label=HonestyLabel.SIMULATION,
            )

        # Step 3: Attempt Gemini Polishing with 2.0s timeout
        status_term = "BLOCKED" if request.is_blocked else ("DETOUR" if request.is_detour else "OPEN")
        prompt = (
            "You are an emergency multilingual communications stylist for the NDMA MargSetu disaster lifeline system. "
            "Polish the following structured corridor facts for maximum clarity to truck drivers and emergency convoys.\n\n"
            f"FACTS:\n"
            f"- Corridor: {request.corridor_name}\n"
            f"- Status: {status_term}\n"
            f"- Multi-hazard Risk Index: {request.risk_score:.1f}/10\n"
            f"- Rainfall: {request.rainfall_mm:.1f}mm\n"
            f"- Veto/Hazard Trigger: {request.veto_reason or request.hazard_type or 'None'}\n"
            f"- Detour Distance: {request.detour_km or 0}km\n"
            f"- Authority: {AUTHORITY_NAME}\n"
            f"- Simulation Notice: {self.authority_notice}\n\n"
            "STRICT RULES:\n"
            "1. NEVER alter numbers, risk scores, distances, or coordinates.\n"
            "2. NEVER invent routes, road conditions, or claim live dispatch/rescue.\n"
            "3. You MUST include '[NDMA SIMULATION ADVISORY]' at the start of English text.\n"
            "4. You MUST retain the exact simulation disclosure 'SIMULATION — not connected to official NDMA systems' in all outputs.\n"
            "5. Return valid JSON only with exact schema: {\"en\": \"...\", \"hi\": \"...\", \"as\": \"...\"}"
        )

        try:
            parsed = self._call_gemini_api(prompt, active_key)
            en_text = parsed.get("en", "").strip()
            hi_text = parsed.get("hi", "").strip()
            as_text = (parsed.get("as") or parsed.get("as_") or "").strip()

            if not (en_text and hi_text and as_text):
                raise ValueError("Gemini output missing required language fields")

            # Enforce NDMA simulation disclaimer post-processing
            if self.authority_notice not in en_text:
                en_text = f"{en_text} Notice: {self.authority_notice}"
            if self.authority_notice not in hi_text:
                hi_text = f"{hi_text} सूचना: {self.authority_notice}"
            if self.authority_notice not in as_text:
                as_text = f"{as_text} জাননী: {self.authority_notice}"

            polished_advisory = MultilingualAdvisory(en=en_text, hi=hi_text, as_=as_text)
            latency_ms = (time.perf_counter() - start_time) * 1000.0

            return AdvisoryPolishResponse(
                advisory_brief=polished_advisory,
                is_fallback=False,
                source="gemini_polished",
                fallback_reason=None,
                latency_ms=round(latency_ms, 2),
                authority=AUTHORITY_NAME,
                disclaimer=self.authority_notice,
                honesty_label=HonestyLabel.SIMULATION,
            )

        except Exception as e:
            # Resilient failover: Catch all network/timeout/schema errors and return deterministic template
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return AdvisoryPolishResponse(
                advisory_brief=deterministic_advisory,
                is_fallback=True,
                source="template_fallback",
                fallback_reason=f"gemini_exception: {type(e).__name__}",
                latency_ms=round(latency_ms, 2),
                authority=AUTHORITY_NAME,
                disclaimer=self.authority_notice,
                honesty_label=HonestyLabel.SIMULATION,
            )

    def generate_advisory_text(
        self,
        corridor_name: str,
        is_blocked: bool,
        veto_reason: Optional[str] = None,
        risk_score: float = 0.0,
        rainfall_mm: float = 0.0,
    ) -> str:
        """Generate deterministic emergency advisory string (backward-compatible with Module 1)."""
        req = AdvisoryPolishRequest(
            corridor_name=corridor_name,
            is_blocked=is_blocked,
            veto_reason=veto_reason,
            risk_score=risk_score,
            rainfall_mm=rainfall_mm,
        )
        return self.generate_deterministic_template(req).en
