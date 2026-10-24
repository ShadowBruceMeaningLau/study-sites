# 一条完整的工具往返：请求带编号，结果也带同一个编号
import json

messages = [
    {'role': 'system', 'content': '你是一个只有两个工具的助手。'},
    {'role': 'user', 'content': '128 元打八五折再加 12 元运费是多少？'},
    {'role': 'assistant', 'content': None, 'tool_calls': [
        {'id': 'call_a1', 'type': 'function',
         'function': {'name': 'calculator', 'arguments': '{"expression": "128*0.85"}'}}]},
    {'role': 'tool', 'tool_call_id': 'call_a1', 'content': '108.8'},
    {'role': 'assistant', 'content': None, 'tool_calls': [
        {'id': 'call_a2', 'type': 'function',
         'function': {'name': 'calculator', 'arguments': '{"expression": "108.8+12"}'}}]},
    {'role': 'tool', 'tool_call_id': 'call_a2', 'content': '120.8'},
    {'role': 'assistant', 'content': '合计 120.8 元。'},
]

total = len(json.dumps(messages, ensure_ascii=False).encode('utf-8'))
print('整条历史：', total, '字节 /', len(messages), '条')

for m in messages:
    size = len(json.dumps(m, ensure_ascii=False).encode('utf-8'))
    print('  %-9s %4d 字节' % (m['role'], size))

# 一个最小的配对校验：结果必须紧跟请求，编号必须对得上
pending = []
for i, m in enumerate(messages, 1):
    if m['role'] == 'tool':
        if not pending:
            print('第', i, '条：结果没有对应的调用')
        elif m['tool_call_id'] not in pending:
            print('第', i, '条：编号对不上')
        else:
            pending.remove(m['tool_call_id'])
    elif m.get('tool_calls'):
        pending.extend(c['id'] for c in m['tool_calls'])
print('结束时未回收的调用：', pending)