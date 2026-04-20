import asyncio
from types import SimpleNamespace

from modules.agent.schemas import AgentSummaryRequest, AnalysisSnapshot
from modules.agent.summary_service import generate_summary_pack


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
            "summary_text": "空间热点呈多核心分布。",
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


def _request():
    return AgentSummaryRequest(
        conversation_id="summary-test",
        analysis_fingerprint="fp-1",
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

    assert result.data_readiness["ready"] is True
    assert result.summary_pack == {}
    assert result.panel_payloads["summary_status"]["status"] == "llm_unavailable"
    assert result.panel_payloads["summary_status"]["generated"] is False
    assert result.panel_payloads["summary_status"]["error_code"] == "llm_unavailable"
    assert result.panel_payloads["summary_status"]["retryable"] is False
    assert "one_line_conclusion" not in result.panel_payloads.get("summary_pack", {})


def test_generate_summary_pack_rejects_invalid_llm_payload(monkeypatch):
    async def fake_ensure(**_):
        return _ready_payload()

    async def fake_pack(**_):
        return SimpleNamespace(status="success", warnings=[], artifacts={}, error="")

    async def fake_llm(**_):
        return {
            "headline_judgment": {"summary": "社区型生活消费商业区"},
            "secondary_conclusions": [{"title": "业态偏刚需", "reasoning": "以餐饮为主"}],
        }

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr("modules.agent.summary_service.run_area_character_pack", fake_pack)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": _structured_artifacts()},
    )
    monkeypatch.setattr("modules.agent.summary_service.is_llm_enabled", lambda: True)
    monkeypatch.setattr("modules.agent.summary_service._invoke_json_role", fake_llm)

    result = asyncio.run(generate_summary_pack(_request()))

    assert result.summary_pack == {}
    assert result.error == "summary_pack_invalid"
    assert result.panel_payloads["summary_status"]["status"] == "generation_failed"
    assert result.panel_payloads["summary_status"]["generated"] is False
    assert result.panel_payloads["summary_status"]["error_code"] in {"schema_invalid", "llm_invalid_json"}
    assert result.panel_payloads["summary_status"]["retryable"] is True


def test_generate_summary_pack_returns_new_schema(monkeypatch):
    async def fake_ensure(**_):
        return _ready_payload()

    async def fake_pack(**_):
        return SimpleNamespace(status="success", warnings=[], artifacts={}, error="")

    async def fake_llm(**_):
        return {
            "headline_judgment": {
                "summary": "社区型生活消费商业区，以餐饮和日常消费为核心。",
                "supporting_clause": "缺少中心型商业吸引力。",
            },
            "secondary_conclusions": [
                {"title": "业态结构偏刚需消费", "reasoning": "餐饮与日常消费占主导，目的性消费不足。"},
                {"title": "商业能级较低", "reasoning": "多核心但分散，尚未形成强中心。"},
                {"title": "可达性一般", "reasoning": "路网有支撑，但难形成明显聚集效应。"},
            ],
            "user_profile": {
                "headline": "本地居民为主的稳定消费人群",
                "traits": ["以周边社区居民为主", "高频低客单消费", "以便利和就近为核心决策"],
            },
            "behavior_inference": {
                "headline": "消费行为以日常补给型为主",
                "traits": ["高频餐饮和小额消费", "跨区域吸引力有限", "夜间活跃度偏弱"],
            },
        }

    monkeypatch.setattr("modules.agent.summary_service.ensure_area_data_readiness", fake_ensure)
    monkeypatch.setattr("modules.agent.summary_service.run_area_character_pack", fake_pack)
    monkeypatch.setattr(
        "modules.agent.summary_service._derive_structured_status",
        lambda snapshot, artifacts: {"missing_tasks": [], "artifacts": _structured_artifacts()},
    )
    monkeypatch.setattr("modules.agent.summary_service.is_llm_enabled", lambda: True)
    monkeypatch.setattr("modules.agent.summary_service._invoke_json_role", fake_llm)

    result = asyncio.run(generate_summary_pack(_request()))

    assert result.error == ""
    assert result.summary_pack["headline_judgment"]["summary"].startswith("社区型生活消费商业区")
    assert len(result.summary_pack["secondary_conclusions"]) == 3
    assert result.summary_pack["user_profile"]["headline"] == "本地居民为主的稳定消费人群"
    assert result.summary_pack["behavior_inference"]["traits"][0] == "高频餐饮和小额消费"
    assert result.summary_pack["icsc_tags"] == ["餐饮主导", "购物配套较强"]
    assert "one_line_conclusion" not in result.summary_pack
    assert result.panel_payloads["summary_status"]["status"] == "ready"
