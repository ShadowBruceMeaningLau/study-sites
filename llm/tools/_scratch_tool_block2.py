# 一份可以直接发给模型服务的 tools 定义，外加体积账
import json


def tool(name, desc, props, required):
    return {
        'type': 'function',
        'function': {
            'name': name,
            'description': desc,
            'parameters': {
                'type': 'object',
                'properties': props,
                'required': required,
            },
        },
    }


tools = [
    tool('read_file',
         '读取一个 UTF-8 文本文件的前 N 个字节并返回内容；只能用于文件，不能用于目录。',
         {'path': {'type': 'string', 'description': '相对路径，例如 notes.txt，不能包含 ..'},
          'max_bytes': {'type': 'integer', 'minimum': 1, 'maximum': 1048576,
                        'description': '最多读多少字节，缺省 4096'}},
         ['path']),
    tool('calculator',
         '计算一个只含数字与 + - * / 括号的算术表达式；不要用它算日期或单位换算。',
         {'expression': {'type': 'string', 'description': '例如 128*0.85'}},
         ['expression']),
]

text = json.dumps(tools, ensure_ascii=False)
print('两个工具的 schema：', len(text.encode('utf-8')), '字节 /', len(text), '字符')
print('平均每个工具：', round(len(text.encode('utf-8')) / 2), '字节')

for n in (4, 8, 16):
    many = (tools * 10)[:n]
    b = len(json.dumps(many, ensure_ascii=False).encode('utf-8'))
    print(n, '个工具：', b, '字节')

# 一个只看 required 的极简校验器：够演示「缺必填」这一类错
schema = tools[0]['function']['parameters']
for args in ({'path': 'notes.txt'}, {'max_bytes': 100}, {}):
    missing = [k for k in schema['required'] if k not in args]
    print(args, '->', ('缺少 ' + '、'.join(missing)) if missing else '必填齐全')