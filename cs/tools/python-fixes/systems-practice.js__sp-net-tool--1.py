# epoll_server.py —— 用 epoll 实现同样的 HTTP 服务器(仅 Linux)
# 运行: python3 epoll_server.py
# 对照点: 没有线程, 一个循环同时管理监听 fd 与所有连接 fd
# 说明: 同上, 用 __import__ 代替导包关键字, 保持课程数据文件格式合法
os = __import__("os")
socket = __import__("socket")
selectors = __import__("selectors")

HOST, PORT = "127.0.0.1", 8081
ROOT = os.path.abspath("./www")

sel = selectors.EpollSelector()          # Windows 上请改用 selectors.DefaultSelector()
bufs = {}                                # fd -> 累积的请求字节


def accept_new(srv):
    conn, addr = srv.accept()
    conn.setblocking(False)              # 非阻塞: recv 没数据时抛 BlockingIOError
    bufs[conn] = b""
    sel.register(conn, selectors.EVENT_READ, data="conn")
    print("新连接: %s, 当前连接数 %d" % (addr, len(bufs)))


def read_conn(conn):
    try:
        data = conn.recv(4096)
    except BlockingIOError:
        return                           # 暂时没有数据, 等下次事件
    if not data:                         # 对端关闭
        close_conn(conn)
        return
    bufs[conn] += data
    if b"\r\n\r\n" not in bufs[conn]:
        return                           # 请求还没收完, 继续等

    head = bufs[conn].split(b"\r\n\r\n", 1)[0].decode("iso-8859-1")
    line = head.split("\r\n")[0]
    parts = line.split(" ")
    path = parts[1] if len(parts) > 1 else "/"
    if path.endswith("/"):
        path += "index.html"
    full = os.path.abspath(os.path.join(ROOT, path.lstrip("/")))

    if full.startswith(ROOT) and os.path.isfile(full):
        with open(full, "rb") as f:
            body = f.read()
        head_out = ("HTTP/1.1 200 OK\r\nContent-Length: %d\r\n"
                    "Content-Type: text/plain; charset=utf-8\r\nConnection: close\r\n\r\n"
                    % len(body))
        conn.sendall(head_out.encode("iso-8859-1") + body)
    else:
        body = b"404 not found\n"
        conn.sendall(b"HTTP/1.1 404 Not Found\r\nContent-Length: %d\r\nConnection: close\r\n\r\n"
                     % len(body) + body)
    close_conn(conn)                     # 简化: 一次请求一条连接


def close_conn(conn):
    sel.unregister(conn)
    bufs.pop(conn, None)                 # 必须清理, 否则 fd 与字典一起泄漏
    conn.close()


if __name__ == "__main__":
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, PORT))
    srv.listen(128)
    srv.setblocking(False)
    sel.register(srv, selectors.EVENT_READ, data="srv")
    print("epoll 版监听 http://%s:%d/" % (HOST, PORT))

    while True:
        for key, _mask in sel.select(timeout=1.0):   # 只返回就绪的 fd
            if key.data == "srv":
                accept_new(key.fileobj)
            else:
                read_conn(key.fileobj)
