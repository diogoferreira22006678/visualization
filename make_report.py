from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

doc = Document()

# ── Page margins (A4, 2.5cm all sides) ──────────────────────────────────────
for section in doc.sections:
    section.page_width  = Cm(21)
    section.page_height = Cm(29.7)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)
    section.top_margin    = Cm(2.5)
    section.bottom_margin = Cm(2.5)

# ── Styles helpers ───────────────────────────────────────────────────────────
ACCENT = RGBColor(0x2c, 0x3e, 0x7a)
MUTED  = RGBColor(0x55, 0x55, 0x55)
BLACK  = RGBColor(0x1a, 0x1a, 0x2e)

def set_run(run, bold=False, italic=False, color=None, size=None, font='Calibri'):
    run.bold   = bold
    run.italic = italic
    if color: run.font.color.rgb = color
    if size:  run.font.size = Pt(size)
    run.font.name = font

def para_spacing(p, before=0, after=8, line=None):
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after  = Pt(after)
    if line:
        pf.line_spacing = Pt(line)

def add_heading(doc, text, level=1, num=None):
    p = doc.add_paragraph()
    para_spacing(p, before=0, after=6)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if num:
        r = p.add_run(num + '  ')
        set_run(r, color=MUTED, size=9, font='Calibri')
    r = p.add_run(text)
    set_run(r, bold=True, color=ACCENT, size=16 if level == 1 else 13, font='Calibri')
    # bottom border
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'),   'single')
    bottom.set(qn('w:sz'),    '12')
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), '2c3e7a')
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p

def add_fig_placeholder(doc, fig_num, caption):
    # Shaded box
    p = doc.add_paragraph()
    para_spacing(p, before=12, after=4)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f'[ Inserir captura de ecrã — Figura {fig_num} ]')
    set_run(run, italic=True, color=MUTED, size=10)
    # light grey shading
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'),   'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'),  'F0F2F8')
    pPr.append(shd)
    # border around paragraph
    pBdr = OxmlElement('w:pBdr')
    for side in ('top', 'left', 'bottom', 'right'):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:val'),   'single')
        el.set(qn('w:sz'),    '6')
        el.set(qn('w:space'), '4')
        el.set(qn('w:color'), 'D0D5E0')
        pBdr.append(el)
    pPr.append(pBdr)
    # caption line
    cap = doc.add_paragraph()
    para_spacing(cap, before=2, after=14)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = cap.add_run(f'Figura {fig_num}')
    set_run(r1, bold=True, size=9, color=BLACK)
    r2 = cap.add_run(f' — {caption}')
    set_run(r2, italic=True, size=9, color=MUTED)

def add_body(doc, text):
    p = doc.add_paragraph()
    para_spacing(p, before=0, after=10, line=14)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = p.add_run(text)
    set_run(r, size=11, font='Calibri')
    return p

def add_page_break(doc):
    p = doc.add_paragraph()
    r = p.add_run()
    r.add_break(__import__('docx.enum.text', fromlist=['WD_BREAK']).WD_BREAK.PAGE)
    para_spacing(p, before=0, after=0)

# ════════════════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════════════════
doc.add_paragraph()  # top spacer
doc.add_paragraph()

badge = doc.add_paragraph()
para_spacing(badge, before=0, after=6)
badge.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = badge.add_run('VISUALIZAÇÃO DE INFORMAÇÃO')
set_run(r, bold=True, size=9, color=ACCENT, font='Calibri')

title = doc.add_paragraph()
para_spacing(title, before=14, after=4)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = title.add_run('Dashboard de Preços\nde Habitação em Paris')
set_run(r, bold=True, size=26, color=ACCENT, font='Calibri')

sub = doc.add_paragraph()
para_spacing(sub, before=4, after=20)
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run('Paris Housing Price Prediction Dataset')
set_run(r, size=13, color=MUTED, font='Calibri')

# rule line (via bottom border on empty paragraph)
rule = doc.add_paragraph()
para_spacing(rule, before=0, after=0)
rule.alignment = WD_ALIGN_PARAGRAPH.CENTER
pPr = rule._p.get_or_add_pPr()
pBdr = OxmlElement('w:pBdr')
bot = OxmlElement('w:bottom')
bot.set(qn('w:val'),   'single')
bot.set(qn('w:sz'),    '18')
bot.set(qn('w:space'), '4')
bot.set(qn('w:color'), '2c3e7a')
pBdr.append(bot)
pPr.append(pBdr)

doc.add_paragraph()
doc.add_paragraph()

for label, value in [
    ('Unidade Curricular', 'Visualização de Informação'),
    ('Ano Letivo', '2025 / 2026'),
    ('Dataset', 'Paris Housing Price Prediction (Kaggle)'),
    ('Tecnologia', 'D3.js v7, noUiSlider, HTML5 / CSS3'),
]:
    p = doc.add_paragraph()
    para_spacing(p, before=2, after=2)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run(label + ':  ')
    set_run(r1, bold=True, size=10, color=BLACK, font='Calibri')
    r2 = p.add_run(value)
    set_run(r2, size=10, color=MUTED, font='Calibri')

add_page_break(doc)

# ════════════════════════════════════════════════════════════════════
# PAGE 1 — DASHBOARD
# ════════════════════════════════════════════════════════════════════
add_heading(doc, 'Esboço do Dashboard', num='Secção 1')
add_fig_placeholder(doc, 1, 'Esboço do dashboard completo')

add_body(doc,
    'O dashboard Paris Housing Price Analysis apresenta uma análise exploratória e interativa do mercado '
    'imobiliário parisiense com base no dataset Paris Housing Price Prediction, disponível no Kaggle. '
    'A interface organiza-se em três níveis hierárquicos: um cabeçalho com indicadores KPI (imóveis '
    'selecionados, preço médio, área média e proporção com piscina), uma barra de filtros globais e uma '
    'grelha 2×2 com os quatro gráficos analíticos. O tema visual adota um fundo escuro com cartões em '
    'glassmorphism, privilegiando o contraste e a leitura imediata dos dados em condições de baixa '
    'luminosidade — escolha comum em dashboards de monitorização profissional.'
)

add_body(doc,
    'Toda a interatividade assenta num estado global partilhado entre os quatro gráficos, de modo que '
    'qualquer alteração de filtro propaga automaticamente uma atualização coordenada e animada de todos '
    'os elementos visuais. A barra de filtros expõe três dimensões de seleção: um slider de preço com '
    'dois handles (intervalo mínimo-máximo), chips individuais por zona geográfica (cityPartRange) e '
    'botões de seleção para a presença de piscina. Os contadores KPI animam-se com easing cúbico aquando '
    'de cada atualização, reforçando a perceção de mudança. Os tooltips contextuais, posicionados de '
    'forma dinâmica, fornecem valores exatos ao passar o cursor sobre qualquer elemento interativo.'
)

add_page_break(doc)

# ════════════════════════════════════════════════════════════════════
# PAGE 2 — GRÁFICO 1
# ════════════════════════════════════════════════════════════════════
add_heading(doc, 'Gráfico 1 — Preço Médio por Zona', num='Secção 2')
add_fig_placeholder(doc, 2, 'Esboço do primeiro gráfico')

add_body(doc,
    'O primeiro gráfico responde à questão de como o preço médio de habitação varia entre as diferentes '
    'zonas da cidade, representadas pela variável ordinal cityPartRange (valores de 1 a 9, do menos ao '
    'mais exclusivo). Trata-se de um gráfico de barras verticais em que o eixo horizontal codifica o '
    'nível de zona e o eixo vertical o preço médio em euros. A terceira variável codificada é a área '
    'média dos imóveis (squareMeters), representada através da cor de cada barra numa escala sequencial '
    'que vai do azul escuro ao ciano. Esta codificação tripla permite identificar simultaneamente as '
    'zonas com preços mais elevados, as que concentram imóveis de maior dimensão e, sobretudo, investigar '
    'se existe correlação entre área e valor de mercado ao longo do espectro de zonas.'
)

add_body(doc,
    'Do ponto de vista técnico, o eixo de zonas utiliza d3.scaleBand() com um padding de 0,28, '
    'conferindo espaçamento visual proporcional entre as barras. A cor é calculada com '
    'd3.scaleSequential() em conjunto com d3.interpolateRgb(), com domínio recalculado dinamicamente a '
    'cada interação de filtro, garantindo que a legenda gradiente SVG reflete sempre os valores mínimo '
    'e máximo da seleção atual. As barras exibem rótulos de valor no topo e respondem ao hover com um '
    'tooltip que apresenta a zona, o preço médio, a área média e a contagem de imóveis. As entradas e '
    'transições entre estados são animadas com easing cúbico a 600 ms para entradas e 500 ms para '
    'atualizações.'
)

add_page_break(doc)

# ════════════════════════════════════════════════════════════════════
# PAGE 3 — GRÁFICO 2
# ════════════════════════════════════════════════════════════════════
add_heading(doc, 'Gráfico 2 — Evolução por Ano de Construção', num='Secção 3')
add_fig_placeholder(doc, 3, 'Esboço do segundo gráfico')

add_body(doc,
    'O segundo gráfico analisa a evolução do preço médio de habitação em função do ano de construção '
    '(made), respondendo à questão de como o período histórico de edificação influencia o valor atual '
    'dos imóveis. O canal visual primário é uma linha contínua com preenchimento de área subjacente '
    'que codifica a tendência de preço médio ao longo do tempo. Os círculos sobrepostos em cada ano '
    'introduzem a terceira variável: a contagem de imóveis construídos nesse ano, codificada pelo raio '
    'do ponto. Desta forma, o gráfico não só revela tendências de valorização ao longo do tempo, como '
    'também evidencia a densidade histórica de construção, permitindo identificar períodos de maior '
    'atividade imobiliária e correlacionar essa atividade com os preços praticados.'
)

add_body(doc,
    'A escala de raio utiliza d3.scaleSqrt() com domínio [1, máx] e range [2,5 – 9] px, assegurando '
    'que a perceção visual de área dos pontos é proporcional à contagem (e não ao raio, que seria '
    'perceptualmente enganoso). O traçado da linha recorre a d3.curveMonotoneX para uma interpolação '
    'suave sem artefactos de sobreposição. Na primeira renderização, a linha é animada progressivamente '
    'através de stroke-dasharray/stroke-dashoffset, conferindo impacto visual à carga inicial dos dados. '
    'O hover sobre qualquer ponto ativa um crosshair vertical e um tooltip com o ano, preço médio e '
    'número de imóveis, enquanto o raio do ponto é temporariamente ampliado para reforçar a seleção.'
)

add_page_break(doc)

# ════════════════════════════════════════════════════════════════════
# PAGE 4 — GRÁFICO 3
# ════════════════════════════════════════════════════════════════════
add_heading(doc, 'Gráfico 3 — Distribuição dos Preços', num='Secção 4')
add_fig_placeholder(doc, 4, 'Esboço do terceiro gráfico')

add_body(doc,
    'O terceiro gráfico apresenta a distribuição dos preços de habitação através de um histograma '
    'empilhado (stacked histogram). O eixo horizontal corresponde ao preço em euros e o eixo vertical '
    'à contagem de imóveis por intervalo de preço. A terceira variável codificada é o tipo de construção '
    '(isNewBuilt): o segmento inferior em violeta representa imóveis de construção antiga '
    '(isNewBuilt = 0) e o segmento superior em verde representa imóveis de construção nova '
    '(isNewBuilt = 1). Esta representação tridimensional permite não só compreender a forma global da '
    'distribuição de preços — incluindo assimetrias e modas —, como também identificar em que gamas de '
    'preço se concentram os novos empreendimentos face ao parque imobiliário existente, revelando '
    'possíveis sobrepreços ou descontos associados à nova construção.'
)

add_body(doc,
    'Os bins são calculados com d3.bin() com 28 intervalos, usando como domínio fixo os extremos do '
    'dataset completo (antes de qualquer filtro), garantindo que o eixo horizontal permanece estável '
    'durante as interações e que comparações entre seleções distintas são visualmente fidedignas. Uma '
    'linha vermelha tracejada assinala a média do preço na seleção atual e o seu valor é exibido em '
    'legenda inline junto à linha. A remoção de outliers de preço por IQR (fator 1,5) foi aplicada em '
    'pré-processamento, evitando que valores extremos distorçam a escala e reduzam a resolução visual '
    'das barras centrais. Cada barra responde ao hover com um tooltip que apresenta o intervalo de preço '
    'e a contagem detalhada por tipo de construção.'
)

add_page_break(doc)

# ════════════════════════════════════════════════════════════════════
# PAGE 5 — GRÁFICO 4
# ════════════════════════════════════════════════════════════════════
add_heading(doc, 'Gráfico 4 — Proporção com Piscina por Zona', num='Secção 5')
add_fig_placeholder(doc, 5, 'Esboço do quarto gráfico')

add_body(doc,
    'O quarto gráfico investiga a relação entre a zona geográfica (cityPartRange) e a presença de '
    'piscina (hasPool), procurando perceber se a distribuição desta comodidade de luxo é uniforme ou '
    'concentrada em zonas específicas. Optou-se por um gráfico de barras 100% empilhadas (normalized '
    'stacked bar chart), em que cada barra representa uma zona e a sua altura total equivale sempre a '
    '100% da amostra local. O segmento azul codifica a proporção de imóveis com piscina e o segmento '
    'cinzento a proporção sem piscina. Esta escolha visual elimina o efeito do tamanho absoluto de cada '
    'zona e foca a leitura nas proporções relativas, tornando imediatamente comparáveis as diferenças '
    'estruturais entre zonas.'
)

add_body(doc,
    'O eixo vertical utiliza d3.scaleLinear() com domínio [0, 1] e formatação em percentagem, enquanto '
    'o eixo horizontal usa d3.scaleBand() com padding de 0,25. Os valores percentuais são impressos '
    'dentro do segmento azul sempre que a proporção supera 4%, garantindo legibilidade mesmo em '
    'segmentos de dimensão reduzida. A legenda foi posicionada no interior da área do gráfico, no canto '
    'superior direito, para evitar sobreposição com os rótulos dos eixos. Tal como nos restantes '
    'gráficos, as barras respondem ao hover com tooltips que apresentam a zona, a proporção exata com '
    'e sem piscina e o número total de imóveis que compõem a seleção atual, permitindo avaliar a '
    'representatividade estatística de cada barra em tempo real.'
)

# ── Save ─────────────────────────────────────────────────────────────────────
out = '/home/diogo/visualization/Relatorio_Paris_Housing.docx'
doc.save(out)
print('Saved:', out)
