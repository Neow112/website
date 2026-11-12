#!/usr/bin/env python3
"""Сборка сайта SAPFIR: content/content.json + src/*.html -> _site/ (RU, KZ, UG).

Запуск локально:  python tools/build.py           (результат в _site/)
Только проверка:  python tools/build.py --check   (ничего не пишет)
Только стандартная библиотека Python 3.9+.
"""
import html, json, os, re, shutil, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_site')
LANGS = ('ru', 'kk', 'ug')
# Что не попадает на сайт
SKIP = {'_site', 'src', 'content', 'tools', '.github', '.git', 'README.md', '.gitignore'}

PLATFORMS = [
    ('YouTube', re.compile(r'(?:youtube\.com/(?:shorts/|watch\?v=|embed/|live/)|youtu\.be/)[\w-]{6,}')),
    ('Instagram', re.compile(r'instagram\.com/(?:[\w.]+/)?(?:reels?|p|tv)/[\w-]+')),
    ('TikTok', re.compile(r'tiktok\.com/.*?/video/\d+')),
]
SOCIAL = {'Instagram': r'instagram\.com/[\w.]+', 'TikTok': r'tiktok\.com/@[\w.]+',
          'YouTube': r'youtube\.com/(?:@|channel/|c/)[\w.-]+', 'Telegram': r't\.me/\w+'}

class ContentError(Exception):
    pass

def esc(v):
    return html.escape(v, quote=True)

def video_platform(url):
    for name, rx in PLATFORMS:
        if rx.search(url):
            return name
    return None

def fmt_phone(d):
    return '+%s %s %s %s' % (d[0], d[1:4], d[4:7], d[7:11])

def focus_style(f):
    return '' if not f else ' style="object-position:%s%% %s%%"' % (f['x'], f['y'])

# ---------- проверка данных ----------
def validate(c):
    errs = []
    def need_langs(obj, where):
        if not isinstance(obj, dict) or any(not str(obj.get(l, '')).strip() for l in LANGS):
            errs.append('%s: нужен текст на RU, KZ и UG' % where)
    def need_file(rel, where):
        if not os.path.isfile(os.path.join(ROOT, 'images', rel)):
            errs.append('%s: нет файла images/%s' % (where, rel))
    def need_focus(f, where):
        if f is not None and not (isinstance(f, dict) and all(isinstance(f.get(k), (int, float)) and 0 <= f[k] <= 100 for k in ('x', 'y'))):
            errs.append('%s: точка фокуса должна быть {"x": 0..100, "y": 0..100}' % where)
    for k, v in c['texts'].items():
        need_langs(v, 'Текст «%s»' % k)
    ids = set()
    for i, m in enumerate(c['members'], 1):
        w = 'Участница %d (%s)' % (i, m.get('name') or 'без имени')
        if not m.get('name', '').strip(): errs.append(w + ': нет имени')
        if not re.fullmatch(r'[a-z0-9-]+', m.get('id', '')) or m['id'] in ids: errs.append(w + ': id должен быть уникальным, латиницей')
        ids.add(m.get('id'))
        need_file(m['photo']['src'], w); need_file(m['photo']['full'], w); need_focus(m.get('focus'), w)
    for i, g in enumerate(c['gallery'], 1):
        w = 'Фото галереи %d' % i
        need_langs(g.get('caption'), w)
        b = g['photo']['base']
        if g['photo'].get('format') == 'jpg':
            files = (b + '.jpg', '%s-750.jpg' % b, '%s-%d.jpg' % (b, g['photo']['w']))
        else:
            files = (b + '.jpg', b + '.webp', b + '-750.webp')
        for f in files: need_file(f, w)
        need_focus(g.get('focus'), w)
    for i, v in enumerate(c['videos'], 1):
        w = 'Видео %d' % i
        if not video_platform(v.get('url', '')): errs.append(w + ': ссылка не похожа на YouTube, Instagram или TikTok')
        if v.get('title') is not None: need_langs(v['title'], w + ', подпись')
        cv = v['cover']
        ext = 'jpg' if cv.get('format') == 'jpg' else 'webp'
        large = '%s-%d.jpg' % (cv['base'], cv['w']) if ext == 'jpg' else cv['base'] + '.webp'
        for f in (cv['base'] + '.jpg', large, '%s-%d.%s' % (cv['base'], cv['small'], ext)): need_file(f, w)
    ct = c['contacts']
    if not ct['phones']: errs.append('Контакты: нужен хотя бы один телефон')
    for i, p in enumerate(ct['phones'], 1):
        if not re.fullmatch(r'7\d{10}', p.get('number', '')): errs.append('Телефон %d: нужно 11 цифр, начиная с 7' % i)
    for s in ct['socials']:
        if s['platform'] not in SOCIAL or not re.search(SOCIAL[s['platform']], s.get('url', '')):
            errs.append('Соцсеть %s: неверная ссылка' % s['platform'])
    need_langs(ct['whatsappText'], 'Сообщение WhatsApp')
    if errs:
        raise ContentError('\n'.join(errs))

# ---------- блоки ----------
def render_members(c, L, p):
    out = []
    for m in c['members']:
        n = esc(m['name'])
        ph = m['photo']
        out.append('<article class="team-card reveal" data-person="%s"><a class="portrait photo-link" href="%simages/%s" data-lightbox="team" data-caption="%s" aria-label="%s — %s"><img src="%simages/%s" width="%d" height="%d" alt="%s — %s" loading="lazy" decoding="async"%s></a><div class="person-info"><h3>%s</h3></div></article>'
                   % (esc(m['id']), p, esc(ph['full']), n, esc(L['open_photo']), n, p, esc(ph['src']), ph['w'], ph['h'], esc(L['member_alt']), n, focus_style(m.get('focus')), n))
    return ''.join(out)

def render_gallery(c, lang, L, p):
    out = []
    for g in c['gallery']:
        cap = esc(g['caption'][lang]); b = esc(g['photo']['base']); w, h = g['photo']['w'], g['photo']['h']
        if g['photo'].get('format') == 'jpg':
            srcset = '%simages/%s-750.jpg 750w, %simages/%s-%d.jpg %dw' % (p, b, p, b, w, w); mime = 'image/jpeg'
        else:
            srcset = '%simages/%s-750.webp 750w, %simages/%s.webp %dw' % (p, b, p, b, w); mime = 'image/webp'
        out.append('<a class="gallery-item photo-link reveal" href="%simages/%s.jpg" data-lightbox="gallery" data-caption="%s" aria-label="%s — %s"><picture><source srcset="%s" sizes="(max-width: 760px) 48vw, 31vw" type="%s"><img src="%simages/%s.jpg" alt="%s — SAPFIR" width="%d" height="%d" loading="lazy" decoding="async"%s></picture></a>'
                   % (p, b, cap, esc(L['open_photo']), cap, srcset, mime, p, b, cap, w, h, focus_style(g.get('focus'))))
    return ''.join(out)

def render_videos(c, lang, L, p):
    vids = c['videos']; n = len(vids); car = n > 1
    if not n:
        return ''
    cards = []
    for v in vids:
        title = (v.get('title') or {}).get(lang, '')
        cv = v['cover']; b = esc(cv['base'])
        sizes = '(max-width: 760px) 82vw, 31vw' if car else '(max-width: 760px) 100vw, 80vw'
        label = L['watch'] + (' — ' + title if title else '')
        cap = '<span class="film-caption"><strong>%s</strong></span>' % esc(title) if title else ''
        if cv.get('format') == 'jpg':
            srcset = '%simages/%s-%d.jpg %dw, %simages/%s-%d.jpg %dw' % (p, b, cv['small'], cv['small'], p, b, cv['w'], cv['w']); mime = 'image/jpeg'
        else:
            srcset = '%simages/%s-%d.webp %dw, %simages/%s.webp %dw' % (p, b, cv['small'], cv['small'], p, b, cv['w']); mime = 'image/webp'
        cards.append('<a class="film-play" href="%s" target="_blank" rel="noopener noreferrer" data-open-video data-platform="%s" aria-label="%s">'
                     '<picture><source srcset="%s" sizes="%s" type="%s">'
                     '<img src="%simages/%s.jpg" width="%d" height="%d" alt="%s" loading="lazy" decoding="async"></picture>'
                     '<span class="film-shade"></span><span class="play-orb"><svg class="icon"><use href="#i-play"/></svg></span>%s'
                     '<span class="film-corner"><svg class="icon"><use href="#i-arrow"/></svg></span></a>'
                     % (esc(v['url']), video_platform(v['url']), esc(label), srcset, sizes, mime,
                        p, b, cv['w'], cv['h'], esc(title or L['video_alt']), cap))
    out = '<div class="film-stage reveal%s" data-count="%d"><div class="film-track">%s</div>' % (' is-carousel' if car else '', n, ''.join(cards))
    if car:
        out += ('<div class="film-controls"><span class="film-progress" aria-hidden="true"><i></i></span><span class="film-arrows">'
                '<button class="icon-button film-arrow film-prev" type="button" data-film-prev aria-label="%s"><svg class="icon"><use href="#i-next"/></svg></button>'
                '<button class="icon-button film-arrow" type="button" data-film-next aria-label="%s"><svg class="icon"><use href="#i-next"/></svg></button></span></div>') % (esc(L['prev']), esc(L['next']))
    return out + '</div>'

def render_socials(c):
    return ''.join('<a href="%s" target="_blank" rel="noopener noreferrer">%s <svg class="icon"><use href="#i-arrow"/></svg></a>' % (esc(s['url']), esc(s['platform']))
                   for s in c['contacts']['socials'] if s.get('visible', True))

def render_phones(c, lang, L):
    text = urllib.parse.quote(c['contacts']['whatsappText'][lang], safe='')
    out = []
    for ph in c['contacts']['phones']:
        d = ph['number']; f = fmt_phone(d)
        if ph.get('whatsapp', True):
            first = '<a href="https://wa.me/%s?text=%s" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp %s">%s <svg class="icon"><use href="#i-wa"/></svg></a>' % (d, text, f, f)
        else:
            first = '<a href="tel:+%s" aria-label="%s %s">%s</a>' % (d, esc(L['call']), f, f)
        call = '<a class="phone-call icon-button" href="tel:+%s" aria-label="%s %s"><svg class="icon"><use href="#i-phone"/></svg></a>' % (d, esc(L['call']), f) if ph.get('call', True) else ''
        out.append('<div class="phone-row">%s%s</div>' % (first, call))
    return ''.join(out)

def patch_ldjson(page, c):
    def repl(m):
        data = json.loads(m.group(2))
        data['sameAs'] = [s['url'] for s in c['contacts']['socials'] if s.get('visible', True)]
        old = data.get('contactPoint') or [{}]
        tmpl = {k: v for k, v in old[0].items() if k != 'telephone'}
        data['contactPoint'] = [dict([('@type', 'ContactPoint'), ('telephone', '+' + p['number'])] + [(k, v) for k, v in tmpl.items() if k != '@type']) for p in c['contacts']['phones']]
        return m.group(1) + json.dumps(data, ensure_ascii=False) + m.group(3)
    return re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', repl, page, count=1, flags=re.S)

def render_page(c, lang, L):
    p = L['prefix']
    page = open(os.path.join(ROOT, 'src', lang + '.html'), encoding='utf-8').read()
    page = re.sub(r'\{\{t:(\w+)\}\}', lambda m: esc(c['texts'][m.group(1)][lang]), page)
    first = c['videos'][0]['url'] if c['videos'] else ''
    blocks = {
        'members': render_members(c, L, p), 'gallery': render_gallery(c, lang, L, p), 'videos': render_videos(c, lang, L, p),
        'films_hidden': '' if c['videos'] else ' hidden', 'fallback_href': esc(first),
        'fallback_text': esc(L['fallback'].replace('{p}', video_platform(first) or 'YouTube')),
        'socials': render_socials(c), 'phones': render_phones(c, lang, L),
    }
    page = re.sub(r'\{\{@(\w+)\}\}', lambda m: blocks[m.group(1)], page)
    page = patch_ldjson(page, c)
    left = re.findall(r'\{\{[^}]*\}\}', page)
    if left:
        raise ContentError('Не заполнены места в шаблоне %s: %s' % (lang, ', '.join(left)))
    return page

def build(check=False):
    c = json.load(open(os.path.join(ROOT, 'content', 'content.json'), encoding='utf-8'))
    validate(c)
    strings = json.load(open(os.path.join(ROOT, 'src', 'strings.json'), encoding='utf-8'))
    pages = {strings[l]['out']: render_page(c, l, strings[l]) for l in LANGS}
    if not c['videos']:
        print('Внимание: видео нет — блок «Шоу» скрыт', file=sys.stderr)
    if check:
        return pages
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for name in os.listdir(ROOT):
        if name in SKIP or name in ('index.html', 'kk', 'ug'):
            continue
        src = os.path.join(ROOT, name)
        (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, os.path.join(OUT, name))
    for rel, html_text in pages.items():
        dst = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, 'w', encoding='utf-8', newline='\n') as f:
            f.write(html_text)
    return pages

if __name__ == '__main__':
    try:
        build(check='--check' in sys.argv)
        print('Готово' + ('' if '--check' in sys.argv else ': _site/'))
    except ContentError as e:
        print('Сайт не собран — исправьте данные:\n' + str(e), file=sys.stderr)
        sys.exit(1)
