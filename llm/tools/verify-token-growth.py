# 独立复核：固定系统提示 + 每轮同一句短问题，5 轮的 prompt token 增长
import json, urllib.request
URL='http://127.0.0.1:11434/v1/chat/completions'
msgs=[{"role":"system","content":"你是一个简洁的助手。"}]
prev=None
for turn in range(1,6):
    msgs.append({"role":"user","content":"用一句话解释缓存。"})
    body=json.dumps({"model":"qwen2:1.5b","messages":msgs,"stream":False,"max_tokens":40}).encode()
    req=urllib.request.Request(URL,data=body,headers={"Content-Type":"application/json"})
    r=json.loads(urllib.request.urlopen(req,timeout=180).read().decode())
    pt=r["usage"]["prompt_tokens"]; ct=r["usage"]["completion_tokens"]
    print(f"turn {turn}: prompt_tokens={pt} completion={ct} step={'-' if prev is None else pt-prev}")
    prev=pt
    msgs.append({"role":"assistant","content":r["choices"][0]["message"]["content"]})
