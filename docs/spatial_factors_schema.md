# spatial_factors 输出规范

`spatial_factors` 是面向分析模块和 Agent 的统一空间证据结构。它把带空间位置的数据转换为可解释的方位、圈层、重心、热点、邻近性、道路轴向和一致性证据。

AI 可以引用本规范中标记为“可引用”的字段；不得从坐标自行反推地名、道路名、商圈名、行政归属或现实经营结论。

## 公共字段

| 字段 | 类型 | 含义 | 单位/枚举 | 空值语义 | AI 可引用 |
| --- | --- | --- | --- | --- | --- |
| `spatial_factor_version` | string | 空间因子版本 | 当前为 `multi_mode_v1` | 不应为空 | 是 |
| `geometry_mode` | string | 几何模式 | `point` / `grid` / `line` / `polygon` / `site` | 不应为空 | 是 |
| `center` | number[] | 分析基准中心 `[lng, lat]` | GCJ02 经纬度 | 空数组表示无有效中心 | 否 |
| `count` | number | 参与计算的标准化对象数 | 个 | `0` 表示无有效对象 | 是 |
| `point_count` | number | 兼容字段，同 `count` | 个 | `0` 表示无有效对象 | 是 |
| `centroid` | number[] | 加权重心 `[lng, lat]` | GCJ02 经纬度 | 空数组表示无有效重心 | 否 |
| `centroid_factor` | object | 重心相对中心的方向和距离 | 见下表 | 空方向/0 距离表示不可判断或重合 | 部分 |
| `direction_factor` | object | 八方向分布 | 北、东北、东、东南、南、西南、西、西北 | 空方向表示不可判断 | 是 |
| `ring_factor` | object | 核心/中圈/外围圈层分布 | 核心圈层、中圈层、外围圈层 | 空圈层表示不可判断 | 是 |
| `hotspot_factor` | object | 简易热点网格结构 | `none` / `single_core` / `multi_core` / `dispersed_hotspots` | `none` 表示无热点 | 是 |
| `orientation_factor` | object | 线对象轴向分布 | 东西向、南北向、东北-西南向、西北-东南向 | 空轴向表示无有效线段 | 是，仅 `line` |
| `proximity_factor` | object | 选址点邻近性 | 米、个 | 0 或空表示缺少参照对象 | 是，仅 `site` |
| `road_proximity_factor` | object | 对道路参照的邻近性 | 米、个 | 0 或空表示缺少道路参照 | 是 |
| `polygon_factor` | object | 面对象数量和面积评分 | 个、面积评分 | 0 表示无有效面 | 是，仅 `polygon` |
| `consistency_factor` | object | 两类空间因子的一致性 | `high` / `partial` / `low` / `unknown` | `unknown` 表示缺少可比证据 | 是 |

## 子结构字段

### `centroid_factor`

| 字段 | 含义 | 单位 | AI 可引用 |
| --- | --- | --- | --- |
| `centroid` | 加权重心坐标 | GCJ02 经纬度 | 否 |
| `direction_from_center` | 重心相对中心的方位 | 中文方向 | 是 |
| `distance_from_center_m` | 重心相对中心距离 | 米 | 是 |

### `direction_factor`

| 字段 | 含义 | 单位 | AI 可引用 |
| --- | --- | --- | --- |
| `dominant_direction` | 值加权后的主导方位 | 中文方向 | 是 |
| `secondary_direction` | 次主导方位 | 中文方向 | 是 |
| `dominant_share` | 主导方位值占比 | 0–1 | 是 |
| `secondary_share` | 次主导方位值占比 | 0–1 | 是 |
| `direction_rows` | 八方向明细 | count/value/share | 是，优先引用汇总字段 |

### `ring_factor`

| 字段 | 含义 | 单位 | AI 可引用 |
| --- | --- | --- | --- |
| `dominant_ring` | 主导圈层 | 中文圈层 | 是 |
| `dominant_share` | 主导圈层对象数量占比 | 0–1 | 是 |
| `dominant_value_share` | 主导圈层值占比 | 0–1 | 是 |
| `max_distance_m` | 对象距中心最大距离 | 米 | 是 |
| `ring_rows` | 圈层明细 | count/value/share/value_share | 是，优先引用汇总字段 |

### `hotspot_factor`

| 字段 | 含义 | 单位/枚举 | AI 可引用 |
| --- | --- | --- | --- |
| `hotspot_grid_count` | 热点网格数量 | 个 | 是 |
| `dominant_hotspot_direction` | 热点主导方位 | 中文方向 | 是 |
| `hotspot_pattern` | 热点形态 | `none` / `single_core` / `multi_core` / `dispersed_hotspots` | 是 |
| `grid_rows` | 热点网格明细 | count/value/centroid/direction | 是，不引用坐标 |

## `geometry_mode` 适用范围

| mode | 适用对象 | 主要因子 | 说明 |
| --- | --- | --- | --- |
| `point` | POI、店铺、设施点 | 方位、圈层、重心、热点、小类空间差异 | 按点数量或点值加权，适合描述点状供给分布。 |
| `grid` | 夜光、人口、H3 栅格 | 值加权方位、圈层、重心、热点 | 按 `value_key` 指定字段加权，例如夜光辐亮、人口、POI 密度。 |
| `line` | 路网、轨道、廊道 | 道路轴向、长度加权方位、圈层、热点 | 轴向按线段长度加权，不套用“点最多”的逻辑。 |
| `polygon` | 片区、等时圈子区域、地块 | 面重心、方位、圈层、面积评分 | 面积评分用于相对比较，不代表真实投影面积。 |
| `site` | 候选店址、设施选址点 | 距中心、距热点、距道路、周边 POI 混合度 | 用于判断候选点与已有空间对象的邻近关系。 |

## AI 引用规则

- 可以引用中文方向、圈层、热点形态、距离米数、占比和对象数量。
- 可以说“主导方位为东北”“重心相对中心偏东约 320 米”“热点呈多核心”。
- 不可以根据 `lng/lat` 自行编造“某商圈”“某道路”“某地标附近”。
- 不可以把夜光、人口、POI 密度直接解释为真实客流、收入、消费能力或营业额。
- `alignment_level=unknown` 时必须说明“缺少可比证据”，不能硬凑一致性。

## POI 单次空间字段

普通 POI 结构分析会额外输出：

| 字段 | 含义 | AI 可引用 |
| --- | --- | --- |
| `spatial_factors` | 全部 POI 点的 `point` 模式空间因子 | 是 |
| `subcategory_spatial_rows` | Top 小类的空间分布明细 | 是 |
| `subcategory_spatial_summary` | 2–3 条小类空间摘要短句 | 是 |

`subcategory_spatial_rows` 每行包含 `name`、`parent`、`count`、`share`、`dominant_direction`、`dominant_ring`、`hotspot_pattern`、`hotspot_grid_count`、`top_area`、`centroid_factor`。其中 `centroid_factor.centroid` 仅供计算链路保存，AI 不直接引用坐标。
