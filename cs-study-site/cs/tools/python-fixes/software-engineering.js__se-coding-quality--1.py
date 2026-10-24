# pricing.py —— 重构后：费率变成数据（表），年限分档与满减各只有一个实现
RATE_TABLE = {
    'vip':    (0.85, 0.90, 0.95),   # 按档位索引：长（>=3 年）/ 中（>=1 年）/ 新
    'member': (0.90, 0.95, 1.00),
    'trial':  (0.98, 0.98, 1.00),   # 注意仍保持原行为：试用 >=3 年也是 0.98
}
TIER_LONG, TIER_MID, TIER_NEW = 0, 1, 2
LONG_TERM_YEARS = 3
BULK_AMOUNT = 10000
BULK_MIN_RATE = 0.90
BULK_DISCOUNT = 0.02


def year_tier(years):
    if years >= LONG_TERM_YEARS:
        return TIER_LONG
    if years >= 1:
        return TIER_MID
    return TIER_NEW


def bulk_adjusted(rate, amount):
    if amount > BULK_AMOUNT and rate > BULK_MIN_RATE:
        return rate - BULK_DISCOUNT
    return rate


def final_rate(user_type, amount, years):
    if user_type not in RATE_TABLE:
        raise ValueError('未知用户类型')
    return bulk_adjusted(RATE_TABLE[user_type][year_tier(years)], amount)


def price(user_type, amount, years):
    return round(amount * final_rate(user_type, amount, years), 2)


def estimate(user_type, amount, years):
    return price(user_type, amount, years)   # 预估与实际计价共用同一套规则，不会再改漏一处
