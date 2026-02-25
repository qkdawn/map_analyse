import math


def wgs84_to_gcj02(lng, lat):
    """
    将WGS84坐标系转换为GCJ-02坐标系（火星坐标系）
    :param lng: WGS84坐标系的经度
    :param lat: WGS84坐标系的纬度
    :return: 转换后的GCJ-02坐标系的经纬度
    """
    if out_of_china(lng, lat):
        # 若坐标点不在中国范围内，直接返回原坐标
        return lng, lat

    # 计算转换偏移量
    dlat = transform_lat(lng - 105.0, lat - 35.0)
    dlng = transform_lng(lng - 105.0, lat - 35.0)

    # 将纬度转换为弧度
    radlat = lat / 180.0 * math.pi
    magic = math.sin(radlat)
    magic = 1 - 0.006693421622965943 * magic * magic
    sqrtmagic = math.sqrt(magic)

    # 计算经度和纬度的偏移量
    dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.006693421622965943)) / (magic * sqrtmagic) * math.pi)
    dlng = (dlng * 180.0) / (6378245.0 / sqrtmagic * math.cos(radlat) * math.pi)

    # 计算转换后的坐标
    gcj02_lat = lat + dlat
    gcj02_lng = lng + dlng

    return gcj02_lng, gcj02_lat


def gcj02_to_wgs84(lng, lat, max_iter=10, threshold=1e-6):
    """
    将GCJ-02坐标系反推为WGS84坐标系（迭代法）。

    :param lng: GCJ-02 坐标系的经度
    :param lat: GCJ-02 坐标系的纬度
    :param max_iter: 最大迭代次数
    :param threshold: 收敛阈值（度）
    :return: 反推后的 WGS84 坐标系经纬度 (lng, lat)
    """
    if out_of_china(lng, lat):
        return lng, lat

    guess_lng, guess_lat = lng, lat
    for _ in range(max_iter):
        calc_lng, calc_lat = wgs84_to_gcj02(guess_lng, guess_lat)
        d_lng = calc_lng - lng
        d_lat = calc_lat - lat
        if abs(d_lng) < threshold and abs(d_lat) < threshold:
            break
        guess_lng -= d_lng
        guess_lat -= d_lat

    return guess_lng, guess_lat


def transform_lat(lng, lat):
    """
    计算纬度偏移量的辅助函数
    """
    ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * math.sqrt(abs(lng))
    ret += (20.0 * math.sin(6.0 * lng * math.pi) + 20.0 * math.sin(2.0 * lng * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(lat * math.pi) + 40.0 * math.sin(lat / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(lat / 12.0 * math.pi) + 320 * math.sin(lat * math.pi / 30.0)) * 2.0 / 3.0
    return ret


def transform_lng(lng, lat):
    """
    计算经度偏移量的辅助函数
    """
    ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * math.sqrt(abs(lng))
    ret += (20.0 * math.sin(6.0 * lng * math.pi) + 20.0 * math.sin(2.0 * lng * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(lng * math.pi) + 40.0 * math.sin(lng / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(lng / 12.0 * math.pi) + 300.0 * math.sin(lng * math.pi / 30.0)) * 2.0 / 3.0
    return ret


def out_of_china(lng, lat):
    """
    判断坐标点是否在中国范围内
    """
    return not (lng > 73.66 and lng < 135.05 and lat > 3.86 and lat < 53.55)
