import json

REF = '7天内可无理由退货'


def char_overlap(answer, ref=REF):
    a, b = set(answer), set(ref)
    return round(len(a & b) / len(a | b), 3) if (a | b) else 0.0


def score_exact(answer, ref=REF):
    return 1.0 if answer.strip() == ref.strip() else 0.0


def score_fragments(answer, keys=('退货', '7')):
    return 1.0 if all(k in answer for k in keys) else 0.0


def score_json(answer, fields=('amount', 'date', 'party')):
    try:
        obj = json.loads(answer)
    except (json.JSONDecodeError, TypeError):
        return 0.0
    if not isinstance(obj, dict):
        return 0.0
    return 1.0 if all(f in obj for f in fields) else 0.0


def score_refuse(answer, markers=('无法', '不能', '没有相关', '资料中没')):
    return 1.0 if any(m in answer for m in markers) else 0.0


if __name__ == '__main__':
    answers = [
        '7天内可无理由退货',
        '7天内可退货，需保留包装',
        '自签收次日起7天',
        '30天内可退货',
    ]
    print('%-24s %6s %8s %8s' % ('回答', '精确', '关键片段', '字符重叠'))
    for a in answers:
        print('%-24s %6.0f %8.0f %8.3f' % (a, score_exact(a), score_fragments(a), char_overlap(a)))

    print()
    print('拒答判定：')
    for a in ('资料中没有相关内容，无法判断', '7天内可退货'):
        print('  %-24s → %.0f' % (a, score_refuse(a)))

    print()
    print('结构校验：')
    for a in ('{"amount": 1200, "date": "2026-03-01", "party": "甲公司"}',
              '{"amount": 1200}',
              '金额是 1200 元'):
        print('  %-52s → %.0f' % (a[:52], score_json(a)))
