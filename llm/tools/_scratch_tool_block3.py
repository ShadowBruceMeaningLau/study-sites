# 极简 JSON Schema 校验器：type / required / enum / minimum / maximum
import json

SCHEMA = {
    'type': 'object',
    'properties': {
        'path': {'type': 'string'},
        'max_bytes': {'type': 'integer', 'minimum': 1, 'maximum': 1048576},
        'mode': {'type': 'string', 'enum': ['read', 'list']},
    },
    'required': ['path'],
}


def validate(schema, args):
    errs = []
    if not isinstance(args, dict):
        return ['参数必须是一个对象']
    for k in schema.get('required', []):
        if k not in args:
            errs.append('缺少必填字段 ' + k)
    for k, spec in schema.get('properties', {}).items():
        if k not in args:
            continue
        v = args[k]
        t = spec.get('type')
        if t == 'string' and not isinstance(v, str):
            errs.append(k + ' 必须是字符串')
        if t == 'integer' and (not isinstance(v, int) or isinstance(v, bool)):
            errs.append(k + ' 必须是整数')
        if 'enum' in spec and v not in spec['enum']:
            errs.append(k + ' 不在枚举里')
        if t == 'integer' and isinstance(v, int) and not isinstance(v, bool):
            if 'minimum' in spec and v < spec['minimum']:
                errs.append(k + ' 小于最小值')
            if 'maximum' in spec and v > spec['maximum']:
                errs.append(k + ' 大于最大值')
    return errs

CASES = [
    {'path': 'notes.txt'},
    {'path': 'notes.txt', 'max_bytes': '100'},    # 字符串不是整数
    {'path': 'notes.txt', 'max_bytes': 0},        # 小于下限
    {'path': 'notes.txt', 'max_bytes': 1048577},  # 大于上限
    {'path': 'notes.txt', 'max_bytes': True},     # 布尔不是整数（Python 里 bool 是 int 的子类）
    {'path': 'notes.txt', 'mode': 'delete'},      # 不在枚举里
    {'max_bytes': 100},                           # 缺必填
    {},
    {'path': 42},
]

ok = 0
for i, c in enumerate(CASES, 1):
    e = validate(SCHEMA, c)
    ok += 1 if e else 0
    print(i, '拒绝' if e else '放过', '|', '；'.join(e) if e else json.dumps(c, ensure_ascii=False))
print('拦下', ok, '/', len(CASES))