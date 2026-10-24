# pricing.py —— 重构前：一个函数承担 4 件事
# 坏味道清单：长函数 / 嵌套 3 层 / 年限分档判断复制了 3 份 /
#             满减规则与 estimate() 重复 / 魔法数字 0.85、0.90、0.95、0.98、0.02


def price(user_type, amount, years):
    if user_type == 'vip':
        if years >= 3:
            rate = 0.85
        elif years >= 1:
            rate = 0.90
        else:
            rate = 0.95
    elif user_type == 'member':
        if years >= 3:
            rate = 0.90
        elif years >= 1:
            rate = 0.95
        else:
            rate = 1.00
    elif user_type == 'trial':
        if years >= 1:
            rate = 0.98
        else:
            rate = 1.00
    else:
        raise ValueError('未知用户类型')
    if amount > 10000 and rate > 0.90:
        rate = rate - 0.02
    return round(amount * rate, 2)


def estimate(user_type, amount, years):
    # 与 price() 里重复的一份满减规则：改促销时最容易漏改这里
    rate = 1.00
    if user_type == 'vip':
        rate = 0.90
    if amount > 10000 and rate > 0.90:
        rate = rate - 0.02
    return round(amount * rate, 2)
