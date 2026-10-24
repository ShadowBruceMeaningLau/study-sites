# 三道检查叠在一起：规范化、前缀、扩展名
import posixpath

ROOT = '/srv/notes'
ALLOWED_EXT = ('.txt', '.md')


def allow(path):
    if not path or '\x00' in path:
        return False, '空路径或含空字节'
    full = posixpath.normpath(posixpath.join(ROOT, path))
    real_root = posixpath.normpath(ROOT)
    if not (full == real_root or full.startswith(real_root + '/')):
        return False, '规范化后跑出白名单：' + full
    if full == real_root:
        return False, '指向目录本身'
    ext = posixpath.splitext(full)[1].lower()
    if ext not in ALLOWED_EXT:
        return False, '扩展名不在白名单：' + (ext or '（无）')
    return True, full


PATHS = ['notes.txt', 'sub/a.md', '../etc/passwd', '../../../root/.ssh/id_rsa',
         '/etc/passwd', 'a/../../b.txt', 'run.sh', 'data.csv', '', 'ok.md']

blocked = 0
for p in PATHS:
    ok, why = allow(p)
    blocked += 0 if ok else 1
    print('%-26s %s  %s' % (repr(p), '放行' if ok else '拦截', why))
print('拦下', blocked, '/', len(PATHS))