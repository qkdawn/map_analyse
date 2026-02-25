package com.example.placesearch.repository;

import com.example.placesearch.entity.Code;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

// import java.util.List;

public interface CodeRepository extends JpaRepository<Code, String> {
//    @Query(value = "SELECT r FROM region r"+" WHERE r.adname IN " +
//            "(SELECT c.adname FROM Code c WHERE c.adcode = :adcode) "
//            "AND (:year IS NULL OR YEAR(r.timestamp) = :year) " +
//            "AND (:typeCodes IS NULL OR r.typecode IN :typeCodes)"
//    )
//     @Query(value = "SELECT r.* FROM region r " +
//         "WHERE r.adname IN (" +
//         "    SELECT c.adname FROM code c WHERE c.adcode = :adcode" +
//         ") " +
//         "LIMIT 10",  // 添加限制防止返回过多数据
//         nativeQuery = true)

//     List<Object[]> findByAdcodeWithFilters(
//             @Param("adcode") String adcode
// //            @Param("year") Integer year,
// //            @Param("typeCodes") List<String> typeCodes
//             );

    Optional<Code> findFirstByCitycode(String citycode);
}
