from __future__ import annotations

from typing import Any, Dict, List

from .schemas import AgentEvidenceItem, AnalysisSnapshot
from .synthesis_metrics import build_summary_metrics


def evidence_confidence(value: Any, *, source_available: bool = True) -> str:
    if value in (None, "", [], {}):
        return "weak"
    return "moderate" if source_available else "weak"


def build_analysis_evidence(snapshot: AnalysisSnapshot, artifacts: Dict[str, object]) -> List[AgentEvidenceItem]:
    metrics = build_summary_metrics(snapshot, artifacts)
    evidence: List[AgentEvidenceItem] = []
    if metrics["business_profile_label"]:
        evidence.append(AgentEvidenceItem(metric="business_profile", value={"business_profile": metrics["business_profile_label"], "portrait": metrics["business_profile_portrait"], "functional_mix_score": metrics["functional_mix_score"]}, interpretation="鍩轰簬 POI 涓氭€佺粨鏋勬彁鐐肩殑鍖哄煙鍟嗕笟鐢诲儚锛屽彲鐩存帴鏀拺鈥滆繖鏄粈涔堟牱鐨勫晢涓氬尯鈥濊繖绫诲垽鏂€?", source="current_business_profile / current_poi_structure_analysis", confidence="moderate", limitation="鍟嗕笟鐢诲儚鍙嶆槧渚涚粰缁撴瀯锛屼笉鐩存帴绛夊悓浜庢秷璐硅兘鍔涖€佸娴佹垨缁忚惀琛ㄧ幇銆?"))
    if metrics["commercial_hotspot_mode"]:
        evidence.append(AgentEvidenceItem(metric="commercial_hotspots", value={"hotspot_mode": metrics["commercial_hotspot_mode"], "core_zone_count": metrics["core_zone_count"], "opportunity_zone_count": metrics["opportunity_zone_count"]}, interpretation="绌洪棿鐑偣缁撴瀯鐢ㄤ簬鍒ゆ柇鍖哄煙鏄崟鏍搞€佸鏍搞€佽蛋寤婅繕鏄鏁ｅ垎甯冦€?", source="current_commercial_hotspots / current_h3_structure_analysis", confidence="moderate", limitation="鐑偣缁撴瀯鍙兘璇存槑绌洪棿鍒嗗竷褰㈡€侊紝涓嶈兘鐩存帴浠ｈ〃鍟嗕笟鏀剁泭楂樹綆銆?"))
    if metrics["target_supply_gap_level"]:
        evidence.append(AgentEvidenceItem(metric="target_supply_gap", value={"place_type": metrics["target_supply_gap_place_type"], "supply_gap_level": metrics["target_supply_gap_level"], "gap_mode": metrics["target_supply_gap_mode"]}, interpretation="渚涚粰缂哄彛缁撴灉鐢ㄤ簬鍒ゆ柇鐩爣涓氭€佹槸鎬婚噺涓嶈冻杩樻槸绌洪棿閿欓厤銆?", source="current_target_supply_gap / current_h3_structure_analysis", confidence="moderate", limitation="缂哄彛鍒ゆ柇鍙唬琛ㄦ柟鍚戞€х粨鏋勬満浼氾紝涓嶇洿鎺ヤ唬琛ㄥ紑搴楁垚鍔熺巼鎴栨敹鐩娿€?"))
    if metrics["business_place_type"]:
        evidence.append(AgentEvidenceItem(metric="business_site_advice", value={"place_type": metrics["business_place_type"], "types": metrics["business_types"], "keywords": metrics["business_keywords"]}, interpretation="鐩爣涓氭€佸凡瑙ｆ瀽涓烘爣鍑?POI 绫诲瀷锛屽悗缁緵缁欍€佸瘑搴﹀拰绌洪棿璇佹嵁鍥寸粫璇ヤ笟鎬佺粍缁囥€?", source="business_site_advice", confidence="moderate", limitation="鐩爣涓氭€佽В鏋愬彧浠ｈ〃 POI 妫€绱㈠彛寰勶紝涓嶄唬琛ㄧ粡钀ュ彲琛屾€х粨璁恒€?"))
    if metrics["poi_count"] is not None:
        evidence.append(AgentEvidenceItem(metric="poi_count", value=metrics["poi_count"], interpretation="鍖哄煙鍐?POI 渚涚粰鏍锋湰閲忥紝鍙敤浜庡垽鏂晢涓氫緵缁欏熀纭€銆?", source="analysis_snapshot.poi_summary / current_pois", confidence=evidence_confidence(metrics["poi_count"]), limitation="POI 鏁伴噺涓嶈兘鐩存帴绛夊悓浜庡娴併€佹秷璐硅兘鍔涙垨缁忚惀鏀剁泭銆?"))
    if metrics["h3_grid_count"] or metrics["avg_density_poi_per_km2"] is not None:
        evidence.append(AgentEvidenceItem(metric="h3_density", value={"grid_count": metrics["h3_grid_count"], "avg_density_poi_per_km2": metrics["avg_density_poi_per_km2"]}, interpretation="H3 缃戞牸鍜?POI 瀵嗗害鍙敤浜庤瀵熺┖闂翠緵缁欏垎甯冧笌鐩稿瀵嗛泦绋嬪害銆?", source="analysis_snapshot.h3.summary / current_h3_summary", confidence=evidence_confidence(metrics["h3_grid_count"]), limitation="缂哄皯绔炲搧璐ㄩ噺銆佺閲戝拰瀹炲湴瀹㈡祦鏃讹紝鍙兘缁欐柟鍚戞€х┖闂村垽鏂€?"))
    if metrics["road_node_count"] or metrics["road_edge_count"]:
        evidence.append(AgentEvidenceItem(metric="road_structure", value={"node_count": metrics["road_node_count"], "edge_count": metrics["road_edge_count"]}, interpretation="璺綉鑺傜偣涓庤竟娈佃妯″彲杈呭姪鍒ゆ柇閫氳揪鎬у拰璺綉澶嶆潅搴︺€?", source="analysis_snapshot.road.summary / current_road_summary", confidence=evidence_confidence(metrics["road_node_count"] or metrics["road_edge_count"]), limitation="浠呭嚟鑺傜偣/杈规鏁伴噺涓嶈兘鍒ゆ柇鐪熷疄鍑鸿鏃堕棿鍜岄亾璺嫢鍫点€?"))
    if metrics["population_total"] is not None:
        evidence.append(AgentEvidenceItem(metric="population_profile", value={"total_population": metrics["population_total"], "male_ratio": metrics["population_male_ratio"], "female_ratio": metrics["population_female_ratio"]}, interpretation="浜哄彛鎬婚噺涓庢€у埆缁撴瀯鍙緟鍔╁垽鏂父浣忎汉缇ゅ熀纭€銆?", source="analysis_snapshot.population.summary / current_population_summary", confidence=evidence_confidence(metrics["population_total"]), limitation="浜哄彛姒傝涓嶈兘鐩存帴鎺ㄦ柇娑堣垂鑳藉姏鎴栧叿浣撳缇ゅ亸濂姐€?"))
    if metrics["nightlight_peak_radiance"] is not None or metrics["nightlight_mean_radiance"] is not None:
        evidence.append(AgentEvidenceItem(metric="nightlight_activity", value={"total_radiance": metrics["nightlight_total_radiance"], "mean_radiance": metrics["nightlight_mean_radiance"], "peak_radiance": metrics["nightlight_peak_radiance"], "lit_pixel_ratio": metrics["nightlight_lit_pixel_ratio"]}, interpretation="澶滃厜寮哄害鍙綔涓哄闂存椿鍔涘拰寤烘垚娲诲姩鐨勮緟鍔╀俊鍙枫€?", source="analysis_snapshot.nightlight.summary / current_nightlight_summary", confidence=evidence_confidence(metrics["nightlight_peak_radiance"] or metrics["nightlight_mean_radiance"]), limitation="澶滃厜鍙兘浣滀负娲诲姏 proxy锛屼笉鑳界洿鎺ヤ唬琛ㄨ惀涓氶鎴栧娴併€?"))
    return evidence
