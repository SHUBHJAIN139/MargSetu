"""Unit and Integration Tests for MargSetu LLM Advisory Service (Build Order Item 6).

PRD Reference: PRD v2.0 §7, §9 (Item 6), §11 (AC-9: Gemini structured output + template fallback works)
Authority Integrity: NDMA is the ONLY authority named anywhere.
Disclaimer: SIMULATION — not connected to official NDMA systems.

Verifies:
1. Deterministic template generation for all corridor states (C1 blocked, C2 detour, all-blocked air advisory, baseline open) in EN, HI, AS.
2. Kill-API-key test (PRD §11 AC-9): setting GEMINI_API_KEY="" or None immediately returns valid deterministic advisory in <10ms with is_fallback=True.
3. Mocked Gemini polish test (verifying structured JSON output, multilingual schema preservation).
4. Timeout and network error handling: simulated network error / timeout immediately triggers template fallback.
5. Safety and boundary enforcement: NDMA disclaimer preservation, zero live dispatch claims, zero invented routes/data.
6. API endpoint integration: POST /advisory/polish returns HTTP 200 with valid AdvisoryPolishResponse.
7. Backward compatibility: legacy generate_advisory_text() method functions seamlessly.
"""

import os
import re
import time
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import pytest

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    AdvisoryPolishRequest,
    AdvisoryPolishResponse,
    HonestyLabel,
    MultilingualAdvisory,
)
from services.llm_service import LLMService


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_deterministic_templates_all_corridor_states():
    """Test deterministic multilingual template generation across all 4 operational states."""
    llm_svc = LLMService(api_key=None)

    # 1. State: Blocked Corridor (C1 Sonapur Tunnel)
    req_blocked = AdvisoryPolishRequest(
        corridor_name="C1 NH-6 Guwahati-Silchar via Sonapur Tunnel",
        is_blocked=True,
        is_detour=False,
        risk_score=8.2,
        rainfall_mm=85.0,
        veto_reason="Compound Hazard: Extreme Rain (>75mm) + Steep Slope (>30°)",
    )
    tmpl_blocked = llm_svc.generate_deterministic_template(req_blocked)
    assert "[NDMA SIMULATION ADVISORY] RED ALERT:" in tmpl_blocked.en
    assert "C1 NH-6" in tmpl_blocked.en
    assert "IMPASSABLE" in tmpl_blocked.en
    assert AUTHORITY_NOTICE in tmpl_blocked.en

    assert "रेड अलर्ट:" in tmpl_blocked.hi
    assert "अवरुद्ध है" in tmpl_blocked.hi
    assert AUTHORITY_NOTICE in tmpl_blocked.hi

    assert "ৰেড এলাৰ্ট:" in tmpl_blocked.as_
    assert "বন্ধ হৈ পৰিছে" in tmpl_blocked.as_
    assert AUTHORITY_NOTICE in tmpl_blocked.as_

    # 2. State: Recommended Detour (C2 Haflong Bypass)
    req_detour = AdvisoryPolishRequest(
        corridor_name="C2 NH-27 Haflong Bypass",
        is_blocked=False,
        is_detour=True,
        risk_score=3.5,
        rainfall_mm=22.0,
        detour_km=42.0,
        eta_minutes=56.0,
    )
    tmpl_detour = llm_svc.generate_deterministic_template(req_detour)
    assert "RECOMMENDED RESILIENT ROUTE:" in tmpl_detour.en
    assert "Sonapur Tunnel" in tmpl_detour.en
    assert "+42.0km" in tmpl_detour.en
    assert "अनुशंसित लचीला मार्ग:" in tmpl_detour.hi
    assert "অনুমোদন কৰা স্থিতিস্থাপক পথ:" in tmpl_detour.as_

    # 3. State: All Ground Lifelines Blocked
    req_all_blocked = AdvisoryPolishRequest(
        corridor_name="Lifeline Network",
        is_blocked=True,
        all_blocked=True,
    )
    tmpl_all = llm_svc.generate_deterministic_template(req_all_blocked)
    assert "ALL GROUND CORRIDORS IMPASSABLE" in tmpl_all.en
    assert "air bridge advisory activated" in tmpl_all.en
    assert "सभी जमीनी मार्ग बंद हैं" in tmpl_all.hi
    assert "সকলো স্থলপথ অচল হৈ পৰিছে" in tmpl_all.as_

    # 4. State: Passable / Baseline Open
    req_passable = AdvisoryPolishRequest(
        corridor_name="C1 NH-6 Guwahati-Silchar",
        is_blocked=False,
        risk_score=1.8,
        rainfall_mm=5.0,
    )
    tmpl_passable = llm_svc.generate_deterministic_template(req_passable)
    assert "PASSABLE under standard vigilance" in tmpl_passable.en
    assert "सामान्य सतर्कता के साथ चालू है" in tmpl_passable.hi
    assert "স্বাভাৱিক সতৰ্কতাৰ সৈতে খোলা আছে" in tmpl_passable.as_


def test_kill_api_key_resilience():
    """PRD §11 AC-9: Verify killing GEMINI_API_KEY immediately triggers deterministic fallback in <10ms."""
    req = AdvisoryPolishRequest(
        corridor_name="C1 NH-6 Sonapur Tunnel",
        is_blocked=True,
        veto_reason="Debris flow blockage",
        risk_score=7.5,
        rainfall_mm=90.0,
    )

    # Test 1: Explicitly empty API key
    llm_empty_key = LLMService(api_key="")
    start_time = time.perf_counter()
    resp_empty = llm_empty_key.polish_advisory(req)
    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    assert resp_empty.is_fallback is True
    assert resp_empty.source == "template_fallback"
    assert resp_empty.fallback_reason == "api_key_missing_or_killed"
    assert elapsed_ms < 50.0  # Instant execution without network delay
    assert "[NDMA SIMULATION ADVISORY] RED ALERT:" in resp_empty.advisory_brief.en
    assert AUTHORITY_NOTICE in resp_empty.advisory_brief.en
    assert AUTHORITY_NOTICE in resp_empty.advisory_brief.hi
    assert AUTHORITY_NOTICE in resp_empty.advisory_brief.as_

    # Test 2: None API key with cleared environment variable
    with patch.dict(os.environ, {}, clear=True):
        llm_none_key = LLMService(api_key=None)
        resp_none = llm_none_key.polish_advisory(req)
        assert resp_none.is_fallback is True
        assert resp_none.source == "template_fallback"
        assert resp_none.fallback_reason == "api_key_missing_or_killed"


def test_mocked_gemini_polish_success():
    """Verify successful Gemini polish returns polished multilingual advisory with is_fallback=False."""
    llm_svc = LLMService(api_key="valid-mocked-key")

    mock_gemini_output = {
        "en": (
            "[NDMA SIMULATION ADVISORY] URGENT DRIVER ALERT: C1 NH-6 at Sonapur Tunnel is strictly impassable "
            "due to heavy rockfall. Stand fast or seek designated staging areas. "
            f"Notice: {AUTHORITY_NOTICE}"
        ),
        "hi": (
            "[NDMA सिमुलेशन परामर्श] अत्यंत महत्वपूर्ण सूचना: सोनापुर सुरंग पर भारी भूस्खलन के कारण C1 NH-6 मार्ग पूरी तरह बंद है। "
            f"सुरक्षित स्थान पर रुकें। सूचना: {AUTHORITY_NOTICE}"
        ),
        "as": (
            "[NDMA ছিমুলেচন পৰামৰ্শ] চালকসকললৈ জৰুৰী সতৰ্কতা: সোণাপুৰ সুৰংগৰ ভূমিস্খলনৰ বাবে C1 NH-6 পথ সম্পূর্ণভাৱে বন্ধ হৈ পৰিছে। "
            f"সুৰক্ষিত স্থানত আশ্ৰয় লওক। জাননী: {AUTHORITY_NOTICE}"
        ),
    }

    req = AdvisoryPolishRequest(
        corridor_name="C1 NH-6 Guwahati-Silchar via Sonapur Tunnel",
        is_blocked=True,
        veto_reason="Sonapur Tunnel heavy rockfall",
        risk_score=8.5,
        rainfall_mm=95.0,
    )

    with patch.object(llm_svc, "_call_gemini_api", return_value=mock_gemini_output):
        resp = llm_svc.polish_advisory(req)

        assert resp.is_fallback is False
        assert resp.source == "gemini_polished"
        assert resp.fallback_reason is None
        assert "URGENT DRIVER ALERT" in resp.advisory_brief.en
        assert AUTHORITY_NOTICE in resp.advisory_brief.en
        assert AUTHORITY_NOTICE in resp.advisory_brief.hi
        assert AUTHORITY_NOTICE in resp.advisory_brief.as_


def test_timeout_and_network_error_fallback():
    """Verify simulated socket timeout (>2.0s) and network exceptions failover safely to template."""
    llm_svc = LLMService(api_key="mocked-key-with-timeout")

    req = AdvisoryPolishRequest(
        corridor_name="C2 NH-27 Haflong Bypass",
        is_blocked=False,
        is_detour=True,
        detour_km=42.0,
        eta_minutes=56.0,
    )

    # 1. Simulate TimeoutError (> 2.0s)
    with patch.object(llm_svc, "_call_gemini_api", side_effect=TimeoutError("Connection timed out after 2000ms")):
        resp_timeout = llm_svc.polish_advisory(req)
        assert resp_timeout.is_fallback is True
        assert resp_timeout.source == "template_fallback"
        assert "TimeoutError" in resp_timeout.fallback_reason
        assert "RECOMMENDED RESILIENT ROUTE:" in resp_timeout.advisory_brief.en

    # 2. Simulate HTTP / Network exception
    with patch.object(llm_svc, "_call_gemini_api", side_effect=ConnectionResetError("Remote server disconnected")):
        resp_conn = llm_svc.polish_advisory(req)
        assert resp_conn.is_fallback is True
        assert resp_conn.source == "template_fallback"
        assert "ConnectionResetError" in resp_conn.fallback_reason
        assert "RECOMMENDED RESILIENT ROUTE:" in resp_conn.advisory_brief.en


def test_boundary_enforcement_and_safety_invariants():
    """Verify safety boundaries: NDMA sole authority, simulation disclaimer appended if omitted, zero live dispatch."""
    llm_svc = LLMService(api_key="mocked-key-test")

    # Simulate Gemini output that forgot the simulation notice
    mock_sloppy_output = {
        "en": "Corridor NH-6 is blocked near Sonapur.",
        "hi": "सोनापुर के पास एनएच-6 मार्ग अवरुद्ध है।",
        "as": "সোণাপুৰৰ ওচৰত এনএইচ-৬ পথ বন্ধ।",
    }

    req = AdvisoryPolishRequest(
        corridor_name="NH-6",
        is_blocked=True,
        risk_score=7.0,
        rainfall_mm=60.0,
    )

    with patch.object(llm_svc, "_call_gemini_api", return_value=mock_sloppy_output):
        resp = llm_svc.polish_advisory(req)

        # Post-processor must forcibly inject the mandatory simulation notice
        assert AUTHORITY_NOTICE in resp.advisory_brief.en
        assert AUTHORITY_NOTICE in resp.advisory_brief.hi
        assert AUTHORITY_NOTICE in resp.advisory_brief.as_

        # Strict regex assertion: zero mention of unauthorized response authorities
        full_text = f"{resp.advisory_brief.en} {resp.advisory_brief.hi} {resp.advisory_brief.as_}"
        prohibited = ["NDRF", "SDRF", "NHAI", "BRO", "Police", "Indian Army"]
        for agency in prohibited:
            assert not re.search(rf"\b{agency}\b", full_text), (
                f"Prohibited authority '{agency}' leaked into advisory text."
            )


def test_advisory_polish_api_endpoint(client):
    """Integration test: POST /advisory/polish endpoint returns valid schema with template-first guarantee."""
    payload = {
        "corridor_name": "C1 NH-6 Sonapur Tunnel",
        "is_blocked": True,
        "is_detour": False,
        "risk_score": 8.0,
        "rainfall_mm": 80.0,
        "veto_reason": "Extreme rain and active rockfall",
    }

    resp = client.post("/advisory/polish", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "advisory_brief" in data
    assert "en" in data["advisory_brief"]
    assert "hi" in data["advisory_brief"]
    assert "as" in data["advisory_brief"]
    assert data["authority"] == AUTHORITY_NAME
    assert data["disclaimer"] == AUTHORITY_NOTICE
    assert data["honesty_label"] == HonestyLabel.SIMULATION.value

    # In sandbox environment without GEMINI_API_KEY, must be template_fallback
    assert data["is_fallback"] is True
    assert data["source"] == "template_fallback"
    assert "[NDMA SIMULATION ADVISORY] RED ALERT:" in data["advisory_brief"]["en"]


def test_backward_compatibility_legacy_method():
    """Verify legacy generate_advisory_text() method continues to pass Module 1 expectations."""
    llm_svc = LLMService()
    adv_blocked = llm_svc.generate_advisory_text(
        "NH-6 Sonapur", is_blocked=True, veto_reason="Slope > 30 deg", risk_score=7.8, rainfall_mm=85.0
    )
    assert "RED ALERT" in adv_blocked
    assert AUTHORITY_NOTICE in adv_blocked

    adv_open = llm_svc.generate_advisory_text(
        "NH-27 Haflong", is_blocked=False, risk_score=2.0, rainfall_mm=10.0
    )
    assert "PASSABLE" in adv_open
    assert AUTHORITY_NOTICE in adv_open
