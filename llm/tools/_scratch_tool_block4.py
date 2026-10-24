# 三个独立工具并行跑；每个结果都带上自己的调用编号
import threading
import time

CALLS = [
    {'id': 'call_bj', 'name': 'get_weather', 'arguments': {'city': '北京'}},
    {'id': 'call_sh', 'name': 'get_weather', 'arguments': {'city': '上海'}},
    {'id': 'call_gz', 'name': 'get_weather', 'arguments': {'city': '广州'}},
]

results = {}
lock = threading.Lock()


def get_weather(city):
    time.sleep(0.1)                 # 假装这是一次网络查询
    return city + '：晴，24 度'


def run(call):
    value = get_weather(**call['arguments'])
    with lock:                      # 多线程改写同一个字典，必须加锁
        results[call['id']] = value


t0 = time.perf_counter()
threads = [threading.Thread(target=run, args=(c,)) for c in CALLS]
for t in threads:
    t.start()
for t in threads:
    t.join()
t_par = time.perf_counter() - t0

for c in CALLS:                     # 按请求顺序输出结果，编号负责配对
    print(c['id'], '->', results.get(c['id'], '（没有结果）'))
print('并行耗时：%.3f 秒' % t_par)

# 串行对照
t0 = time.perf_counter()
for c in CALLS:
    get_weather(**c['arguments'])
t_ser = time.perf_counter() - t0
print('串行耗时：%.3f 秒' % t_ser)
print('比值：%.2f' % (t_ser / t_par))