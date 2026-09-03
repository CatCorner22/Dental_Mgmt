#!/usr/bin/env bash
# Verifies the planning repository. Usage: bash scripts/verify-docs.sh [path-to-dental-checkout] [path-to-precog-checkout]
set -u
cd "$(dirname "$0")/.."
DENTAL="${1:-/home/user/catcorner22/dental}"; PRECOG="${2:-/home/user/catcorner22/precog}"
python3 - "$DENTAL" "$PRECOG" <<'PY'
import os, re, sys, glob
dental, precog = sys.argv[1], sys.argv[2]
fails = 0
def report(name, problems, info=''):
    global fails
    if problems:
        fails += 1; print(f'FAIL {name}: {len(problems)} problem(s)')
        for p in problems[:25]: print('   -', p)
        if len(problems) > 25: print(f'   … {len(problems)-25} more')
    else:
        print(f'PASS {name}' + (f' ({info})' if info else ''))
# 1. relative links resolve
probs = []; n = 0
for path in glob.glob('docs/**/*.md', recursive=True) + glob.glob('knowledge/**/*.md', recursive=True) + ['README.md']:
    text = open(path).read()
    for m in re.finditer(r'\]\(([^)\s]+)\)', text):
        target = m.group(1)
        if target.startswith(('http://', 'https://', 'mailto:', '#')) or '<' in target: continue  # skip the INDEX format example
        n += 1
        t = target.split('#')[0]
        if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(path), t))): probs.append(f'{path} -> {target}')
report('relative links resolve', probs, f'{n} links checked')
# 2. INDEX parity
idx = open('knowledge/INDEX.md').read(); probs = []
for d in ('sources', 'reviews'):
    for f in sorted(os.listdir(f'knowledge/{d}')):
        c = idx.count(f'({d}/{f})')
        if c != 1: probs.append(f'{d}/{f} listed {c} times')
for m in re.finditer(r'\]\((sources|reviews)/([^)]+)\)', idx):
    if '<' in m.group(2): continue  # format example line
    if not os.path.exists(f'knowledge/{m.group(1)}/{m.group(2)}'): probs.append(f'INDEX points at missing {m.group(1)}/{m.group(2)}')
report('knowledge/INDEX.md lists every source and review exactly once', probs)
# 3. labels on regulatory table rows in docs/06 (rows that cite law must carry a label)
labels = re.compile(r'\b(PRIMARY|SECONDARY|REPO|UNVERIFIED)\b')
cite = re.compile(r'(CFR|Tenn\. Code|Rule 0460|Tenn\. Comp|U\.S\.C\.|FR \d|PCI DSS|HIPAA|HITECH)')
probs = []; rows = 0; prose_unlabeled = 0
sec = open('docs/06-security-and-hipaa-plan.md').read().split('\n')
in_reg = False
for i, l in enumerate(sec, 1):
    if l.startswith('## '): in_reg = l.startswith('## Regulatory scope') or l.startswith('## Breach and incident')
    if in_reg and l.startswith('| ') and not l.startswith('|---') and cite.search(l) and not l.startswith('| Regime') and not l.startswith('| Notice') and not l.startswith('| # '):
        rows += 1
        if not labels.search(l): probs.append(f'docs/06 line {i}: unlabeled table row: {l[:80]}')
    elif cite.search(l) and not labels.search(l) and not l.startswith('|'): prose_unlabeled += 1
report('every regulatory-table and breach-clock row in docs/06 carries a label', probs, f'{rows} rows checked; {prose_unlabeled} prose lines cite law without an inline label and inherit the table row they elaborate')
# 4. paths in docs/00 exist in the checkouts
text = open('docs/00-review-of-dental-and-precog.md').read()
cands = set(re.findall(r'`((?:src|docs|knowledge|e2e|skill|public|drizzle|migrations|scripts)/[^`\s]+|design-tokens\.json|AGENTS\.md|next\.config\.mjs|\.github/workflows/ci\.yml)`', text))
def expand(p):
    m = re.search(r'\{([^}]+)\}', p)
    if not m: return [p]
    out = []
    for alt in m.group(1).split(','): out += expand(p[:m.start()] + alt.strip() + p[m.end():])
    return out
probs = []; checked = 0
if os.path.isdir(dental) and os.path.isdir(precog):
    for c in sorted(cands):
        for p in expand(c):
            p = p.rstrip('/').replace('/**', '').replace('**', '').rstrip('/')
            if not p: continue
            checked += 1
            hit = any(glob.glob(os.path.join(root, p)) or glob.glob(os.path.join(root, p + '*')) for root in (dental, precog, '.'))  # '.' covers this repo's own docs/ and knowledge/ paths
            if not hit: probs.append(p)
    report('repository paths named in docs/00 exist in a dental or precog checkout', probs, f'{checked} paths checked')
else:
    print('SKIP path existence check (checkouts not found; pass their paths as arguments)')
# 5. roadmap shape
road = open('docs/08-roadmap.md').read()
phases = re.findall(r'^## Phase \d', road, re.M)
sc, ex, dp = road.count('**Scope.**'), road.count('**Exit criteria.**'), road.count('**Dependencies.**')
probs = [] if (len(phases) == 6 and sc == 6 and ex == 6 and dp == 6) else [f'phases={len(phases)} scope={sc} exit={ex} deps={dp}']
report('docs/08 has six phases, each with scope, exit criteria, dependencies', probs)
# 6. decisions vs ADRs
dec = open('docs/10-decisions-for-owner.md').read()
rows = re.findall(r'^\| (\d+a?) \|', dec, re.M)
adrs = [f for f in os.listdir('docs/adr') if f.startswith('ADR-')]
probs = [] if len(rows) == len(adrs) else [f'{len(rows)} decision rows vs {len(adrs)} ADR files']
report('decision table rows match ADR files', probs, f'{len(rows)} decisions')
sys.exit(1 if fails else 0)
PY
