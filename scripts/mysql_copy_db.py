import argparse
import sys
import time
from typing import Iterable, List, Sequence

import pymysql
from pymysql.constants import CLIENT
from pymysql.cursors import SSCursor


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy one MySQL database to another without mysqldump."
    )
    parser.add_argument("--src-host", required=True)
    parser.add_argument("--src-port", type=int, default=3306)
    parser.add_argument("--src-user", required=True)
    parser.add_argument("--src-password", required=True)
    parser.add_argument("--src-db", required=True)
    parser.add_argument("--dst-host", required=True)
    parser.add_argument("--dst-port", type=int, default=3306)
    parser.add_argument("--dst-user", required=True)
    parser.add_argument("--dst-password", required=True)
    parser.add_argument("--dst-db", required=True)
    parser.add_argument(
        "--tables",
        nargs="*",
        help="Optional list of tables to copy. Defaults to all base tables.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=2000,
        help="Rows per insert batch for data copy.",
    )
    parser.add_argument(
        "--truncate-first",
        action="store_true",
        help="Drop and recreate target tables before copying data.",
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Create target schema only, do not copy table rows.",
    )
    return parser.parse_args()


def connect_mysql(host: str, port: int, user: str, password: str, database: str | None):
    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        autocommit=False,
        client_flag=CLIENT.MULTI_STATEMENTS,
    )


def ensure_database(dst_conn, db_name: str) -> None:
    with dst_conn.cursor() as cur:
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
    dst_conn.commit()


def list_tables(src_conn, db_name: str) -> List[str]:
    sql = """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """
    with src_conn.cursor() as cur:
        cur.execute(sql, (db_name,))
        return [row[0] for row in cur.fetchall()]


def get_create_table_sql(src_conn, table_name: str) -> str:
    with src_conn.cursor() as cur:
        cur.execute(f"SHOW CREATE TABLE `{table_name}`")
        row = cur.fetchone()
        return row[1]


def get_column_names(src_conn, table_name: str) -> List[str]:
    with src_conn.cursor() as cur:
        cur.execute(f"SHOW COLUMNS FROM `{table_name}`")
        return [row[0] for row in cur.fetchall()]


def recreate_table(dst_conn, table_name: str, create_sql: str) -> None:
    with dst_conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS=0")
        cur.execute(f"DROP TABLE IF EXISTS `{table_name}`")
        cur.execute(create_sql)
        cur.execute("SET FOREIGN_KEY_CHECKS=1")
    dst_conn.commit()


def build_insert_sql(table_name: str, columns: Sequence[str]) -> str:
    col_sql = ", ".join(f"`{col}`" for col in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    return f"INSERT INTO `{table_name}` ({col_sql}) VALUES ({placeholders})"


def stream_rows(src_conn, table_name: str) -> Iterable[tuple]:
    cursor = src_conn.cursor(SSCursor)
    cursor.execute(f"SELECT * FROM `{table_name}`")
    try:
        while True:
            rows = cursor.fetchmany(2000)
            if not rows:
                break
            for row in rows:
                yield row
    finally:
        cursor.close()


def copy_table_rows(
    src_conn,
    dst_conn,
    table_name: str,
    columns: Sequence[str],
    batch_size: int,
) -> int:
    insert_sql = build_insert_sql(table_name, columns)
    copied = 0
    batch: List[tuple] = []
    with dst_conn.cursor() as cur:
        for row in stream_rows(src_conn, table_name):
            batch.append(row)
            if len(batch) >= batch_size:
                cur.executemany(insert_sql, batch)
                dst_conn.commit()
                copied += len(batch)
                print(f"[{table_name}] copied {copied} rows", flush=True)
                batch.clear()
        if batch:
            cur.executemany(insert_sql, batch)
            dst_conn.commit()
            copied += len(batch)
    return copied


def main() -> int:
    args = parse_args()
    started = time.time()

    src_server_conn = connect_mysql(
        args.src_host, args.src_port, args.src_user, args.src_password, None
    )
    dst_server_conn = connect_mysql(
        args.dst_host, args.dst_port, args.dst_user, args.dst_password, None
    )
    try:
        ensure_database(dst_server_conn, args.dst_db)
    finally:
        dst_server_conn.close()

    src_conn = connect_mysql(
        args.src_host, args.src_port, args.src_user, args.src_password, args.src_db
    )
    dst_conn = connect_mysql(
        args.dst_host, args.dst_port, args.dst_user, args.dst_password, args.dst_db
    )

    try:
        table_names = args.tables or list_tables(src_conn, args.src_db)
        if not table_names:
            print("No tables found to copy.", flush=True)
            return 0

        print(
            f"Copying database `{args.src_db}` -> `{args.dst_db}` "
            f"for tables: {', '.join(table_names)}",
            flush=True,
        )

        for table_name in table_names:
            print(f"[{table_name}] preparing schema", flush=True)
            create_sql = get_create_table_sql(src_conn, table_name)
            if args.truncate_first:
                recreate_table(dst_conn, table_name, create_sql)
            else:
                with dst_conn.cursor() as cur:
                    cur.execute(create_sql.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1))
                dst_conn.commit()

            if args.schema_only:
                print(f"[{table_name}] schema copied only", flush=True)
                continue

            columns = get_column_names(src_conn, table_name)
            copied = copy_table_rows(
                src_conn,
                dst_conn,
                table_name,
                columns,
                args.batch_size,
            )
            print(f"[{table_name}] done, total rows copied: {copied}", flush=True)

        elapsed = time.time() - started
        print(f"Completed in {elapsed:.1f}s", flush=True)
        return 0
    finally:
        src_conn.close()
        dst_conn.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
