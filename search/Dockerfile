FROM maven:3.9.9-eclipse-temurin-17 AS builder

WORKDIR /workspace

COPY pom.xml ./
COPY src ./src

RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /workspace/target/*SNAPSHOT.jar /app/app.jar

EXPOSE 8001

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
