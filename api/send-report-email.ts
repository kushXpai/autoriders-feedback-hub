// api/send-report-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

interface OverviewData {
  quarterLabel: string;
  outcome: string;
  totalRespondents: number;
  totalAssigned: number;
  newExpatCount: number;
  overallPct: number;
  sections: {
    label: string;
    avg: number;
    pct: number;
    appliesTo: string;
  }[];
}

interface ResponseRow {
  customerName: string;
  isNew: boolean;
  answers: Record<string, number | null>;
}

interface QuestionRef {
  number: number;
  text: string;
  section: string;
}

interface KpiRow {
  section: string;
  avg: number;
  pct: number;
  target: number;
  outcome: string;
}

interface SendReportEmailRequest {
  recipients: string[];
  overview: OverviewData;
  responses: ResponseRow[];
  questions: QuestionRef[];
  kpiRows: KpiRow[];
}

interface EmailResult {
  email: string;
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────
// STRUCTURED LOGGER
// ─────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', step: string, detail?: object | string) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    step,
    ...(typeof detail === 'string' ? { msg: detail } : detail),
  };
  if (level === 'error') console.error(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

// ─────────────────────────────────────────
// COLOR PALETTE
// ─────────────────────────────────────────

const COLORS = {
  primary:            '#6366f1',
  service_initiation: '#6366f1',
  service_delivery:   '#0ea5e9',
  driver_quality:     '#10b981',
  overall:            '#f59e0b',
  incentive:          '#10b981',
  on_target:          '#3b82f6',
  below_target:       '#f59e0b',
  penalty:            '#ef4444',
  score4:             '#10b981',
  score3:             '#3b82f6',
  score2:             '#f59e0b',
  score1:             '#ef4444',
  bg:                 '#ffffff',
  card:               '#f8fafc',
  border:             '#e2e8f0',
  text:               '#0f172a',
  muted:              '#64748b',
  lightMuted:         '#cbd5e1',
} as const;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function tint(hex: string, amount = 0.88): RGB {
  const [r, g, b] = hexToRgb(hex);
  return [
    Math.min(255, r + Math.round((255 - r) * amount)),
    Math.min(255, g + Math.round((255 - g) * amount)),
    Math.min(255, b + Math.round((255 - b) * amount)),
  ];
}

function outcomeColor(outcome: string): string {
  const o = outcome.toLowerCase().replace(/ /g, '_') as keyof typeof COLORS;
  return (COLORS[o] as string) ?? COLORS.muted;
}

function sectionColor(key: string): string {
  return (COLORS[key as keyof typeof COLORS] as string) ?? COLORS.primary;
}

function sectionKeyFromLabel(label: string): string {
  const map: Record<string, string> = {
    'Service Initiation': 'service_initiation',
    'Service Delivery':   'service_delivery',
    'Driver Quality':     'driver_quality',
    'Overall Experience': 'overall',
  };
  return map[label] ?? 'overall';
}

function scoreColor(score: number | null): string {
  if (score === 4) return COLORS.score4;
  if (score === 3) return COLORS.score3;
  if (score === 2) return COLORS.score2;
  if (score === 1) return COLORS.score1;
  return COLORS.lightMuted;
}

// ─────────────────────────────────────────
// PDF GENERATION
// ─────────────────────────────────────────

function buildPDF(payload: SendReportEmailRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { overview, responses, questions, kpiRows } = payload;
    const doc = new (PDFDocument as any)({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title:  `${overview.quarterLabel} — Feedback Report`,
        Author: 'Feedback System',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W       = doc.page.width;
    const MARGIN  = 40;
    const CW      = W - MARGIN * 2;

    const fill   = (hex: string) => doc.fillColor(hexToRgb(hex));
    const stroke = (hex: string) => doc.strokeColor(hexToRgb(hex));

    const rrect = (x: number, y: number, w: number, h: number, r: number, fg?: string, sg?: string) => {
      if (fg) fill(fg);
      if (sg) stroke(sg);
      doc.roundedRect(x, y, w, h, r);
      if (fg && sg) doc.fillAndStroke();
      else if (fg) doc.fill();
      else if (sg) doc.stroke();
    };

    const divider = (y: number) => {
      stroke(COLORS.border);
      doc.moveTo(MARGIN, y).lineTo(W - MARGIN, y).lineWidth(0.5).stroke();
    };

    const badge = (x: number, y: number, label: string, colorHex: string) => {
      const bg = tint(colorHex);
      const tw = doc.widthOfString(label.toUpperCase(), { fontSize: 7 }) + 10;
      doc.roundedRect(x, y, tw, 14, 3).fillColor(bg).fill();
      doc.fontSize(7).font('Helvetica-Bold').fillColor(hexToRgb(colorHex))
        .text(label.toUpperCase(), x + 5, y + 3.5, { lineBreak: false });
      return tw;
    };

    const progressBar = (x: number, y: number, w: number, h: number, pct: number, colorHex: string) => {
      rrect(x, y, w, h, h / 2, '#f1f5f9');
      const filled = Math.max(0, Math.min(w, (pct / 100) * w));
      if (filled > 0) rrect(x, y, filled, h, h / 2, colorHex);
    };

    const secHeader = (title: string, y: number): number => {
      doc.rect(MARGIN, y, CW, 22).fillColor(hexToRgb(COLORS.card)).fill();
      fill(COLORS.text);
      doc.fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), MARGIN + 10, y + 7, { lineBreak: false });
      return y + 22;
    };

    const needsPage = (h: number) => {
      if (doc.y + h > doc.page.height - 50) { doc.addPage(); return true; }
      return false;
    };

    // ─── PAGE 1: Overview ─────────────────────────────────────────────────────

    doc.rect(0, 0, W, 80).fillColor(hexToRgb('#0f172a')).fill();
    badge(MARGIN, 18, overview.outcome, outcomeColor(overview.outcome));
    fill('#ffffff');
    doc.fontSize(18).font('Helvetica-Bold')
      .text(`${overview.quarterLabel}  —  Feedback Report`, MARGIN, 40);
    doc.y = 96;

    // Stat cards
    const cW = (CW - 12) / 2;
    const cH = 60;
    const cards = [
      { label: 'Respondents',        value: `${overview.totalRespondents} / ${overview.totalAssigned}`, sub: `${overview.totalAssigned > 0 ? ((overview.totalRespondents / overview.totalAssigned) * 100).toFixed(0) : 0}% response rate` },
      { label: 'Overall Satisfaction', value: `${overview.overallPct.toFixed(1)}%`, sub: 'Target: 80%', color: overview.overallPct >= 80 ? COLORS.score4 : COLORS.score1 },
      { label: 'New Expats',         value: `${overview.newExpatCount}`, sub: `of ${overview.totalRespondents} respondents` },
      { label: 'Outcome',            value: overview.outcome, sub: 'Quarter result', color: outcomeColor(overview.outcome) },
    ];
    let cy = doc.y;
    cards.forEach((card, i) => {
      const cx = MARGIN + (i % 2) * (cW + 12);
      if (i === 2) cy += cH + 8;
      rrect(cx, cy, cW, cH, 6, COLORS.card, COLORS.border);
      fill(COLORS.muted); doc.fontSize(7).font('Helvetica').text(card.label, cx + 12, cy + 10, { lineBreak: false });
      fill((card as any).color ?? COLORS.text); doc.fontSize(16).font('Helvetica-Bold').text(card.value, cx + 12, cy + 22, { lineBreak: false });
      fill(COLORS.muted); doc.fontSize(7).font('Helvetica').text(card.sub, cx + 12, cy + 44, { lineBreak: false });
    });
    doc.y = cy + cH + 16;
    divider(doc.y); doc.y += 14;

    // KPI Table
    doc.y = secHeader('KPI Outcomes', doc.y); doc.y += 4;
    const colX = [MARGIN + 10, MARGIN + 170, MARGIN + 240, MARGIN + 315, MARGIN + 380];
    const colW = [155, 65, 70, 60, 90];
    const hdrs = ['Section', 'Score /4', 'Satisfaction', 'Target', 'Outcome'];
    doc.rect(MARGIN, doc.y, CW, 18).fillColor(hexToRgb('#f1f5f9')).fill();
    hdrs.forEach((h, i) => {
      fill(COLORS.muted); doc.fontSize(7).font('Helvetica-Bold').text(h, colX[i], doc.y + 5, { lineBreak: false, width: colW[i] });
    });
    doc.y += 18;
    kpiRows.forEach((row, idx) => {
      const rH = 22;
      if (idx % 2 === 0) doc.rect(MARGIN, doc.y, CW, rH).fillColor(hexToRgb('#fafafa')).fill();
      const sc = sectionColor(sectionKeyFromLabel(row.section));
      doc.circle(colX[0] + 5, doc.y + 11, 4).fillColor(hexToRgb(sc)).fill();
      fill(COLORS.text); doc.fontSize(8).font('Helvetica-Bold').text(row.section, colX[0] + 14, doc.y + 7, { lineBreak: false });
      fill(COLORS.text); doc.fontSize(8).font('Helvetica').text(row.avg.toFixed(2), colX[1], doc.y + 7, { lineBreak: false });
      fill(row.pct >= 80 ? COLORS.score4 : COLORS.score1);
      doc.fontSize(8).font('Helvetica-Bold').text(`${row.pct.toFixed(1)}%`, colX[2], doc.y + 7, { lineBreak: false });
      fill(COLORS.muted); doc.fontSize(8).font('Helvetica').text(`${row.target}%`, colX[3], doc.y + 7, { lineBreak: false });
      badge(colX[4], doc.y + 5, row.outcome, outcomeColor(row.outcome));
      doc.y += rH; divider(doc.y);
    });
    fill(COLORS.muted);
    doc.fontSize(7).font('Helvetica').text('Target: ≥80% · Below 70% → Penalty (−3%) · ≥85% → Incentive (+3%)', MARGIN + 10, doc.y + 6);
    doc.y += 22;

    // Section bars
    doc.y += 4; divider(doc.y); doc.y += 10;
    doc.y = secHeader('Section Satisfaction', doc.y); doc.y += 6;
    overview.sections.forEach(s => {
      needsPage(30);
      const sc = sectionColor(sectionKeyFromLabel(s.label));
      fill(sc); doc.fontSize(8).font('Helvetica-Bold').text(s.label, MARGIN + 10, doc.y, { lineBreak: false });
      fill(COLORS.muted); doc.fontSize(7).font('Helvetica').text(`  ${s.appliesTo}`, MARGIN + 14 + doc.widthOfString(s.label, { fontSize: 8 }), doc.y + 0.5, { lineBreak: false });
      fill(s.pct >= 80 ? COLORS.score4 : COLORS.score1);
      doc.fontSize(8).font('Helvetica-Bold').text(`${s.pct.toFixed(1)}%`, W - MARGIN - 38, doc.y, { lineBreak: false, width: 38, align: 'right' });
      doc.y += 12;
      progressBar(MARGIN + 10, doc.y, CW - 20, 6, s.pct, sc);
      doc.y += 14;
    });

    // ─── PAGE 2+: Individual Responses (customers as rows, questions as cols) ──
    doc.addPage();
    doc.rect(0, 0, W, 40).fillColor(hexToRgb('#0f172a')).fill();
    fill('#ffffff');
    doc.fontSize(13).font('Helvetica-Bold').text(`${overview.quarterLabel}  —  Individual Responses`, MARGIN, 13);
    doc.y = 56;

    const sectionOrder = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'];
    const sectionLabelsMap: Record<string, string> = {
      service_initiation: 'Service Initiation',
      service_delivery:   'Service Delivery',
      driver_quality:     'Driver Quality',
      overall:            'Overall Experience',
    };

    const sortedQ = [...questions].sort((a, b) => a.number - b.number);
    const groups = sectionOrder
      .map(k => ({ key: k, label: sectionLabelsMap[k], qs: sortedQ.filter(q => q.section === k) }))
      .filter(g => g.qs.length > 0);

    const nameW = 115;
    const typeW = 38;
    const qW    = Math.max(20, Math.min(26, Math.floor((CW - nameW - typeW) / sortedQ.length)));
    const tblW  = nameW + typeW + qW * sortedQ.length;
    const tblX  = MARGIN + Math.max(0, (CW - tblW) / 2);

    const drawHeaders = (startY: number): number => {
      let y = startY;
      // Section band
      doc.rect(tblX, y, nameW + typeW, 14).fillColor(hexToRgb('#f1f5f9')).fill();
      let qx = tblX + nameW + typeW;
      groups.forEach(g => {
        const bw = g.qs.length * qW;
        const sc = sectionColor(g.key);
        doc.rect(qx, y, bw, 14).fillColor(tint(sc, 0.88)).fill();
        doc.fontSize(6).font('Helvetica-Bold').fillColor(hexToRgb(sc))
          .text(g.label.split(' ')[0], qx + 2, y + 4, { lineBreak: false, width: bw - 2, ellipsis: true });
        qx += bw;
      });
      y += 14;
      // Col headers
      doc.rect(tblX, y, tblW, 16).fillColor(hexToRgb('#e2e8f0')).fill();
      fill(COLORS.muted);
      doc.fontSize(7).font('Helvetica-Bold').text('Customer', tblX + 4, y + 5, { lineBreak: false, width: nameW - 4 });
      doc.text('Type', tblX + nameW + 3, y + 5, { lineBreak: false, width: typeW });
      let qhx = tblX + nameW + typeW;
      sortedQ.forEach(q => {
        doc.text(`Q${q.number}`, qhx + 1, y + 5, { lineBreak: false, width: qW - 2, align: 'center' });
        qhx += qW;
      });
      y += 16;
      return y;
    };

    let tY = drawHeaders(doc.y);

    responses.forEach((resp, idx) => {
      const rH = 18;
      if (tY + rH > doc.page.height - 50) {
        doc.addPage();
        doc.rect(0, 0, W, 30).fillColor(hexToRgb('#0f172a')).fill();
        fill('#ffffff'); doc.fontSize(10).font('Helvetica-Bold').text(`Individual Responses (cont.)`, MARGIN, 9);
        doc.y = 40;
        tY = drawHeaders(doc.y);
      }
      doc.rect(tblX, tY, tblW, rH).fillColor(idx % 2 === 0 ? hexToRgb('#ffffff') : hexToRgb('#f8fafc')).fill();
      if (resp.isNew) doc.rect(tblX, tY, 3, rH).fillColor(hexToRgb(COLORS.primary)).fill();

      fill(COLORS.text);
      doc.fontSize(7.5).font('Helvetica-Bold').text(resp.customerName, tblX + 5, tY + 5, { lineBreak: false, width: nameW - 6, ellipsis: true });

      if (resp.isNew) {
        doc.roundedRect(tblX + nameW + 2, tY + 4, 28, 10, 2).fillColor(tint(COLORS.primary)).fill();
        doc.fontSize(5.5).font('Helvetica-Bold').fillColor(hexToRgb(COLORS.primary))
          .text('NEW', tblX + nameW + 5, tY + 6, { lineBreak: false });
      } else {
        fill(COLORS.muted); doc.fontSize(6.5).font('Helvetica').text('Exist.', tblX + nameW + 3, tY + 6, { lineBreak: false });
      }

      let qcx = tblX + nameW + typeW;
      sortedQ.forEach(q => {
        const score = resp.answers[`Q${q.number}`];
        const cx2 = qcx + qW / 2;
        const cy2 = tY + rH / 2;
        if (score !== null && score !== undefined) {
          doc.circle(cx2, cy2, 6).fillColor(hexToRgb(scoreColor(score))).fill();
          doc.fontSize(6).font('Helvetica-Bold').fillColor([255, 255, 255] as any)
            .text(String(score), cx2 - 2.5, cy2 - 3.5, { lineBreak: false });
        } else {
          fill(COLORS.lightMuted); doc.fontSize(6).font('Helvetica').text('—', cx2 - 2, cy2 - 3, { lineBreak: false });
        }
        qcx += qW;
      });

      stroke(COLORS.border);
      doc.moveTo(tblX, tY + rH).lineTo(tblX + tblW, tY + rH).lineWidth(0.3).stroke();
      tY += rH;
    });

    doc.y = tY + 8;

    // Score legend
    needsPage(30); doc.y += 10; divider(doc.y); doc.y += 8;
    const scoreInfo = [
      { s: 4, l: 'Excellence', c: COLORS.score4 },
      { s: 3, l: 'Good',       c: COLORS.score3 },
      { s: 2, l: 'Fair',       c: COLORS.score2 },
      { s: 1, l: 'Needs Improvement', c: COLORS.score1 },
    ];
    let lx = MARGIN;
    scoreInfo.forEach(si => {
      doc.circle(lx + 5, doc.y + 5, 5).fillColor(hexToRgb(si.c)).fill();
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor([255, 255, 255] as any).text(String(si.s), lx + 3, doc.y + 2, { lineBreak: false });
      fill(COLORS.muted); doc.fontSize(7).font('Helvetica').text(si.l, lx + 13, doc.y + 2, { lineBreak: false });
      lx += 16 + doc.widthOfString(si.l, { fontSize: 7 }) + 14;
    });
    doc.y += 16;

    // ─── PAGE 3: Question Reference ───────────────────────────────────────────
    doc.addPage();
    doc.rect(0, 0, W, 40).fillColor(hexToRgb('#0f172a')).fill();
    fill('#ffffff');
    doc.fontSize(13).font('Helvetica-Bold').text(`${overview.quarterLabel}  —  Question Reference`, MARGIN, 13);
    doc.y = 56;

    groups.forEach(g => {
      needsPage(30);
      const sc = sectionColor(g.key);
      doc.rect(MARGIN, doc.y, CW, 20).fillColor(tint(sc, 0.9)).fill();
      doc.rect(MARGIN, doc.y, 4, 20).fillColor(hexToRgb(sc)).fill();
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(hexToRgb(sc))
        .text(g.label.toUpperCase(), MARGIN + 12, doc.y + 6, { lineBreak: false });
      doc.y += 24;

      g.qs.forEach(q => {
        needsPage(20);
        fill(COLORS.muted); doc.fontSize(7.5).font('Helvetica-Bold').text(`Q${q.number}`, MARGIN + 6, doc.y, { lineBreak: false, width: 20 });
        fill(COLORS.text);  doc.fontSize(7.5).font('Helvetica').text(q.text, MARGIN + 26, doc.y, { width: CW - 30 });
        doc.y += 4;
      });
      doc.y += 10;
    });

    // ─── Footers ──────────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const pY = doc.page.height - 28;
      doc.rect(0, pY, W, 28).fillColor(hexToRgb('#f8fafc')).fill();
      stroke(COLORS.border); doc.moveTo(0, pY).lineTo(W, pY).lineWidth(0.5).stroke();
      fill(COLORS.muted);
      doc.fontSize(7).font('Helvetica')
        .text(`${overview.quarterLabel} Feedback Report  ·  Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, MARGIN, pY + 9, { lineBreak: false });
      doc.fontSize(7).font('Helvetica')
        .text(`Page ${i + 1} of ${range.count}`, W - MARGIN - 50, pY + 9, { lineBreak: false, width: 50, align: 'right' });
    }

    doc.end();
  });
}

// ─────────────────────────────────────────
// EMAIL HTML TEMPLATE
// ─────────────────────────────────────────

function generateReportEmail(data: {
  quarterLabel: string;
  outcome: string;
  overallPct: number;
  totalRespondents: number;
  totalAssigned: number;
  sections: OverviewData['sections'];
}): string {
  const color = data.outcome.toLowerCase().includes('incentive')
    ? '#10b981'
    : data.outcome.toLowerCase().includes('penalty')
      ? '#ef4444'
      : '#f59e0b';

  const sectionRows = data.sections
    .map(s => `
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${s.label}</td>
        <td style="padding:10px 16px;font-size:13px;color:#1e293b;text-align:right;border-bottom:1px solid #e2e8f0;">${s.avg.toFixed(2)}</td>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:${s.pct >= 80 ? '#10b981' : '#ef4444'};text-align:right;border-bottom:1px solid #e2e8f0;">${s.pct.toFixed(1)}%</td>
        <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">${s.appliesTo}</td>
      </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.08em;">${data.outcome}</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${data.quarterLabel}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">Feedback Report</p>
    </div>
    <div style="padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:0 8px 0 0;width:50%;">
            <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;">
              <p style="margin:0 0 3px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Respondents</p>
              <p style="margin:0;font-size:19px;font-weight:700;color:#0f172a;">${data.totalRespondents}<span style="font-size:13px;font-weight:400;color:#64748b;"> / ${data.totalAssigned}</span></p>
            </div>
          </td>
          <td style="padding:0 0 0 8px;width:50%;">
            <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;">
              <p style="margin:0 0 3px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Overall Satisfaction</p>
              <p style="margin:0;font-size:19px;font-weight:700;color:${color};">${data.overallPct.toFixed(1)}%</p>
            </div>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;font-weight:600;">Section</th>
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:600;">Score /4</th>
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:600;">Satisfaction</th>
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;font-weight:600;">Applies To</th>
          </tr>
        </thead>
        <tbody>${sectionRows}</tbody>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">The full report with individual customer responses is attached as a PDF.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">© ${new Date().getFullYear()} All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────
// NODEMAILER TRANSPORTER
// ─────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!,
    },
    connectionTimeout: 10_000,
    greetingTimeout:    8_000,
    socketTimeout:     15_000,
  });
}

// ─────────────────────────────────────────
// SEND ONE EMAIL
// ─────────────────────────────────────────

const PER_EMAIL_TIMEOUT_MS = 25_000;

async function sendOneEmail(opts: {
  transporter: ReturnType<typeof createTransporter>;
  to: string;
  subject: string;
  html: string;
  filename: string;
  pdfBuffer: Buffer;
}): Promise<string> {
  const sendPromise = opts.transporter.sendMail({
    from:    `Car Rental Feedback <${process.env.EMAIL_USER}>`,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    attachments: [{
      filename:    opts.filename,
      content:     opts.pdfBuffer,
      contentType: 'application/pdf',
    }],
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Send timed out after ${PER_EMAIL_TIMEOUT_MS / 1000}s`)),
      PER_EMAIL_TIMEOUT_MS,
    ),
  );

  const info = await Promise.race([sendPromise, timeoutPromise]);
  return info.messageId;
}

// ─────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startMs = Date.now();

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  );

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return res.status(405).json({ error: 'Method not allowed' }); }

  log('info', 'request_received');

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader) { log('warn', 'auth_missing'); return res.status(401).json({ error: 'No authorization header' }); }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      log('warn', 'auth_failed', { error: userError?.message });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    log('info', 'auth_ok', { userId: user.id });

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', user.id).single();
    if (roleError || !roleData || !['admin', 'superadmin'].includes(roleData.role)) {
      log('warn', 'role_check_failed', { role: roleData?.role, error: roleError?.message });
      return res.status(403).json({ error: 'Admin access required' });
    }
    log('info', 'role_ok', { role: roleData.role });

    // ── 2. Env check ─────────────────────────────────────────────────────────
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      log('error', 'env_missing', 'EMAIL_USER or EMAIL_PASSWORD not set');
      return res.status(500).json({ error: 'Email credentials not configured.' });
    }

    // ── 3. Parse body ─────────────────────────────────────────────────────────
    const { recipients, overview, responses, questions, kpiRows } = req.body as SendReportEmailRequest;
    if (!recipients?.length || !overview || !responses || !questions || !kpiRows) {
      log('warn', 'body_invalid', 'Missing required fields');
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const validRecipients = recipients.filter(e => typeof e === 'string' && e.includes('@'));
    if (validRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses provided.' });
    }
    log('info', 'body_ok', { recipients: validRecipients.length, responses: responses.length, questions: questions.length });

    // ── 4. Build PDF ──────────────────────────────────────────────────────────
    log('info', 'pdf_build_start');
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildPDF({ recipients, overview, responses, questions, kpiRows });
      log('info', 'pdf_build_ok', { bytes: pdfBuffer.length });
    } catch (pdfErr: any) {
      log('error', 'pdf_build_failed', { error: pdfErr.message });
      return res.status(500).json({ error: 'Failed to generate PDF: ' + pdfErr.message });
    }

    const filename  = `${overview.quarterLabel.replace(/\s+/g, '_')}_Report.pdf`;
    const html      = generateReportEmail({ quarterLabel: overview.quarterLabel, outcome: overview.outcome, overallPct: overview.overallPct, totalRespondents: overview.totalRespondents, totalAssigned: overview.totalAssigned, sections: overview.sections });
    const subject   = `📊 ${overview.quarterLabel} Feedback Report — ${overview.outcome}`;
    const transporter = createTransporter();
    log('info', 'transporter_ready', { user: process.env.EMAIL_USER });

    // ── 5. Send ───────────────────────────────────────────────────────────────
    const results: EmailResult[] = [];
    for (const email of validRecipients) {
      log('info', 'send_start', { to: email });
      try {
        const messageId = await sendOneEmail({ transporter, to: email, subject, html, filename, pdfBuffer });
        log('info', 'send_ok', { to: email, messageId });
        results.push({ email, success: true });
      } catch (sendErr: any) {
        log('error', 'send_failed', { to: email, error: sendErr.message });
        results.push({ email, success: false, error: sendErr.message });
      }
    }

    const succeeded  = results.filter(r => r.success).length;
    const durationMs = Date.now() - startMs;
    log('info', 'handler_complete', { sent: succeeded, total: validRecipients.length, durationMs });

    const statusCode = succeeded === 0 ? 500 : succeeded < validRecipients.length ? 207 : 200;
    return res.status(statusCode).json({ success: succeeded > 0, results, sent: succeeded, total: validRecipients.length, durationMs });

  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    log('error', 'handler_fatal', { error: err.message, stack: err.stack, durationMs });
    return res.status(500).json({ error: err.message || 'Failed to send report emails' });
  }
}