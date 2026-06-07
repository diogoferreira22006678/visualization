'use strict';

const W = 580, H = 320;
const M = { top: 24, right: 28, bottom: 54, left: 76 };
const IW = W - M.left - M.right;
const IH = H - M.top  - M.bottom;

const C = {
  blue:   '#60a5fa', green:  '#34d399', purple: '#a78bfa',
  orange: '#fb923c', red:    '#f87171', teal:   '#2dd4bf', gray: '#475569',
};

let allData = [];
const state = { priceMin: 0, priceMax: Infinity, zones: new Set(), pool: 'all' };

function getFiltered() {
  return allData.filter(r =>
    r.price >= state.priceMin && r.price <= state.priceMax &&
    (state.zones.size === 0 || state.zones.has(r.cityPartRange)) &&
    (state.pool === 'all' || r.hasPool === +state.pool)
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tip = d3.select('#tooltip');
const showTip = (html, e) =>
  tip.html(html).style('opacity', 1)
     .style('left', (e.clientX + 15) + 'px')
     .style('top',  (e.clientY - 8)  + 'px');
const moveTip = e =>
  tip.style('left', (e.clientX + 15) + 'px').style('top', (e.clientY - 8) + 'px');
const hideTip = () => tip.style('opacity', 0);

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtEur  = n => '€' + d3.format(',.0f')(n);
const fmtTick = n => {
  if (n >= 1e6) return '€' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '€' + Math.round(n / 1e3) + 'k';
  return '€' + Math.round(n);
};

function animCount(el, to, fmt, dur = 650) {
  const from = parseFloat(el.dataset.cur || 0);
  el.dataset.cur = to;
  const t0 = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * ease);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function updateKPIs(data) {
  const n    = data.length;
  const avgP = n ? d3.mean(data, r => r.price) : 0;
  const avgA = n ? d3.mean(data, r => r.squareMeters) : 0;
  const pPct = n ? data.filter(r => r.hasPool === 1).length / n * 100 : 0;
  animCount(document.getElementById('kv-total'), n,    v => d3.format(',.0f')(Math.round(v)));
  animCount(document.getElementById('kv-price'), avgP, v => '€' + d3.format(',.0f')(Math.round(v)));
  animCount(document.getElementById('kv-area'),  avgA, v => Math.round(v) + ' m²');
  animCount(document.getElementById('kv-pool'),  pPct, v => v.toFixed(1) + '%');
  document.getElementById('count-display').textContent =
    d3.format(',.0f')(n) + ' imóveis selecionados';
  document.querySelectorAll('.kpi').forEach(k => {
    k.classList.remove('flash'); void k.offsetWidth; k.classList.add('flash');
  });
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function makeSvg(selector) {
  const svg  = d3.select(selector).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  const defs = svg.append('defs');
  const g    = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
  return { svg, defs, g };
}
function xLabel(g, text) {
  g.append('text').attr('class', 'axis-label')
    .attr('x', IW / 2).attr('y', IH + 46).attr('text-anchor', 'middle').text(text);
}
function yLabel(g, text) {
  g.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)').attr('x', -IH / 2).attr('y', -62)
    .attr('text-anchor', 'middle').text(text);
}

// ── Preprocessing ─────────────────────────────────────────────────────────────
function preprocess(raw) {
  const parsed = raw.map(r => ({
    squareMeters:  +r.squareMeters,
    hasPool:       +r.hasPool,
    isNewBuilt:    +r.isNewBuilt,
    cityPartRange: +r.cityPartRange,
    made:          +r.made,
    price:         +r.price,
  }));
  const valid = parsed.filter(r =>
    r.price > 0 && r.squareMeters > 0 &&
    isFinite(r.price) && isFinite(r.squareMeters) && isFinite(r.made) && r.made > 0
  );
  const ps  = valid.map(r => r.price).sort(d3.ascending);
  const q1  = d3.quantile(ps, 0.25);
  const q3  = d3.quantile(ps, 0.75);
  const iqr = q3 - q1;
  const clean = valid.filter(r => r.price >= q1 - 1.5 * iqr && r.price <= q3 + 1.5 * iqr);
  clean.forEach(r => { r.price_per_m2 = r.price / r.squareMeters; });
  console.log(`[Pre-proc] ${raw.length} → ${valid.length} → ${clean.length}`);
  return clean;
}

// ── KDE ───────────────────────────────────────────────────────────────────────
const kde = (kernel, X, vals) => X.map(x => [x, d3.mean(vals, v => kernel(x - v))]);
const epanechnikov = bw => v => Math.abs(v /= bw) <= 1 ? 0.75 * (1 - v * v) / bw : 0;


// ════════════════════════════════════════════════════════════════════
// Q1 — Bar: avg price (y) × cityPartRange (x) × avg squareMeters (colour)
// ════════════════════════════════════════════════════════════════════
function initChart1() {
  const { defs, g } = makeSvg('#chart1');

  // Colour scale: dark-blue → cyan by avg squareMeters
  const colScale = d3.scaleSequential()
    .interpolator(d3.interpolateRgb('#1e3a5f', '#38bdf8'));

  // Colour legend bar
  const lgW = 90, lgH = 6;
  const lgGrad = defs.append('linearGradient').attr('id', 'area-grad')
    .attr('x1', 0).attr('y1', 0).attr('x2', 1).attr('y2', 0);
  d3.range(10).forEach(i =>
    lgGrad.append('stop').attr('offset', `${i / 9 * 100}%`)
      .attr('stop-color', d3.interpolateRgb('#1e3a5f', '#38bdf8')(i / 9))
  );
  const lgG = g.append('g').attr('transform', `translate(${IW - lgW}, -2)`);
  lgG.append('rect').attr('width', lgW).attr('height', lgH).attr('fill', 'url(#area-grad)').attr('opacity', 0.8);
  lgG.append('text').attr('font-size', 9).attr('fill', '#4b5563').attr('x', lgW / 2).attr('y', -3)
    .attr('text-anchor', 'middle').text('Área Média (m²)');
  const lgMin = lgG.append('text').attr('font-size', 9).attr('fill', '#4b5563').attr('y', lgH + 9);
  const lgMax = lgG.append('text').attr('font-size', 9).attr('fill', '#4b5563').attr('x', lgW).attr('y', lgH + 9).attr('text-anchor', 'end');

  const x = d3.scaleBand().range([0, IW]).padding(0.28);
  const y = d3.scaleLinear().range([IH, 0]);
  const gridG  = g.append('g').attr('class', 'grid');
  const xAxisG = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${IH})`);
  const yAxisG = g.append('g').attr('class', 'axis');
  const barsG  = g.append('g');

  xLabel(g, 'Nível da Zona (cityPartRange)');
  yLabel(g, 'Preço Médio (€)');

  return function update(data) {
    const rows = d3.rollups(data,
      v => ({ avg: d3.mean(v, r => r.price), avgArea: d3.mean(v, r => r.squareMeters), count: v.length }),
      r => r.cityPartRange
    ).map(([zone, d]) => ({ zone, ...d })).sort((a, b) => a.zone - b.zone);

    if (!rows.length) { barsG.selectAll('*').remove(); return; }

    x.domain(rows.map(r => r.zone));
    y.domain([0, d3.max(rows, r => r.avg) * 1.15]);

    const [minA, maxA] = d3.extent(rows, r => r.avgArea);
    colScale.domain([minA, maxA]);
    lgMin.text(Math.round(minA) + ' m²');
    lgMax.text(Math.round(maxA) + ' m²');

    xAxisG.transition().duration(400).call(d3.axisBottom(x));
    yAxisG.transition().duration(400).call(d3.axisLeft(y).tickFormat(fmtTick).ticks(5));
    gridG.transition().duration(400)
      .call(d3.axisLeft(y).tickSize(-IW).tickFormat(''))
      .call(gg => gg.select('.domain').remove());

    barsG.selectAll('.bar').data(rows, r => r.zone)
      .join(
        enter => enter.append('rect').attr('class', 'bar').attr('rx', 0)
          .attr('fill', r => colScale(r.avgArea))
          .attr('x', r => x(r.zone)).attr('width', x.bandwidth())
          .attr('y', IH).attr('height', 0)
          .on('mouseover', (e, r) => showTip(
            `<b>Zona ${r.zone}</b><br>Preço médio: ${fmtEur(r.avg)}<br>Área média: ${Math.round(r.avgArea)} m²<br><span class="tip-sub">${r.count} imóveis</span>`, e))
          .on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(600).delay((_, i) => i * 45)
            .attr('y', r => y(r.avg)).attr('height', r => IH - y(r.avg)).attr('fill', r => colScale(r.avgArea))),
        update => update
          .on('mouseover', (e, r) => showTip(
            `<b>Zona ${r.zone}</b><br>Preço médio: ${fmtEur(r.avg)}<br>Área média: ${Math.round(r.avgArea)} m²<br><span class="tip-sub">${r.count} imóveis</span>`, e))
          .on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(500)
            .attr('x', r => x(r.zone)).attr('width', x.bandwidth())
            .attr('y', r => y(r.avg)).attr('height', r => IH - y(r.avg)).attr('fill', r => colScale(r.avgArea))),
        exit => exit.transition().duration(300).attr('height', 0).attr('y', IH).remove()
      );

    barsG.selectAll('.bar-lbl').data(rows, r => r.zone)
      .join(
        enter => enter.append('text').attr('class', 'bar-lbl').attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('fill', 'rgba(255,255,255,0.38)')
          .attr('x', r => x(r.zone) + x.bandwidth() / 2).attr('y', IH - 3)
          .call(s => s.transition().duration(600).delay((_, i) => i * 45)
            .attr('y', r => y(r.avg) - 4).text(r => fmtTick(r.avg))),
        update => update.call(s => s.transition().duration(500)
          .attr('x', r => x(r.zone) + x.bandwidth() / 2)
          .attr('y', r => y(r.avg) - 4).text(r => fmtTick(r.avg))),
        exit => exit.remove()
      );
  };
}


// ════════════════════════════════════════════════════════════════════
// Q2 — Line: avg price (y) × year (x) × count per year (dot size)
// ════════════════════════════════════════════════════════════════════
function initChart2() {
  const { g } = makeSvg('#chart2');

  const x      = d3.scaleLinear().range([0, IW]);
  const y      = d3.scaleLinear().range([IH, 0]);
  const rScale = d3.scaleSqrt().range([2.5, 9]);

  const gridG  = g.append('g').attr('class', 'grid');
  const xAxisG = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${IH})`);
  const yAxisG = g.append('g').attr('class', 'axis');
  const areaPath = g.append('path').attr('fill', C.teal).attr('fill-opacity', 0.06);
  const linePath = g.append('path').attr('fill', 'none').attr('stroke', C.teal).attr('stroke-width', 2.5);
  const crossV   = g.append('line').attr('y1', 0).attr('y2', IH)
    .attr('stroke', 'rgba(255,255,255,0.14)').attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3').style('opacity', 0).style('pointer-events', 'none');
  const dotsG = g.append('g');

  // Size legend
  const legG = g.append('g').attr('transform', `translate(${IW}, ${IH - 6})`);
  legG.append('text').attr('font-size', 9).attr('fill', '#4b5563').attr('text-anchor', 'end').attr('y', 0)
    .text('Tamanho = nº de imóveis construídos no ano');

  xLabel(g, 'Ano de Construção');
  yLabel(g, 'Preço Médio (€)');

  let drawnOnce = false;

  return function update(data) {
    const rows = d3.rollups(data,
      v => ({ avg: d3.mean(v, r => r.price), count: v.length }),
      r => r.made
    ).map(([year, d]) => ({ year, ...d })).sort((a, b) => a.year - b.year);

    if (!rows.length) { areaPath.attr('d', ''); linePath.attr('d', ''); dotsG.selectAll('*').remove(); return; }

    x.domain(d3.extent(rows, r => r.year));
    const [mn, mx] = d3.extent(rows, r => r.avg);
    const pad = (mx - mn) * 0.18;
    y.domain([Math.max(0, mn - pad), mx + pad]);
    rScale.domain([1, d3.max(rows, r => r.count)]);

    xAxisG.transition().duration(400).call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(8));
    yAxisG.transition().duration(400).call(d3.axisLeft(y).tickFormat(fmtTick).ticks(5));
    gridG.transition().duration(400)
      .call(d3.axisLeft(y).tickSize(-IW).tickFormat(''))
      .call(gg => gg.select('.domain').remove());

    const lineFn = d3.line().x(r => x(r.year)).y(r => y(r.avg)).curve(d3.curveMonotoneX);
    const areaFn = d3.area().x(r => x(r.year)).y0(IH).y1(r => y(r.avg)).curve(d3.curveMonotoneX);

    areaPath.transition().duration(500).attr('d', areaFn(rows));

    if (!drawnOnce) {
      drawnOnce = true;
      linePath.attr('d', lineFn(rows));
      const len = linePath.node().getTotalLength();
      linePath.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().duration(1400).ease(d3.easeLinear).attr('stroke-dashoffset', 0)
        .on('end', () => linePath.attr('stroke-dasharray', null).attr('stroke-dashoffset', null));
    } else {
      linePath.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
      linePath.transition().duration(500).attr('d', lineFn(rows));
    }

    dotsG.selectAll('circle').data(rows, r => r.year)
      .join(
        enter => enter.append('circle')
          .attr('cx', r => x(r.year)).attr('cy', r => y(r.avg)).attr('r', 0)
          .attr('fill', C.teal).attr('stroke', '#0f172a').attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('mouseover', function(e, r) {
            d3.select(this).transition().duration(100).attr('r', rScale(r.count) + 3);
            crossV.attr('x1', x(r.year)).attr('x2', x(r.year)).style('opacity', 1);
            showTip(`<b>Ano ${r.year}</b><br>Preço médio: ${fmtEur(r.avg)}<br>Imóveis: ${r.count}`, e);
          })
          .on('mousemove', moveTip)
          .on('mouseout', function(e, r) {
            d3.select(this).transition().duration(100).attr('r', rScale(r.count));
            crossV.style('opacity', 0); hideTip();
          })
          .call(s => s.transition().duration(400).attr('r', r => rScale(r.count))),
        update => update.transition().duration(500)
          .attr('cx', r => x(r.year)).attr('cy', r => y(r.avg)).attr('r', r => rScale(r.count)),
        exit => exit.transition().duration(200).attr('r', 0).remove()
      );
  };
}


// ════════════════════════════════════════════════════════════════════
// Q3 — Stacked Histogram: price (x) × count (y) × isNewBuilt (colour)
// ════════════════════════════════════════════════════════════════════
function initChart3(fullData) {
  const { g } = makeSvg('#chart3');

  const xDomain = d3.extent(fullData, r => r.price);
  const x = d3.scaleLinear().domain(xDomain).range([0, IW]);
  const y = d3.scaleLinear().range([IH, 0]);

  const gridG  = g.append('g').attr('class', 'grid');
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${IH})`)
    .call(d3.axisBottom(x).tickFormat(fmtTick).ticks(6));
  const yAxisG = g.append('g').attr('class', 'axis');
  const oldG   = g.append('g');
  const newG   = g.append('g');
  const meanLine = g.append('line')
    .attr('stroke', C.red).attr('stroke-width', 1.8).attr('stroke-dasharray', '5,4')
    .attr('y1', 0).attr('y2', IH);
  const meanTxt = g.append('text').attr('fill', C.red).attr('font-size', 10).attr('y', 16);

  // Legend (vertical, top-right)
  const legG = g.append('g').attr('transform', `translate(${IW - 114}, 0)`);
  [{ col: C.purple, lbl: 'Construção Antiga' }, { col: C.green, lbl: 'Construção Nova' }]
    .forEach((d, i) => {
      const row = legG.append('g').attr('transform', `translate(0, ${i * 13})`);
      row.append('rect').attr('width', 8).attr('height', 8).attr('fill', d.col).attr('opacity', 0.75);
      row.append('text').attr('x', 12).attr('y', 7.5).attr('font-size', 9).attr('fill', '#4b5563').text(d.lbl);
    });

  xLabel(g, 'Preço (€)');
  yLabel(g, 'Nº de Imóveis');

  return function update(data) {
    if (!data.length) { oldG.selectAll('rect').remove(); newG.selectAll('rect').remove(); return; }

    const bins = d3.bin().value(r => r.price).domain(xDomain).thresholds(28)(data);
    const stackBins = bins.map(b => ({
      x0: b.x0, x1: b.x1,
      old:   b.filter(r => r.isNewBuilt === 0).length,
      fresh: b.filter(r => r.isNewBuilt === 1).length,
      total: b.length,
    }));

    y.domain([0, d3.max(stackBins, b => b.total) * 1.15]);
    yAxisG.transition().duration(400).call(d3.axisLeft(y).ticks(5));
    gridG.transition().duration(400)
      .call(d3.axisLeft(y).tickSize(-IW).tickFormat(''))
      .call(gg => gg.select('.domain').remove());

    const bw = b => Math.max(0, x(b.x1) - x(b.x0) - 2);
    const tipHtml = b =>
      `<b>${fmtEur(b.x0)} – ${fmtEur(b.x1)}</b><br>Antigas: ${b.old}<br>Novas: ${b.fresh}<br><span class="tip-sub">Total: ${b.total}</span>`;

    // Bottom — old buildings (purple)
    oldG.selectAll('rect').data(stackBins)
      .join(
        enter => enter.append('rect').attr('rx', 0).attr('fill', C.purple).attr('fill-opacity', 0.72)
          .attr('x', b => x(b.x0) + 1).attr('width', bw)
          .attr('y', IH).attr('height', 0)
          .on('mouseover', (e, b) => showTip(tipHtml(b), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(550).delay((_, i) => i * 10)
            .attr('y', b => y(b.old)).attr('height', b => IH - y(b.old))),
        update => update
          .on('mouseover', (e, b) => showTip(tipHtml(b), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(450)
            .attr('y', b => y(b.old)).attr('height', b => IH - y(b.old))),
        exit => exit.transition().duration(250).attr('height', 0).attr('y', IH).remove()
      );

    // Top — new buildings (green), stacked
    newG.selectAll('rect').data(stackBins)
      .join(
        enter => enter.append('rect').attr('rx', 0).attr('fill', C.green).attr('fill-opacity', 0.72)
          .attr('x', b => x(b.x0) + 1).attr('width', bw)
          .attr('y', b => y(b.old)).attr('height', 0)
          .on('mouseover', (e, b) => showTip(tipHtml(b), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(550).delay((_, i) => i * 10)
            .attr('y', b => y(b.total)).attr('height', b => y(b.old) - y(b.total))),
        update => update
          .on('mouseover', (e, b) => showTip(tipHtml(b), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(450)
            .attr('y', b => y(b.total)).attr('height', b => y(b.old) - y(b.total))),
        exit => exit.transition().duration(250).attr('height', 0).remove()
      );

    const mean = d3.mean(data, r => r.price);
    meanLine.transition().duration(400).attr('x1', x(mean)).attr('x2', x(mean));
    meanTxt.transition().duration(400).attr('x', x(mean) + 5).text('Média: ' + fmtTick(mean));
  };
}


// ════════════════════════════════════════════════════════════════════
// Q4 — 100% Stacked Bar: cityPartRange (x) × proportion (y) × hasPool (colour)
// ════════════════════════════════════════════════════════════════════
function initChart4() {
  const { g } = makeSvg('#chart4');

  const x = d3.scaleBand().range([0, IW]).padding(0.25);
  const y = d3.scaleLinear().domain([0, 1]).range([IH, 0]);

  const gridG  = g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).tickSize(-IW).tickFormat(''))
    .call(gg => gg.select('.domain').remove());
  const xAxisG = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${IH})`);
  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickFormat(d3.format('.0%')).ticks(5));

  const nopoolG  = g.append('g');
  const poolG    = g.append('g');
  const labelsG  = g.append('g');

  // Legend (vertical, top-right inside chart)
  const legG = g.append('g').attr('transform', `translate(${IW - 80}, 4)`);
  [{ col: C.gray, lbl: 'Sem Piscina' }, { col: C.blue, lbl: 'Com Piscina' }].forEach((d, i) => {
    const row = legG.append('g').attr('transform', `translate(0, ${i * 13})`);
    row.append('rect').attr('width', 8).attr('height', 8).attr('fill', d.col).attr('opacity', 0.8);
    row.append('text').attr('x', 12).attr('y', 7.5).attr('font-size', 9).attr('fill', '#4b5563').text(d.lbl);
  });

  xLabel(g, 'Zona (cityPartRange)');
  yLabel(g, 'Proporção (%)');

  return function update(data) {
    const rows = d3.rollups(data, v => {
      const total = v.length;
      const wp    = v.filter(r => r.hasPool === 1).length;
      return { total, withPool: wp / total, noPool: (total - wp) / total };
    }, r => r.cityPartRange)
      .map(([zone, d]) => ({ zone, ...d }))
      .sort((a, b) => a.zone - b.zone);

    if (!rows.length) {
      nopoolG.selectAll('rect').remove(); poolG.selectAll('rect').remove();
      labelsG.selectAll('*').remove(); return;
    }

    x.domain(rows.map(r => r.zone));
    xAxisG.transition().duration(400).call(d3.axisBottom(x));
    gridG.transition().duration(400)
      .call(d3.axisLeft(y).tickSize(-IW).tickFormat(''))
      .call(gg => gg.select('.domain').remove());

    const tipHtml = r =>
      `<b>Zona ${r.zone}</b><br>Com piscina: ${(r.withPool * 100).toFixed(1)}%<br>Sem piscina: ${(r.noPool * 100).toFixed(1)}%<br><span class="tip-sub">${r.total} imóveis</span>`;

    // Bottom segment — no pool (gray)
    nopoolG.selectAll('rect').data(rows, r => r.zone)
      .join(
        enter => enter.append('rect').attr('rx', 0).attr('fill', C.gray).attr('fill-opacity', 0.65)
          .attr('x', r => x(r.zone)).attr('width', x.bandwidth())
          .attr('y', IH).attr('height', 0)
          .on('mouseover', (e, r) => showTip(tipHtml(r), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(600).delay((_, i) => i * 40)
            .attr('y', r => y(r.noPool)).attr('height', r => IH - y(r.noPool))),
        update => update
          .on('mouseover', (e, r) => showTip(tipHtml(r), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(500)
            .attr('x', r => x(r.zone)).attr('width', x.bandwidth())
            .attr('y', r => y(r.noPool)).attr('height', r => IH - y(r.noPool))),
        exit => exit.transition().duration(300).attr('height', 0).attr('y', IH).remove()
      );

    // Top segment — with pool (blue)
    poolG.selectAll('rect').data(rows, r => r.zone)
      .join(
        enter => enter.append('rect').attr('rx', 0).attr('fill', C.blue).attr('fill-opacity', 0.72)
          .attr('x', r => x(r.zone)).attr('width', x.bandwidth())
          .attr('y', r => y(r.noPool)).attr('height', 0)
          .on('mouseover', (e, r) => showTip(tipHtml(r), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(600).delay((_, i) => i * 40)
            .attr('y', () => y(1)).attr('height', r => y(r.noPool) - y(1))),
        update => update
          .on('mouseover', (e, r) => showTip(tipHtml(r), e)).on('mousemove', moveTip).on('mouseout', hideTip)
          .call(s => s.transition().duration(500)
            .attr('x', r => x(r.zone)).attr('width', x.bandwidth())
            .attr('y', () => y(1)).attr('height', r => y(r.noPool) - y(1))),
        exit => exit.transition().duration(300).attr('height', 0).remove()
      );

    // Percentage labels inside pool segment
    labelsG.selectAll('text').data(rows, r => r.zone)
      .join(
        enter => enter.append('text').attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('fill', 'rgba(255,255,255,0.45)')
          .attr('x', r => x(r.zone) + x.bandwidth() / 2)
          .attr('y', r => y(1) + (y(r.noPool) - y(1)) / 2 + 3)
          .text(r => r.withPool > 0.04 ? (r.withPool * 100).toFixed(0) + '%' : ''),
        update => update.transition().duration(500)
          .attr('x', r => x(r.zone) + x.bandwidth() / 2)
          .attr('y', r => y(1) + (y(r.noPool) - y(1)) / 2 + 3)
          .text(r => r.withPool > 0.04 ? (r.withPool * 100).toFixed(0) + '%' : ''),
        exit => exit.remove()
      );
  };
}


// ════════════════════════════════════════════════════════════════════
// FILTERS
// ════════════════════════════════════════════════════════════════════
function setupFilters(data) {
  const [pMin, pMax] = d3.extent(data, r => r.price);
  state.priceMin = pMin; state.priceMax = pMax;

  const slider = document.getElementById('price-slider');
  noUiSlider.create(slider, {
    start: [pMin, pMax], connect: true,
    range: { min: pMin, max: pMax }, step: (pMax - pMin) / 300,
  });
  const minLbl = document.getElementById('range-min');
  const maxLbl = document.getElementById('range-max');
  minLbl.textContent = fmtTick(pMin);
  maxLbl.textContent = fmtTick(pMax);
  slider.noUiSlider.on('update', ([a, b]) => {
    state.priceMin = +a; state.priceMax = +b;
    minLbl.textContent = fmtTick(+a); maxLbl.textContent = fmtTick(+b);
  });
  slider.noUiSlider.on('change', () => updateAll());

  const zones = [...new Set(data.map(r => r.cityPartRange))].sort(d3.ascending);
  const chipsEl = document.getElementById('zone-chips');
  zones.forEach(z => {
    const btn = document.createElement('button');
    btn.className = 'zone-chip'; btn.textContent = z;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      if (state.zones.has(z)) state.zones.delete(z); else state.zones.add(z);
      updateAll();
    });
    chipsEl.appendChild(btn);
  });

  document.querySelectorAll('#pool-pills .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pool-pills .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.pool = btn.dataset.v;
      updateAll();
    });
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    slider.noUiSlider.set([pMin, pMax]);
    state.priceMin = pMin; state.priceMax = pMax;
    state.zones.clear(); state.pool = 'all';
    document.querySelectorAll('.zone-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#pool-pills .pill').forEach(b => b.classList.remove('active'));
    document.querySelector('#pool-pills [data-v="all"]').classList.add('active');
    updateAll();
  });
}

let updateBar, updateLine, updateHist, updateStack;

function updateAll() {
  const f = getFiltered();
  updateBar(f); updateLine(f); updateHist(f); updateStack(f); updateKPIs(f);
}

d3.csv('data/ParisHousing.csv').then(raw => {
  allData = preprocess(raw);
  updateBar   = initChart1();
  updateLine  = initChart2();
  updateHist  = initChart3(allData);
  updateStack = initChart4();
  setupFilters(allData);
  updateAll();
  const loader = document.getElementById('loading');
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 600);
}).catch(() => {
  document.getElementById('loading').classList.add('hidden');
  d3.select('#dashboard').html(`
    <div class="error-msg">
      <h2>Dataset não encontrado</h2>
      <p>Coloque <code>ParisHousing.csv</code> na pasta <code>data/</code>.</p>
      <p style="margin-top:12px">
        <a href="https://www.kaggle.com/datasets/mssmartypants/paris-housing-price-prediction/data" target="_blank">
          Descarregar no Kaggle →
        </a>
      </p>
    </div>
  `);
});
