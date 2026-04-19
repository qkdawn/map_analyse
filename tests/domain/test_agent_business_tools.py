import asyncio

import modules.agent.tool_adapters.business_tools as business_tools
import modules.agent.tool_adapters.scenario_tools as scenario_tools
from modules.agent.schemas import AnalysisSnapshot, ToolResult


def _snapshot_with_scope() -> AnalysisSnapshot:
    return AnalysisSnapshot(
        scope={
            "polygon": [
                [112.98, 28.19],
                [112.99, 28.19],
                [112.99, 28.20],
                [112.98, 28.20],
                [112.98, 28.19],
            ]
        }
    )


def test_run_business_site_advice_chains_l1_tools(monkeypatch):
    calls = []

    async def fake_fetch(*, arguments, snapshot, artifacts, question):
        del snapshot, question
        calls.append(("poi", dict(arguments)))
        assert arguments["keywords"] == "鍜栧暋鍘?
        return ToolResult(
            tool_name="fetch_pois_in_scope",
            status="success",
            result={"poi_count": 2},
            artifacts={
                "current_pois": [{"id": "coffee-1"}, {"id": "coffee-2"}],
                "current_poi_summary": {"total": 2, "types": arguments["types"], "keywords": arguments["keywords"]},
            },
        )

    async def fake_h3(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, question
        calls.append(("h3", {"poi_count": len(artifacts.get("current_pois") or [])}))
        return ToolResult(
            tool_name="compute_h3_metrics_from_scope_and_pois",
            status="success",
            result={"grid_count": 4, "poi_count": 2},
            artifacts={"current_h3_summary": {"grid_count": 4, "avg_density_poi_per_km2": 1.5}},
        )

    async def fake_population(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        calls.append(("population", {}))
        return ToolResult(
            tool_name="compute_population_overview_from_scope",
            status="success",
            artifacts={"current_population_summary": {"total_population": 1000}},
        )

    async def fake_nightlight(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        calls.append(("nightlight", {}))
        return ToolResult(
            tool_name="compute_nightlight_overview_from_scope",
            status="success",
            artifacts={"current_nightlight_summary": {"max_radiance": 6.0}},
        )

    async def fake_road(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        calls.append(("road", {}))
        return ToolResult(
            tool_name="compute_road_syntax_from_scope",
            status="success",
            artifacts={"current_road_summary": {"node_count": 5, "edge_count": 6}},
        )

    monkeypatch.setattr(business_tools, "fetch_pois_in_scope", fake_fetch)
    monkeypatch.setattr(business_tools, "compute_h3_metrics_from_scope_and_pois", fake_h3)
    monkeypatch.setattr(business_tools, "compute_population_overview_from_scope", fake_population)
    monkeypatch.setattr(business_tools, "compute_nightlight_overview_from_scope", fake_nightlight)
    monkeypatch.setattr(business_tools, "compute_road_syntax_from_scope", fake_road)

    snapshot = _snapshot_with_scope()
    artifacts = {"scope_polygon": snapshot.scope["polygon"]}

    result = asyncio.run(
        business_tools.run_business_site_advice(
            arguments={},
            snapshot=snapshot,
            artifacts=artifacts,
            question="鎴戞兂鍦ㄨ繖閲屽紑涓€瀹跺挅鍟″簵锛岀粰鎴戝缓璁?,
        )
    )

    assert result.status == "success"
    assert [name for name, _args in calls] == ["poi", "h3", "population", "nightlight", "road"]
    assert result.artifacts["business_site_advice"]["place_type"] == "鍜栧暋鍘?
    assert result.artifacts["current_poi_summary"]["total"] == 2
    assert result.artifacts["current_h3_summary"]["grid_count"] == 4
    assert result.artifacts["current_population_summary"]["total_population"] == 1000
    assert result.artifacts["current_nightlight_summary"]["max_radiance"] == 6.0
    assert result.artifacts["current_road_summary"]["node_count"] == 5


def test_run_business_site_advice_requires_resolved_place_type():
    snapshot = _snapshot_with_scope()
    result = asyncio.run(
        business_tools.run_business_site_advice(
            arguments={"place_type": "涓嶅瓨鍦ㄧ殑涓氭€?},
            snapshot=snapshot,
            artifacts={"scope_polygon": snapshot.scope["polygon"]},
            question="鎴戞兂鍦ㄨ繖閲屽紑涓€瀹朵笉瀛樺湪鐨勪笟鎬?,
        )
    )

    assert result.status == "failed"
    assert result.error == "unresolved_place_type"


def test_run_business_site_advice_degrades_optional_tool_failure(monkeypatch):
    async def fake_fetch(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        return ToolResult(
            tool_name="fetch_pois_in_scope",
            status="success",
            artifacts={"current_pois": [{"id": "coffee-1"}], "current_poi_summary": {"total": 1, "keywords": "鍜栧暋鍘?}},
        )

    async def fake_h3(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        return ToolResult(
            tool_name="compute_h3_metrics_from_scope_and_pois",
            status="success",
            artifacts={"current_h3_summary": {"grid_count": 2, "avg_density_poi_per_km2": 0.5}},
        )

    async def fake_failed(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        return ToolResult(tool_name="compute_population_overview_from_scope", status="failed", error="boom")

    monkeypatch.setattr(business_tools, "fetch_pois_in_scope", fake_fetch)
    monkeypatch.setattr(business_tools, "compute_h3_metrics_from_scope_and_pois", fake_h3)
    monkeypatch.setattr(business_tools, "compute_population_overview_from_scope", fake_failed)
    monkeypatch.setattr(business_tools, "compute_nightlight_overview_from_scope", fake_failed)
    monkeypatch.setattr(business_tools, "compute_road_syntax_from_scope", fake_failed)

    snapshot = _snapshot_with_scope()
    result = asyncio.run(
        business_tools.run_business_site_advice(
            arguments={"place_type": "鍜栧暋搴?},
            snapshot=snapshot,
            artifacts={"scope_polygon": snapshot.scope["polygon"]},
            question="鎴戞兂寮€鍜栧暋搴?,
        )
    )

    assert result.status == "success"
    assert any("宸查檷绾х户缁? in warning for warning in result.warnings)


def test_run_area_character_pack_returns_tags_and_evidence_chain(monkeypatch):
    async def fake_bundle(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        return ToolResult(
            tool_name="get_area_data_bundle",
            status="success",
            artifacts={
                "scope_polygon": [[112.98, 28.19], [112.99, 28.19], [112.99, 28.20], [112.98, 28.20], [112.98, 28.19]],
                "current_poi_summary": {"total": 120},
                "current_population_summary": {"total_population": 22000},
                "current_nightlight_summary": {"total_radiance": 1300},
                "current_road_summary": {"node_count": 1800, "edge_count": 1900},
            },
        )

    async def fake_poi(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, question
        return ToolResult(
            tool_name="analyze_poi_structure",
            status="success",
            artifacts=artifacts,
            result={"business_profile": "鐢熸椿娑堣垂涓诲"},
        )

    async def fake_spatial(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, question
        return ToolResult(tool_name="analyze_spatial_structure", status="success", artifacts=artifacts, result={"distribution_pattern": "single_core"})

    async def fake_labels(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        return ToolResult(
            tool_name="infer_area_labels",
            status="success",
            result={
                "character_tags": ["澶滈棿娑堣垂鍨嬬墖鍖?],
                "dominant_functions": ["椁愰ギ", "璐墿"],
                "activity_period": "鏅氶棿娲昏穬",
                "crowd_traits": ["骞撮緞涓绘 25-34宀?],
                "spatial_temperament": "璺綉缁嗗瘑銆佸彲杈炬€ц緝寮?,
                "rule_hits": [{"rule_id": "night_consumer_cluster"}],
                "confidence": "strong",
                "summary_text": "鍖哄煙鏍囩涓哄闂存秷璐瑰瀷鐗囧尯銆?,
            },
        )

    monkeypatch.setattr(scenario_tools, "get_area_data_bundle", fake_bundle)
    monkeypatch.setattr(scenario_tools, "analyze_poi_structure", fake_poi)
    monkeypatch.setattr(scenario_tools, "analyze_spatial_structure", fake_spatial)
    monkeypatch.setattr(scenario_tools, "infer_area_labels", fake_labels)
    monkeypatch.setattr(
        scenario_tools,
        "build_poi_structure_analysis",
        lambda snapshot, artifacts: {"dominant_categories": ["椁愰ギ"], "dining_ratio": 0.35, "evidence_ready": True},
    )
    monkeypatch.setattr(
        scenario_tools,
        "analyze_poi_mix",
        lambda snapshot, artifacts, poi_structure: {"business_profile": "鐢熸椿娑堣垂涓诲", "dominant_functions": ["椁愰ギ", "璐墿"]},
    )
    monkeypatch.setattr(
        scenario_tools,
        "build_population_profile_analysis",
        lambda snapshot, artifacts: {"top_age_band": "25-34宀?, "total_population": 22000},
    )
    monkeypatch.setattr(
        scenario_tools,
        "build_nightlight_pattern_analysis",
        lambda snapshot, artifacts: {"core_hotspot_count": 2},
    )
    monkeypatch.setattr(
        scenario_tools,
        "build_road_pattern_analysis",
        lambda snapshot, artifacts: {"node_count": 1800},
    )
    monkeypatch.setattr(
        scenario_tools,
        "infer_area_character_labels",
        lambda snapshot, artifacts, **kwargs: {
            "character_tags": ["澶滈棿娑堣垂鍨嬬墖鍖?],
            "dominant_functions": ["椁愰ギ", "璐墿"],
            "activity_period": "鏅氶棿娲昏穬",
            "crowd_traits": ["骞撮緞涓绘 25-34宀?],
            "spatial_temperament": "璺綉缁嗗瘑銆佸彲杈炬€ц緝寮?,
            "rule_hits": [{"rule_id": "night_consumer_cluster"}],
            "confidence": "strong",
            "summary_text": "鍖哄煙鏍囩涓哄闂存秷璐瑰瀷鐗囧尯銆?,
        },
    )

    result = asyncio.run(
        scenario_tools.run_area_character_pack(
            arguments={"policy_key": "district_summary"},
            snapshot=_snapshot_with_scope(),
            artifacts={"scope_polygon": _snapshot_with_scope().scope["polygon"]},
            question="鎬荤粨杩欎釜鍖哄煙鐨勫晢涓氱壒寰?,
        )
    )

    assert result.status == "success"
    assert result.result["character_tags"] == ["澶滈棿娑堣垂鍨嬬墖鍖?]
    assert result.result["dominant_functions"] == ["椁愰ギ", "璐墿"]
    assert result.result["evidence_chain"]


def test_run_site_selection_pack_returns_ranking(monkeypatch):
    async def fake_business(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, question
        return ToolResult(
            tool_name="run_business_site_advice",
            status="success",
            result={"place_type": "鍜栧暋鍘?, "poi_count": 5},
            artifacts={**artifacts, "current_poi_summary": {"total": 5}},
        )

    async def fake_gap(*, arguments, snapshot, artifacts, question):
        del arguments, snapshot, artifacts, question
        return ToolResult(
            tool_name="analyze_target_supply_gap",
            status="success",
            result={"place_type": "鍜栧暋鍘?, "candidate_zones": [{"display_title": "鍊欓€?锛氫汉姘戣矾闄勮繎", "approx_address": "浜烘皯璺檮杩?}]},
        )

    monkeypatch.setattr(scenario_tools, "run_business_site_advice", fake_business)
    monkeypatch.setattr(scenario_tools, "analyze_target_supply_gap_from_scope", fake_gap)
    monkeypatch.setattr(
        scenario_tools,
        "build_population_profile_analysis",
        lambda snapshot, artifacts: {"total_population": 20000, "density_level": "medium"},
    )
    monkeypatch.setattr(
        scenario_tools,
        "build_nightlight_pattern_analysis",
        lambda snapshot, artifacts: {"core_hotspot_count": 2, "peak_to_edge_ratio": 2.2},
    )
    monkeypatch.setattr(
        scenario_tools,
        "build_road_pattern_analysis",
        lambda snapshot, artifacts: {"node_count": 1800, "edge_count": 1900},
    )
    monkeypatch.setattr(
        scenario_tools,
        "score_site_candidates",
        lambda snapshot, artifacts, **kwargs: {
            "candidate_sites": [{"rank": 1, "display_title": "鍊欓€?锛氫汉姘戣矾闄勮繎", "total_score": 81.0, "strengths": ["渚涚粰缂哄彛鏄庢樉"], "risks": ["闇€澶嶆牳绉熼噾"]}],
            "ranking": [{"rank": 1, "title": "鍊欓€?锛氫汉姘戣矾闄勮繎", "total_score": 81.0}],
            "strengths": ["渚涚粰缂哄彛鏄庢樉"],
            "risks": ["闇€澶嶆牳绉熼噾"],
            "not_recommended_reason": "浣庢帓鍚嶇偣浣嶅湪鍙揪鎬ф垨娲诲姏涓婂亸寮便€?,
            "confidence": "moderate",
            "summary_text": "宸插畬鎴?1 涓€欓€夊尯鎵撳垎鎺掑簭銆?,
        },
    )

    result = asyncio.run(
        scenario_tools.run_site_selection_pack(
            arguments={"place_type": "鍜栧暋鍘?, "policy_key": "business_catchment_1km"},
            snapshot=_snapshot_with_scope(),
            artifacts={"scope_polygon": _snapshot_with_scope().scope["polygon"]},
            question="鎴戞兂鍦ㄨ繖閲屽紑涓€瀹跺挅鍟″簵锛岀粰鎴戝缓璁?,
        )
    )

    assert result.status == "success"
    assert result.result["ranking"][0]["title"] == "鍊欓€?锛氫汉姘戣矾闄勮繎"
    assert result.result["candidate_sites"][0]["total_score"] == 81.0

