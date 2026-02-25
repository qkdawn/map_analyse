import pymysql
import getpass

def create_database():
    print("=== MySQL 数据库初始化工具 ===")
    print("此工具将帮助您在服务器上创建一个新的空数据库。\n")
    
    host = input("MySQL 主机地址 (IP 或 域名) [默认 127.0.0.1]: ").strip() or "127.0.0.1"
    port = input("MySQL 端口 (默认 3306): ").strip() or "3306"
    user = input("用户名 (默认 root): ").strip() or "root"
    password = getpass.getpass("密码: ")
    new_db_name = input("要创建的新数据库名称 (例如 gaode_deploy): ").strip()
    
    if not new_db_name:
        print("错误：必须输入数据库名称！")
        return

    print(f"\n正在尝试连接到 {host}:{port} ...")
    
    try:
        # 连接到 MySQL Server (不指定具体数据库)
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=int(port),
            charset='utf8mb4'
        )
        
        cursor = conn.cursor()
        
        # 创建数据库 SQL
        sql = f"CREATE DATABASE IF NOT EXISTS {new_db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        cursor.execute(sql)
        
        print(f"\n✅ 成功！数据库 [{new_db_name}] 已创建。")
        print("-" * 30)
        print("现在，请将以下内容复制到您的 .env 文件中：")
        print(f"DB_URL=mysql+pymysql://{user}:{password}@{host}:{port}/{new_db_name}")
        print("-" * 30)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ 失败: {e}")

if __name__ == "__main__":
    # 检查是否安装了 pymysql
    try:
        import pymysql
        create_database()
    except ImportError:
        print("请先安装依赖: pip install pymysql")
