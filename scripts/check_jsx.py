from pathlib import Path
import re
p=Path('frontend/components/SendMessagesPage.tsx')
text=p.read_text(encoding='utf-8')
# simple regex to find tags, including self-closing
pattern=re.compile(r'<(/?)([A-Za-z][A-Za-z0-9_]*)\b([^>]*)>')
self_closing={"input","img","br","hr","meta","link","base","col","embed","source","track","wbr","area","param","keygen","menuitem"}
stack=[]
for m in pattern.finditer(text):
    closing=m.group(1)=="/"
    name=m.group(2)
    rest=m.group(3) or ''
    # detect explicit self-closing like <tag ... />
    explicit_self = rest.strip().endswith('/')
    if not closing and (name in self_closing or explicit_self):
        continue
    if closing:
        if stack and stack[-1]==name:
            stack.pop()
        else:
            pos = m.start()
            line = text[:pos].count('\n')+1
            print('UNMATCHED_CLOSING', name, 'at pos', pos, 'line', line)
            print('current stack (top last):', stack[-10:])
            s=max(0,pos-200)
            e=min(len(text), pos+200)
            ctx = text[s:e]
            # show surrounding lines
            start_line = text[:s].count('\n')+1
            for i, l in enumerate(ctx.splitlines(), start=start_line):
                print(f'{i:5}: {l}')
            break
    else:
        stack.append(name)
else:
    if stack:
        print('UNMATCHED_OPEN stack top->bottom (last 20):')
        for t in stack[-20:]:
            print(t)
    else:
        print('All tags balanced')
