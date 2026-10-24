# 错误不是异常，是一条结果；重试有次数、有分类、有退避
import json
import time

WANT = 'read'          # 用户要的是只读打开：语义检查要拿它作依据


def make_error(code, field, got, allowed, hint):
    return {
        'ok': False,
        'error': {'code': code, 'field': field, 'got': got, 'allowed': allowed},
        'text': '错误：参数 %s 的取值 %r 不在允许范围内，只能是 %s。%s'
                % (field, got, ' 或 '.join(allowed), hint),
    }


def run_tool(name, args):
    if name not in ('set_mode',):
        return {'ok': False, 'error': {'code': 'unknown_tool'},
                'text': '错误：没有这个工具 ' + str(name)}
    mode = args.get('mode')
    if mode not in ('read', 'list'):
        return make_error('bad_enum', 'mode', mode, ['read', 'list'],
                          '用户要的是以只读模式打开，对应 read。')
    if mode != WANT:
        # 参数合法，但语义不对：这一层 schema 管不了，必须自己判
        return make_error('wrong_mode', 'mode', mode, [WANT],
                          'list 是列出目录内容，不是只读打开。')
    return {'ok': True, 'text': '已把 ' + args.get('path', '?') + ' 以只读模式打开'}


# 假模型的三次尝试：先猜错，再按错误改成 list（合法但错），最后改对
script = [
    {'mode': 'readonly', 'path': 'notes.txt'},
    {'mode': 'list', 'path': 'notes.txt'},
    {'mode': 'read', 'path': 'notes.txt'},
]

messages = [{'role': 'user', 'content': '把 notes.txt 以只读模式打开。'}]
MAX_TRIES = 3
for attempt in range(1, MAX_TRIES + 1):
    args = script[attempt - 1]
    print('第', attempt, '次请求：', json.dumps(args, ensure_ascii=False))
    messages.append({'role': 'assistant', 'content': json.dumps({'name': 'set_mode', 'arguments': args}, ensure_ascii=False)})

    result = run_tool('set_mode', args)
    messages.append({'role': 'tool', 'tool_call_id': 'call_' + str(attempt), 'content': result['text']})
    print('    结果：', result['text'])

    if result['ok']:
        print('    成功，循环结束')
        break
    if result['error']['code'] in ('unknown_tool', 'denied'):
        print('    这类错不该重试，直接告诉用户')
        break
    time.sleep(0.05)                      # 真实场景里这里是退避等待，不是固定 0.05
else:
    print('    用完', MAX_TRIES, '次机会仍未成功，停止并如实汇报')

print()
print('历史条数：', len(messages))