# 一个能跑的工具调用往返：模型那一半用剧本代替，代码那一半是真的
import json


def read_file(path):
    # 真实实现会去打开文件；这里返回一段固定内容，方便看清流程
    return {'ok': True, 'text': '会议改到周四下午三点，地点在三楼会议室。'}


TOOLS = {'read_file': read_file}

# 假模型：按剧本提出请求。真实模型这里输出的也是一段结构化文字，形状一样
script = [{'name': 'read_file', 'arguments': {'path': 'notes.txt'}}]

messages = [{'role': 'user', 'content': '读一下 notes.txt，会议改到几点了？'}]

for step in range(1, 4):
    if step > len(script):
        messages.append({'role': 'assistant', 'content': '会议改到周四下午三点。'})
        print('第', step, '轮：模型不再请求工具，循环结束')
        break

    call = script[step - 1]
    print('第', step, '轮：模型提出请求', call['name'], call['arguments'])

    # 先把请求记进历史，再执行：结果必须能配对到具体某次调用
    messages.append({'role': 'assistant', 'content': json.dumps(call, ensure_ascii=False)})

    result = TOOLS[call['name']](**call['arguments'])   # 真正动手的是这一行
    messages.append({
        'role': 'tool',
        'tool_call_id': 'call_' + str(step),
        'content': result['text'],
    })
    print('        执行结果：', result['text'])
    print('        当前消息数：', len(messages))

print()
print('最终消息数组：')
for m in messages:
    print(' ', m['role'], '->', m['content'])