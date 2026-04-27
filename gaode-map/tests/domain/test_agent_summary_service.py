import asyncio
from types import SimpleNamespace

from modules.agent.schemas import AgentSummaryRequest, AnalysisSnapshot
from modules.agent.summary_service import (
    _validate_summary_pack_payload,
    evaluate_summary_readiness,
    generate_summary_pack,
    stream_generate_summary_pack,
)


def _ready_payload():
    return {
        "data_readiness": {
            "checked": True,
            "ready": True,
            "missing_tasks": [],
            "reused": ["poi", "h3", "population", "nightlight", "road"],
            "fetched": [],
        },
        "artifacts": {},
        "warnings": [],
        "error": "",
    }


def _structured_artifacts():
    return {
        "current_poi_structure_analysis": {
            "summary_text": "餐饮与购物供给占主导。",
            "dominant_categories": ["餐饮", "购物"],
            "structure_tags": ["餐饮主导", "生活消费主导"],
        },
        "current_h3_structure_analysis": {
            "distribution_pattern": "multi_core",
            "summary_text": "空间热点呈多核分布。",
        },
        "current_population_profile_analysis": {
            "summary_text": "常住人口基础稳定。",
            "total_population": 3200,
            "top_age_band": "25-44岁",
        },
        "current_nightlight_pattern_analysis": {
            "summary_text": "夜间活跃度中等偏弱。",
            "total_radiance": 120.0,
            "core_hotspot_count": 0,
        },
        "current_road_pattern_analysis": {
            "summary_text": "路网较密但聚集效应一般。",
            "node_count": 90,
            "edge_count": 124,
            "regression_r2": 0.12,
        },
        "current_business_profile": {
            "business_profile": "生活消费主导",
            "portrait": "更像社区型生活消费商业区。",
            "summary_text": "以餐饮和日常消费为主。",
            "business_types": ["餐饮主导", "购物配套较强"],
        },
        "current_area_character_labels": {
            "character_tags": ["社区消费", "餐饮配套"],
        },
        "current_commercial_hotspots": {
            "hotspot_mode": "multi_core",
            "summary_text": "核心较分散，跨区吸引力有限。",
            "core_zone_count": 2,
            "opportunity_zone_count": 3,
        },
    }


def _valid_summary_pack():
    return {
        "headline_judgment": {
            "summary": "社区型生活消费商业区，以餐饮和日常消费为核心。",
            "supporting_clause": "缺少中心型商业吸引力。",
        },
        "icsc_tags": ["餐饮主导", "购物配套较强"],
        "secondary_conclusions": [
            {
                "section_key": "spatial_structure",
                "title": "空间结构",
                "reasoning": "整体呈多核分布，但核心之间联系较弱。",
                "dimensions": [
                    {"key": "aggregation", "label": "聚集性", "conclusion": "热点形成，但集中度有限。"},
                    {"key": "mixing", "label": "混合性", "conclusion": "功能混合度中等。"},
                    {"key": "morphology", "label": "形态性", "conclusion": "整体偏分散。"},
                ],
            },
            {
                "section_key": "poi_structure",
                "title": "POI结构",
                "reasoning": "业态以生活消费和餐饮为主。",
            },
            {
                "section_key": "consumption_vitality",
                "title": "消费活力",
                "reasoning": "夜间活力偏弱，更依赖日间消费。",
            },
            {
                "section_key": "business_support",
                "title": "业态承接",
                "reasoning": "路网可以承接社区级消费，但难支撑更高能级集聚。",
            },
        ],
        "user_profile": {
            "headline": "本地居民为主的稳定消费人群",
            "traits": ["以周边社区居民为主", "高频低客单消费", "以便利和就近为核心决策"],
        },
        "behavior_inference": {
            "headline": "消费行为以日常补给型为主",
            "traits": ["高频餐饮和小额消费", "跨区域吸引力有限", "夜间活跃度偏弱"],
        },
        "evidence_refs": ["analysis_snapshot.poi_summary", "analysis_snapshot.h3.summary"],
        "confidence": "moderate",
    }


def _valid_summary_pack_new_schema():
    payload = dict(_valid_summary_pack())
    sections = payload.pop("secondary_conclusions")
    for section in sections:
        payload[section["section_key"]] = dict(section)
    return payload


def _request():
    return AgentSummaryRequest(
        conversation_id="summary-test",
        history_id="history-1",
        analysis_snapshot=AnalysisSnapshot(
            poi_summary={"total": 24},
            frontend_analysis={
                "poi": {
                    "category_stats": {
                        "labels": ["餐饮", "购物", "生活服务"],
                        "values": [18, 9, 5],
                    }
                }
            },
        ),
    )


def test_generate_summary_pack_marks_llm_unavailable(monkeypatch):
    async def fake_ensure(**_):
        return _ready_payload()

    async def fake_pack(**_):
        return SimpleNamespace(status="success", warnings=[], artifacts={}, error="")

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr("modules.agent.summary_service.run_area_character_pack", fake_pack)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": _structured_artifacts()},
    )
    monkeypatch.setattr("modules.agent.summary_service.is_llm_enabled", lambda: False)

    result = asyncio.run(generate_summary_pack(_request()))

    assert result.data_readiness.ready is True
    assert result.summary_pack == {}
    assert result.panel_payloads["summary_status"]["status"] == "llm_unavailable"
    assert result.panel_payloads["summary_status"]["generated"] is False
    assert result.panel_payloads["summary_status"]["error_code"] == "llm_unavailable"
    assert result.panel_payloads["summary_status"]["retryable"] is False


def test_evaluate_summary_readiness_uses_readonly_precheck(monkeypatch):
    seen = {}

    async def fake_ensure(**kwargs):
        seen["arguments"] = kwargs.get("arguments")
        return {
            "data_readiness": {
                "checked": True,
                "ready": False,
                "reused": ["poi", "nightlight"],
                "fetched": [],
            },
            "artifacts": {},
            "warnings": [],
            "error": "",
        }

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": {}},
    )

    result = asyncio.run(evaluate_summary_readiness(_request()))

    assert seen["arguments"] == {"auto_fetch": False}
    assert result.data_readiness.ready is False
    assert result.data_readiness.fetched == []
    assert result.error == ""


def test_generate_summary_pack_rejects_invalid_llm_payload(monkeypatch):
    async def fake_ensure(**_):
        return _ready_payload()

    async def fake_pack(**_):
        return SimpleNamespace(status="success", warnings=[], artifacts={}, error="")

    async def fake_generate(*_args, **_kwargs):
        return {}

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr("modules.agent.summary_service.run_area_character_pack", fake_pack)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": _structured_artifacts()},
    )
    monkeypatch.setattr("modules.agent.summary_service.is_llm_enabled", lambda: True)
    monkeypatch.setattr("modules.agent.summary_service._generate_summary_pack_with_llm", fake_generate)

    result = asyncio.run(generate_summary_pack(_request()))

    assert result.summary_pack == {}
    assert result.error == "summary_pack_invalid"
    assert result.panel_payloads["summary_status"]["status"] == "generation_failed"
    assert result.panel_payloads["summary_status"]["generated"] is False
    assert result.panel_payloads["summary_status"]["error_code"] == "schema_invalid"
    assert result.panel_payloads["summary_status"]["retryable"] is False


def test_validate_summary_pack_accepts_legacy_area_judgment_array():
    result = _validate_summary_pack_payload(
        _valid_summary_pack(),
        icsc_tags=["餐饮主导"],
        evidence_refs=["analysis_snapshot.poi_summary"],
    )

    assert result["spatial_structure"]["title"]
    assert result["business_support"]["reasoning"]
    assert "secondary_conclusions" not in result


def test_validate_summary_pack_requires_all_area_judgments():
    payload = _valid_summary_pack_new_schema()
    payload.pop("business_support")

    result = _validate_summary_pack_payload(
        payload,
        icsc_tags=["餐饮主导"],
        evidence_refs=["analysis_snapshot.poi_summary"],
    )

    assert result == {}


def test_generate_summary_pack_returns_new_schema(monkeypatch):
    async def fake_ensure(**_):
        return _ready_payload()

    async def fake_pack(**_):
        return SimpleNamespace(status="success", warnings=[], artifacts={}, error="")

    async def fake_generate(*_args, **_kwargs):
        return _valid_summary_pack_new_schema()

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr("modules.agent.summary_service.run_area_character_pack", fake_pack)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": _structured_artifacts()},
    )
    monkeypatch.setattr("modules.agent.summary_service.is_llm_enabled", lambda: True)
    monkeypatch.setattr("modules.agent.summary_service._generate_summary_pack_with_llm", fake_generate)

    result = asyncio.run(generate_summary_pack(_request()))

    assert result.error == ""
    assert result.summary_pack["headline_judgment"]["summary"].startswith("社区型生活消费商业区")
    assert "secondary_conclusions" not in result.summary_pack
    assert result.summary_pack["spatial_structure"]["title"]
    assert result.summary_pack["poi_structure"]["reasoning"]
    assert result.summary_pack["consumption_vitality"]["reasoning"]
    assert result.summary_pack["business_support"]["reasoning"]
    assert result.summary_pack["user_profile"]["headline"] == "本地居民为主的稳定消费人群"
    assert result.summary_pack["behavior_inference"]["traits"][0] == "高频餐饮和小额消费"
    assert result.summary_pack["icsc_tags"] == ["餐饮主导", "购物配套较强"]
    assert result.panel_payloads["summary_status"]["status"] == "ready"
def test_stream_generate_summary_pack_emits_section_events(monkeypatch):
    async def fake_ensure(**_):
        return _ready_payload()

    async def fake_pack(**_):
        return SimpleNamespace(status="success", warnings=[], artifacts={}, error="")

    async def fake_headline(*_args, **_kwargs):
        return {
            "summary": "社区型生活消费商业区",
            "supporting_clause": "以餐饮和购物配套为主。",
        }

    async def fake_section(section_key, *_args, **_kwargs):
        return dict(_valid_summary_pack_new_schema()[section_key])

    async def fake_profile(section_key, *_args, **_kwargs):
        payload = _valid_summary_pack()
        return dict(payload[section_key])

    async def fake_followups(*_args, **_kwargs):
        return ["解释结论依据", "展开业态建议", "转为执行清单"]

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr("modules.agent.summary_service.run_area_character_pack", fake_pack)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": _structured_artifacts()},
    )
    monkeypatch.setattr("modules.agent.summary_service.is_llm_enabled", lambda: True)
    monkeypatch.setattr("modules.agent.summary_service._generate_headline_section_with_llm", fake_headline)
    monkeypatch.setattr("modules.agent.summary_service._generate_summary_section_with_llm", fake_section)
    monkeypatch.setattr("modules.agent.summary_service._generate_profile_section_with_llm", fake_profile)
    monkeypatch.setattr("modules.agent.summary_service._generate_followup_questions_with_llm", fake_followups)

    async def collect():
        events = []
        async for event in stream_generate_summary_pack(_request()):
            events.append(event)
        return events

    events = asyncio.run(collect())

    event_types = [event.type for event in events]
    assert "section_start" in event_types
    assert "section_delta" in event_types
    assert "section_complete" in event_types
    assert event_types[-1] == "final"
    final_payload = events[-1].payload
    assert final_payload["summary_pack"]["headline_judgment"]["summary"] == "社区型生活消费商业区"
    assert "secondary_conclusions" not in final_payload["summary_pack"]
    assert final_payload["summary_pack"]["spatial_structure"]["title"]
    assert final_payload["summary_pack"]["followup_questions"][0] == "解释结论依据"
