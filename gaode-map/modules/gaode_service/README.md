### 说明
- 此模块用于请求高德api并生成符合地图生成格式的json
### 文件说明
- get_position.py：获取中心点的经纬度，请求结果见 gaode_ans/高德坐标请求结果.json
    ```sh
    curl "https://restapi.amap.com/v3/geocode/regeo?key=$AMAP_WEB_SERVICE_KEY&location=112.9388,28.2282&extensions=all&radius=1000"
    ```
- gen_json.py：总的入口请求调用不同的json生成请求格式
    - 根据get_position.py获取place坐标（around）或城市信息（city）
    - 输入只需 place、type（around/city），可选 place_types 数组（如 ["公交站","地铁站"]），为空则走默认并调用 around/city 生成符合 map 请求示例的 JSON
- utils\get_type_info.py：用于将用户输入映射到指定类型，封装为函数获取相应的type和关键字
    - 默认 place_types（无需传参）：around=公交站(150700)+地铁站(150500)，city=火车/高铁站(150200)
- utils/merge_poi.py：用于合并分页数据的结果（可参考gaode_ans文件夹下的请求结果示例）
- get_city_place.py：传入place和types用于生成以城市为单位的地点json数据
    1. 根据place获取adcode，请求结果格式可看  gaode_ans/获取城市信息.json
        ```sh
        curl --location --request GET 'https://restapi.amap.com/v3/config/district?keywords=%E6%9D%AD%E5%B7%9E%E5%B8%82&subdistrict=0&extensions=all&key=$AMAP_WEB_SERVICE_KEY' \
        --header 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode 'keywords=杭州市(这里就是place)' \
        --data-urlencode 'subdistrict=0' \
        --data-urlencode 'extensions=all' \
        --data-urlencode 'key=<你的key>'
        ```
    2. 根据adcode以及types循环page获取所有结果（直到返回的poi为0）
        ```sh
        curl --location --request GET 'https://restapi.amap.com/v3/place/text?key=$AMAP_WEB_SERVICE_KEY&city=330100&citylimit=true&types=150000%7C150200%7C150201&keywords=%E9%AB%98%E9%93%81%7C%E7%81%AB%E8%BD%A6%E7%AB%99&offset=25&page=1&extensions=all' \
        --header 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode 'key=<你的key>' \
        --data-urlencode 'city=330100' \
        --data-urlencode 'citylimit=true' \
        --data-urlencode 'types=150000|150200|150201' \
        --data-urlencode 'keywords=高铁|火车站|杭州东|杭州西' \
        --data-urlencode 'offset=25' \
        --data-urlencode 'page=1' \
        --data-urlencode 'extensions=all'
        ```
    3. 使用merge_poi合并生成最终的符合map格式的json
- get_around_place.py：用于生成以指定中心点附近的地点json数据
    1. 根据place坐标以及types循环page获取所有结果（直到返回的poi为0）
        ```sh
        curl --location 'https://restapi.amap.com/v5/place/around?key=$AMAP_WEB_SERVICE_KEY&location=112.943466%2C28.157763&radius=2000&keywords=%E5%85%AC%E4%BA%A4%E7%AB%99&types=150700&page_size=20&page_num=1'
        ```
    2. 使用merge_poi合并生成最终的符合map格式的json
