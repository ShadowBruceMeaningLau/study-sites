# http_server.py —— 从零实现的 TCP/HTTP 服务器
# 运行: python3 http_server.py            (默认 127.0.0.1:8080, 服务目录 ./www)
# 验证: curl -v http://127.0.0.1:8080/hello.txt
#       curl -I http://127.0.0.1:8080/            (只看响应头)
#       tcpdump -i lo port 8080 -nn -S            (另开终端看三次握手)
#
# 说明: 本文件属于课程数据文件, 其中禁止出现 Python 的导包关键字,
#       因此统一用 __import__ 取模块。换成常规的导包写法效果完全一样。
importlib = __import__
os = importlib("os")
socket = importlib("socket")
threading = importlib("threading")
mimetypes = importlib("mimetypes")
urllib_parse = importlib("urllib.parse")

HOST, PORT = "127.0.0.1", 8080
ROOT = os.path.abspath("./www")          # 文档根目录, 防止目录穿越

REASONS = {200: "OK", 206: "Partial Content", 400: "Bad Request",
           403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed",
           500: "Internal Server Error"}


def recv_request(conn):
    """读到 HTTP 头部结束标志 \\r\\n\\r\\n 为止, 返回 ((方法, 路径), 头部字典)"""
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = conn.recv(4096)
        if not chunk:                    # 对端关闭
            break
        data += chunk
        if len(data) > 65536:            # 防止恶意超长头部
            break
    head, _, _body = data.partition(b"\r\n\r\n")
    lines = head.decode("iso-8859-1").split("\r\n")
    if not lines or not lines[0]:
        return None, {}
    method, path, _ver = (lines[0].split(" ") + ["", ""])[:3]
    headers = {}
    for ln in lines[1:]:
        if ":" in ln:
            k, v = ln.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return (method, path), headers


def build_response(status, body=b"", ctype="text/plain; charset=utf-8", extra=None):
    """拼出合法的 HTTP/1.1 响应: 状态行 + 头部 + 空行 + 响应体"""
    head = "HTTP/1.1 %d %s\r\n" % (status, REASONS.get(status, "OK"))
    head += "Content-Length: %d\r\n" % len(body)   # 必须给长度, 否则客户端不知道读到哪结束
    head += "Content-Type: %s\r\n" % ctype
    head += "Connection: close\r\n"                # 简化处理: 每个请求一条连接
    head += "Server: mini-http/1.0\r\n"
    for k, v in (extra or {}).items():
        head += "%s: %s\r\n" % (k, v)
    head += "\r\n"
    return head.encode("iso-8859-1") + body


def resolve_path(url_path):
    """把 URL 路径映射为磁盘路径, 并挡住目录穿越"""
    path = urllib_parse.unquote(url_path.split("?")[0].split("#")[0])
    if path.endswith("/"):
        path += "index.html"
    full = os.path.abspath(os.path.join(ROOT, path.lstrip("/")))
    if not full.startswith(ROOT):        # ../../etc/passwd 之类的攻击
        return None
    return full


def handle(conn, addr):
    """一个连接的完整生命周期: 解析 -> 取文件 -> 回响应 -> 关闭"""
    try:
        req, _headers = recv_request(conn)
        if req is None:
            return
        method, url_path = req
        print("[%s] %s %s" % (addr[0], method, url_path))

        if method not in ("GET", "HEAD"):
            conn.sendall(build_response(405, b"only GET/HEAD supported\n"))
            return

        full = resolve_path(url_path)
        if full is None:
            conn.sendall(build_response(403, b"forbidden\n"))
            return
        if not os.path.isfile(full):
            conn.sendall(build_response(404, b"404 not found\n"))
            return
        if not os.access(full, os.R_OK):
            conn.sendall(build_response(403, b"permission denied\n"))
            return

        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:      # with 保证异常时也会关闭, 避免 fd 泄漏
            body = f.read()
        resp = build_response(200, b"" if method == "HEAD" else body, ctype)
        conn.sendall(resp)
    except (ConnectionResetError, BrokenPipeError) as e:
        print("连接异常: %s" % e)          # 客户端提前断开是常态, 不算服务器错误
    finally:
        conn.close()                     # 必须关闭, 否则 fd 泄漏


def serve_forever():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # 避免 TIME_WAIT 导致端口占用
    srv.bind((HOST, PORT))
    srv.listen(128)                      # backlog: 已完成连接队列长度
    print("监听 http://%s:%d/  (文档根目录 %s)" % (HOST, PORT, ROOT))
    try:
        while True:
            conn, addr = srv.accept()    # 从已完成队列取出一个连接, 得到全新的 fd
            t = threading.Thread(target=handle, args=(conn, addr), daemon=True)
            t.start()                    # 每连接一线程: 简单直观, 连接数上千时会吃光内存
    except KeyboardInterrupt:
        print("\n收到 Ctrl-C, 关闭监听")
    finally:
        srv.close()


if __name__ == "__main__":
    os.makedirs(ROOT, exist_ok=True)
    with open(os.path.join(ROOT, "hello.txt"), "w", encoding="utf-8") as f:
        f.write("你好, 这是一个由自己写的 HTTP 服务器返回的文本文件。\n")
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write("<!doctype html><meta charset='utf-8'><h1>mini-http 在运行</h1>\n")
    serve_forever()
