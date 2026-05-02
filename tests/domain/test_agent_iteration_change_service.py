import asyncio

from modules.agent.iteration_change_service import generate_poi_iteration_analysis


def test_generate_poi_iteration_analysis_validates_llm_payload(monkeypatch):
    monkeypatch.setattr("modules.agent.iteration_change_service.is_llm_enabled", lambda: True)

    async def fake_invoke(**kwargs):
        assert kwargs["user_payload"]["task"] == "poi_iteration_change"
        assert kwargs["user_payload"]["evidence"]["years"] == [2023, 2024, 2025]
        return {
            "summary_points": ["POI规模中等", "餐饮为主导业态", "岳麓区为核心区域"],
            "fastest_growth": "咖啡 +120%",
            "declining_category": "传统零售 -35%",
            "emerging_area": "大学城片区",
            "structure_judgement": "业态结构偏消费型",
        }

    monkeypatch.setattr("modules.agent.iteration_change_service._invoke_json_role", fake_invoke)

    result = asyncio.run(generate_poi_iteration_analysis({"years": [2023, 2024, 2025]}))

    assert result["status"] == "ready"
    assert result["ai_summary"][0] == "POI规模中等"
    assert result["ai_insights"]["emerging_area"] == "大学城片区"


def test_generate_poi_iteration_analysis_returns_llm_unavailable(monkeypatch):
    monkeypatch.setattr("modules.agent.iteration_change_service.is_llm_enabled", lambda: False)

    result = asyncio.run(generate_poi_iteration_analysis({"years": [2023, 2024, 2025]}))

    assert result["status"] == "failed"
    assert result["error"] == "llm_unavailable"
