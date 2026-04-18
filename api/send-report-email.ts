// api/send-report-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

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
// COLORS
// ─────────────────────────────────────────

const C = {
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
  darkBg:             '#0f172a',
  card:               '#f8fafc',
  border:             '#e2e8f0',
  text:               '#0f172a',
  muted:              '#64748b',
  light:              '#cbd5e1',
  white:              '#ffffff',
  altRow:             '#f8fafc',
} as const;

type RGB = [number, number, number];

function hex2rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// Creates a tinted (light) version of a colour for badge backgrounds
function tintRgb(hex: string, amount = 0.85): RGB {
  const [r,g,b] = hex2rgb(hex);
  return [
    Math.min(255, Math.round(r + (255-r)*amount)),
    Math.min(255, Math.round(g + (255-g)*amount)),
    Math.min(255, Math.round(b + (255-b)*amount)),
  ];
}

function outcomeColor(outcome: string): string {
  const key = outcome.toLowerCase().replace(/ /g,'_') as keyof typeof C;
  return (C[key] as string) ?? C.muted;
}

function sectionColor(key: string): string {
  return (C[key as keyof typeof C] as string) ?? C.primary;
}

const SECTION_KEY_MAP: Record<string, string> = {
  'Service Initiation': 'service_initiation',
  'Service Delivery':   'service_delivery',
  'Driver Quality':     'driver_quality',
  'Overall Experience': 'overall',
};

function labelToKey(label: string): string {
  return SECTION_KEY_MAP[label] ?? 'overall';
}

function scoreColor(score: number | null | undefined): string {
  if (score === 4) return C.score4;
  if (score === 3) return C.score3;
  if (score === 2) return C.score2;
  if (score === 1) return C.score1;
  return C.light;
}

// Safe ASCII replacements for Unicode chars that PDFKit's built-in fonts can't render
// This fixes the "e80% !' Penalty" garbling
function safeText(s: string): string {
  return s
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/−/g, '-')
    .replace(/—/g, '-')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"');
}

// ─────────────────────────────────────────
// PDF BUILDER
// ─────────────────────────────────────────

function buildPDF(payload: SendReportEmailRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { overview, responses, questions, kpiRows } = payload;

    // bufferPages:true lets us go back and stamp footers after all pages are known
    const doc = new (PDFDocument as any)({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      info: {
        Title:  `${overview.quarterLabel} - Feedback Report`,
        Author: 'Autoriders',
        Subject: 'Quarterly Feedback Report',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW     = doc.page.width;   // 595.28
    const PH     = doc.page.height;  // 841.89
    const M      = 40;               // margin
    const CW     = PW - M * 2;      // content width  515.28
    const FOOTER = 28;               // footer height
    const BOTTOM = PH - FOOTER - 8; // last usable y before footer zone

    // ── Low-level drawing helpers ────────────────────────────────────────────

    const setFill   = (hex: string) => doc.fillColor(hex2rgb(hex));
    const setStroke = (hex: string) => doc.strokeColor(hex2rgb(hex));

    function rect(x:number, y:number, w:number, h:number, fillHex?:string, strokeHex?:string, r=0) {
      if (fillHex)   setFill(fillHex);
      if (strokeHex) setStroke(strokeHex);
      if (r > 0) doc.roundedRect(x,y,w,h,r);
      else       doc.rect(x,y,w,h);
      if (fillHex && strokeHex) doc.fillAndStroke();
      else if (fillHex)         doc.fill();
      else if (strokeHex)       doc.stroke();
    }

    function hline(y:number, x1=M, x2=PW-M, colorHex=C.border, lw=0.5) {
      setStroke(colorHex);
      doc.moveTo(x1,y).lineTo(x2,y).lineWidth(lw).stroke();
    }

    function progressBar(x:number, y:number, w:number, h:number, pct:number, colorHex:string) {
      rect(x, y, w, h, '#f1f5f9', undefined, h/2);
      const filled = Math.max(0, Math.min(w, (pct/100)*w));
      if (filled > 0) rect(x, y, filled, h, colorHex, undefined, h/2);
    }

    // Draw a small coloured badge pill; returns width used
    function pill(x:number, y:number, label:string, colorHex:string, h=14): number {
      const bg  = tintRgb(colorHex);
      const txt = label.toUpperCase();
      const tw  = doc.widthOfString(txt, {fontSize:7}) + 12;
      doc.roundedRect(x,y,tw,h,3).fillColor(bg).fill();
      doc.fontSize(7).font('Helvetica-Bold').fillColor(hex2rgb(colorHex))
         .text(txt, x+6, y + (h-7)/2, {lineBreak:false});
      return tw;
    }

    // Filled circle with centred text (for score circles)
    function scoreCircle(cx:number, cy:number, score:number|null|undefined, r=6) {
      if (score !== null && score !== undefined) {
        doc.circle(cx, cy, r).fillColor(hex2rgb(scoreColor(score))).fill();
        doc.fontSize(6).font('Helvetica-Bold').fillColor([255,255,255] as any)
           .text(String(score), cx-2.8, cy-3.5, {lineBreak:false});
      } else {
        setFill(C.light);
        doc.fontSize(6).font('Helvetica').text('-', cx-1.5, cy-3, {lineBreak:false});
      }
    }

    // Section colour-band label header (grey for name+type columns, tinted for each section group)
    // Returns new Y after drawing
    function drawResponseTableHeader(tableX:number, nameW:number, typeW:number, qW:number,
                                     sortedQs: QuestionRef[], sectionGroups: {key:string; label:string; qs:QuestionRef[]}[],
                                     y:number): number {
      // Row 1 — section colour bands
      rect(tableX, y, nameW+typeW, 14, '#f1f5f9');
      let qx = tableX + nameW + typeW;
      sectionGroups.forEach(g => {
        const bw = g.qs.length * qW;
        rect(qx, y, bw, 14, tintRgb(sectionColor(g.key), 0.88) as any);
        const sc = sectionColor(g.key);
        doc.fontSize(5.5).font('Helvetica-Bold').fillColor(hex2rgb(sc))
           .text(g.label.split(' ')[0], qx+2, y+4, {lineBreak:false, width:bw-4, ellipsis:true});
        qx += bw;
      });
      y += 14;

      // Row 2 — column name headers
      rect(tableX, y, nameW+typeW + sortedQs.length*qW, 16, '#e2e8f0');
      setFill(C.muted);
      doc.fontSize(7).font('Helvetica-Bold')
         .text('Customer', tableX+4, y+5, {lineBreak:false, width:nameW-4});
      doc.text('Type', tableX+nameW+4, y+5, {lineBreak:false, width:typeW-4});
      let qhx = tableX + nameW + typeW;
      sortedQs.forEach(q => {
        doc.text(`Q${q.number}`, qhx+1, y+5, {lineBreak:false, width:qW-2, align:'center'});
        qhx += qW;
      });
      y += 16;
      return y;
    }

    // ── PAGE HEADER helper (used on every page of the responses section) ──────
    function drawPageHeader(subtitle: string) {
      // Dark top bar — full width, 46px tall
      rect(0, 0, PW, 46, C.darkBg);

      // Try to load logo from project public folder (Vercel serves from /public)
      const logoPath = path.join(process.cwd(), 'public', 'autoriders.webp');
      if (fs.existsSync(logoPath)) {
        try {
          // Draw logo on the left, vertically centred in the bar
          doc.image(logoPath, M, 7, { fit: [110, 32], align: 'left', valign: 'center' });
        } catch (_) {
          // Fallback: text logo
          doc.fontSize(13).font('Helvetica-Bold').fillColor(hex2rgb(C.white))
             .text('Autoriders', M, 15, {lineBreak:false});
        }
      } else {
        // Fallback: text brand name
        doc.fontSize(13).font('Helvetica-Bold').fillColor(hex2rgb(C.white))
           .text('Autoriders', M, 15, {lineBreak:false});
      }

      // Right-aligned subtitle
      setFill(C.light);
      doc.fontSize(8).font('Helvetica')
         .text(subtitle, 0, 16, {lineBreak:false, width:PW-M, align:'right'});
    }

    // ── FOOTER helper — called in the final buffered-page pass ───────────────
    // NOTE: this must NOT call doc.addPage() — footers are stamped after all
    // content pages have already been created.
    function stampFooter(pageIndex: number, totalPages: number) {
      const y = PH - FOOTER;
      rect(0, y, PW, FOOTER, C.card);
      hline(y, 0, PW, C.border, 0.5);
      setFill(C.muted);
      const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'});
      doc.fontSize(7).font('Helvetica')
         .text(`${overview.quarterLabel} Feedback Report  |  Generated ${dateStr}`, M, y+9, {lineBreak:false});
      doc.fontSize(7).font('Helvetica')
         .text(`Page ${pageIndex+1} of ${totalPages}`, 0, y+9, {lineBreak:false, width:PW-M, align:'right'});
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 1 — Overview
    // ─────────────────────────────────────────────────────────────────────────

    const oc = outcomeColor(overview.outcome);

    // Header bar (taller on cover — 72px)
    rect(0, 0, PW, 72, C.darkBg);

    // Logo
    const logoPath = path.join(process.cwd(), 'public', 'autoriders.webp');
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, M, 10, { fit: [130, 36], align: 'left', valign: 'center' });
      } catch (_) {
        doc.fontSize(15).font('Helvetica-Bold').fillColor(hex2rgb(C.white)).text('Autoriders', M, 22, {lineBreak:false});
      }
    } else {
      doc.fontSize(15).font('Helvetica-Bold').fillColor(hex2rgb(C.white)).text('Autoriders', M, 22, {lineBreak:false});
    }

    // Outcome badge top-right
    pill(PW - M - 70, 16, overview.outcome, oc, 16);

    // Quarter label bottom of header
    setFill(C.white);
    doc.fontSize(16).font('Helvetica-Bold')
       .text(`${overview.quarterLabel}  —  Feedback Report`, M, 44, {lineBreak:false});

    let y = 82; // cursor starts after header

    // ── Stat cards (2 columns × 2 rows) ──────────────────────────────────────
    const cW2 = (CW - 10) / 2;
    const cH  = 58;
    const cards = [
      { label: 'Respondents',
        value: `${overview.totalRespondents} / ${overview.totalAssigned}`,
        sub:   `${overview.totalAssigned > 0 ? Math.round((overview.totalRespondents/overview.totalAssigned)*100) : 0}% response rate` },
      { label: 'Overall Satisfaction',
        value: `${overview.overallPct.toFixed(1)}%`,
        sub:   'Target: >=80%',
        vColor: overview.overallPct >= 80 ? C.score4 : C.score1 },
      { label: 'New Expats',
        value: `${overview.newExpatCount}`,
        sub:   `of ${overview.totalRespondents} respondents` },
      { label: 'Outcome',
        value: overview.outcome,
        sub:   'Quarter result',
        vColor: oc },
    ];

    let cardRow = 0;
    cards.forEach((card, i) => {
      if (i === 2) cardRow = 1;
      const cx = M + (i%2)*(cW2+10);
      const cy = y + cardRow*(cH+8);
      rect(cx, cy, cW2, cH, C.card, C.border, 6);
      setFill(C.muted);
      doc.fontSize(7).font('Helvetica').text(card.label, cx+12, cy+10, {lineBreak:false});
      setFill((card as any).vColor ?? C.text);
      doc.fontSize(15).font('Helvetica-Bold').text(card.value, cx+12, cy+22, {lineBreak:false});
      setFill(C.muted);
      doc.fontSize(7).font('Helvetica').text(card.sub, cx+12, cy+42, {lineBreak:false});
    });

    y += 2*cH + 8 + 16;
    hline(y); y += 14;

    // ── KPI Outcomes table ────────────────────────────────────────────────────
    rect(M, y, CW, 20, C.card); // section header
    setFill(C.text);
    doc.fontSize(8).font('Helvetica-Bold').text('KPI OUTCOMES', M+10, y+6, {lineBreak:false});
    y += 20;

    // Table header row
    const kpiCols = [
      {label:'Section',      x:M+10,     w:150},
      {label:'Score /4',     x:M+165,    w:65,  align:'right'},
      {label:'Satisfaction', x:M+233,    w:75,  align:'right'},
      {label:'Target',       x:M+312,    w:55,  align:'right'},
      {label:'Outcome',      x:M+372,    w:90},
    ] as const;

    rect(M, y, CW, 18, '#f1f5f9');
    kpiCols.forEach(col => {
      setFill(C.muted);
      doc.fontSize(7).font('Helvetica-Bold')
         .text(col.label, col.x, y+5, {lineBreak:false, width:col.w, align:(col as any).align ?? 'left'});
    });
    y += 18;

    kpiRows.forEach((row, idx) => {
      const rH = 22;
      if (idx%2===0) rect(M, y, CW, rH, '#fafafa');
      const sc = sectionColor(labelToKey(row.section));
      doc.circle(kpiCols[0].x+5, y+11, 4).fillColor(hex2rgb(sc)).fill();
      setFill(C.text);
      doc.fontSize(8).font('Helvetica-Bold')
         .text(row.section, kpiCols[0].x+14, y+7, {lineBreak:false, width:130});
      setFill(C.text);
      doc.fontSize(8).font('Helvetica')
         .text(row.avg.toFixed(2), kpiCols[1].x, y+7, {lineBreak:false, width:kpiCols[1].w, align:'right'});
      setFill(row.pct >= 80 ? C.score4 : C.score1);
      doc.fontSize(8).font('Helvetica-Bold')
         .text(`${row.pct.toFixed(1)}%`, kpiCols[2].x, y+7, {lineBreak:false, width:kpiCols[2].w, align:'right'});
      setFill(C.muted);
      doc.fontSize(8).font('Helvetica')
         .text(`${row.target}%`, kpiCols[3].x, y+7, {lineBreak:false, width:kpiCols[3].w, align:'right'});
      pill(kpiCols[4].x, y+5, row.outcome, outcomeColor(row.outcome));
      y += rH;
      hline(y, M, PW-M, C.border, 0.3);
    });

    // KPI footnote — use ASCII replacements to avoid encoding bugs
    setFill(C.muted);
    doc.fontSize(7).font('Helvetica')
       .text(safeText('Target: >=80% · Below 70% -> Penalty (-3%) · >=85% -> Incentive (+3%)'), M+10, y+5, {lineBreak:false});
    y += 20;
    hline(y); y += 12;

    // ── Section Satisfaction bars ──────────────────────────────────────────────
    rect(M, y, CW, 20, C.card);
    setFill(C.text);
    doc.fontSize(8).font('Helvetica-Bold').text('SECTION SATISFACTION', M+10, y+6, {lineBreak:false});
    y += 20 + 6;

    overview.sections.forEach(s => {
      const sc = sectionColor(labelToKey(s.label));
      // Label + appliesTo + pct on one line
      setFill(sc);
      doc.fontSize(8).font('Helvetica-Bold').text(s.label, M+10, y, {lineBreak:false});
      const lw = doc.widthOfString(s.label, {fontSize:8});
      setFill(C.muted);
      doc.fontSize(7).font('Helvetica').text(`  ${s.appliesTo}`, M+12+lw, y+0.5, {lineBreak:false});
      const pctStr = `${s.pct.toFixed(1)}%`;
      setFill(s.pct >= 80 ? C.score4 : C.score1);
      doc.fontSize(8).font('Helvetica-Bold')
         .text(pctStr, 0, y, {lineBreak:false, width:PW-M-2, align:'right'});
      y += 12;
      progressBar(M+10, y, CW-20, 6, s.pct, sc);
      y += 14;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 2+ — Individual Responses (customers as rows, questions as columns)
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    drawPageHeader(`${overview.quarterLabel}  —  Individual Responses`);
    let iy = 56; // content starts after header bar

    const SECTION_ORDER = ['service_initiation','service_delivery','driver_quality','overall'];
    const SECTION_LABELS: Record<string,string> = {
      service_initiation: 'Service Initiation',
      service_delivery:   'Service Delivery',
      driver_quality:     'Driver Quality',
      overall:            'Overall Experience',
    };

    const sortedQ  = [...questions].sort((a,b) => a.number - b.number);
    const secGroups = SECTION_ORDER
      .map(k => ({ key:k, label:SECTION_LABELS[k], qs:sortedQ.filter(q=>q.section===k) }))
      .filter(g => g.qs.length > 0);

    // Column widths — name column is fixed, question columns fill the rest
    const nameW =  115;
    const typeW =  36;
    const qW    = Math.max(18, Math.min(26, Math.floor((CW - nameW - typeW) / sortedQ.length)));
    const tblW  = nameW + typeW + sortedQ.length * qW;
    const tblX  = M + Math.max(0, Math.floor((CW - tblW) / 2));

    iy = drawResponseTableHeader(tblX, nameW, typeW, qW, sortedQ, secGroups, iy);

    responses.forEach((resp, idx) => {
      const rowH = 18;

      // Page break — add new page and redraw header + column headers
      if (iy + rowH > BOTTOM) {
        doc.addPage();
        drawPageHeader(`${overview.quarterLabel}  —  Individual Responses (cont.)`);
        iy = 56;
        iy = drawResponseTableHeader(tblX, nameW, typeW, qW, sortedQ, secGroups, iy);
      }

      // Alternating row background
      rect(tblX, iy, tblW, rowH, idx%2===0 ? C.white : C.altRow);

      // NEW expat left accent bar
      if (resp.isNew) {
        rect(tblX, iy, 3, rowH, C.primary);
      }

      // Customer name
      setFill(C.text);
      doc.fontSize(7.5).font('Helvetica-Bold')
         .text(resp.customerName, tblX+5, iy+5, {lineBreak:false, width:nameW-7, ellipsis:true});

      // Type badge
      if (resp.isNew) {
        doc.roundedRect(tblX+nameW+2, iy+4, 28, 10, 2)
           .fillColor(tintRgb(C.primary)).fill();
        doc.fontSize(5.5).font('Helvetica-Bold').fillColor(hex2rgb(C.primary))
           .text('NEW', tblX+nameW+5, iy+6, {lineBreak:false});
      } else {
        setFill(C.muted);
        doc.fontSize(6.5).font('Helvetica')
           .text('Exist.', tblX+nameW+3, iy+6, {lineBreak:false});
      }

      // Score circles per question
      let qcx = tblX + nameW + typeW;
      sortedQ.forEach(q => {
        const score = resp.answers[`Q${q.number}`];
        scoreCircle(qcx + qW/2, iy + rowH/2, (score !== undefined ? score : null));
        qcx += qW;
      });

      // Row bottom border
      setStroke(C.border);
      doc.moveTo(tblX, iy+rowH).lineTo(tblX+tblW, iy+rowH).lineWidth(0.3).stroke();
      iy += rowH;
    });

    // Score legend below table
    iy += 10;
    if (iy + 20 > BOTTOM) { doc.addPage(); drawPageHeader(`${overview.quarterLabel}  —  Legend`); iy = 56; }
    hline(iy, M, PW-M); iy += 8;
    const scoreLegend = [
      {s:4, l:'Excellence',         c:C.score4},
      {s:3, l:'Good',               c:C.score3},
      {s:2, l:'Fair',               c:C.score2},
      {s:1, l:'Needs Improvement',  c:C.score1},
    ];
    let lx = M;
    scoreLegend.forEach(sl => {
      doc.circle(lx+5, iy+5, 5).fillColor(hex2rgb(sl.c)).fill();
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor([255,255,255] as any)
         .text(String(sl.s), lx+3, iy+2, {lineBreak:false});
      setFill(C.muted);
      doc.fontSize(7).font('Helvetica').text(sl.l, lx+13, iy+2, {lineBreak:false});
      lx += 16 + doc.widthOfString(sl.l, {fontSize:7}) + 14;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LAST PAGE — Question Reference
    // ─────────────────────────────────────────────────────────────────────────

    doc.addPage();
    drawPageHeader(`${overview.quarterLabel}  —  Question Reference`);
    let qy = 56;

    secGroups.forEach(g => {
      if (qy + 30 > BOTTOM) {
        doc.addPage();
        drawPageHeader(`${overview.quarterLabel}  —  Question Reference (cont.)`);
        qy = 56;
      }

      const sc = sectionColor(g.key);
      // Section band
      rect(M, qy, CW, 20, tintRgb(sc, 0.9) as any);
      rect(M, qy, 4,  20, sc); // left accent
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(hex2rgb(sc))
         .text(g.label.toUpperCase(), M+12, qy+6, {lineBreak:false});
      qy += 24;

      g.qs.forEach(q => {
        // Estimate height needed: question text may wrap
        const estimatedLines = Math.ceil(doc.widthOfString(q.text, {fontSize:7.5}) / (CW-30)) + 1;
        const estimatedH = estimatedLines * 10 + 6;
        if (qy + estimatedH > BOTTOM) {
          doc.addPage();
          drawPageHeader(`${overview.quarterLabel}  —  Question Reference (cont.)`);
          qy = 56;
        }

        const beforeY = qy;
        setFill(C.muted);
        doc.fontSize(7.5).font('Helvetica-Bold')
           .text(`Q${q.number}`, M+6, qy, {lineBreak:false, width:22});
        setFill(C.text);
        doc.fontSize(7.5).font('Helvetica')
           .text(q.text, M+28, qy, {width: CW-32});
        qy = Math.max(qy + 14, doc.y + 2);
      });
      qy += 10;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STAMP FOOTERS — iterate buffered pages and add footer to EVERY page.
    // This is the correct pattern: we switch to each page AFTER doc.end() prep
    // and write only the footer box without adding new pages.
    // ─────────────────────────────────────────────────────────────────────────

    const range      = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      stampFooter(i, totalPages);
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

  const sectionRows = data.sections.map(s => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${s.label}</td>
      <td style="padding:10px 16px;font-size:13px;color:#1e293b;text-align:right;border-bottom:1px solid #e2e8f0;">${s.avg.toFixed(2)}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:${s.pct>=80?'#10b981':'#ef4444'};text-align:right;border-bottom:1px solid #e2e8f0;">${s.pct.toFixed(1)}%</td>
      <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">${s.appliesTo}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.08em;">Autoriders</p>
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:.06em;">${data.outcome}</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${data.quarterLabel}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">Feedback Report</p>
    </div>
    <div style="padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:0 8px 0 0;width:50%;">
            <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;">
              <p style="margin:0 0 3px;font-size:10px;color:#64748b;text-transform:uppercase;">Respondents</p>
              <p style="margin:0;font-size:19px;font-weight:700;color:#0f172a;">${data.totalRespondents}<span style="font-size:13px;font-weight:400;color:#64748b;"> / ${data.totalAssigned}</span></p>
            </div>
          </td>
          <td style="padding:0 0 0 8px;width:50%;">
            <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;">
              <p style="margin:0 0 3px;font-size:10px;color:#64748b;text-transform:uppercase;">Overall Satisfaction</p>
              <p style="margin:0;font-size:19px;font-weight:700;color:${color};">${data.overallPct.toFixed(1)}%</p>
            </div>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Section</th>
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Score /4</th>
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Satisfaction</th>
            <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Applies To</th>
          </tr>
        </thead>
        <tbody>${sectionRows}</tbody>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">The full report with individual customer responses is attached as a PDF.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">© ${new Date().getFullYear()} Autoriders. All rights reserved.</p>
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
    from:    `Autoriders Feedback <${process.env.EMAIL_USER}>`,
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
    if (!authHeader) {
      log('warn', 'auth_missing');
      return res.status(401).json({ error: 'No authorization header' });
    }

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
    if (roleError || !roleData || !['admin','superadmin'].includes(roleData.role)) {
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
    log('info', 'body_ok', { recipients: validRecipients.length, responses: responses.length });

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

    const filename    = `${overview.quarterLabel.replace(/\s+/g,'_')}_Report.pdf`;
    const html        = generateReportEmail({ quarterLabel:overview.quarterLabel, outcome:overview.outcome, overallPct:overview.overallPct, totalRespondents:overview.totalRespondents, totalAssigned:overview.totalAssigned, sections:overview.sections });
    const subject     = `Autoriders - ${overview.quarterLabel} Feedback Report (${overview.outcome})`;
    const transporter = createTransporter();
    log('info', 'transporter_ready', { user: process.env.EMAIL_USER });

    // ── 5. Send ───────────────────────────────────────────────────────────────
    const results: EmailResult[] = [];
    for (const email of validRecipients) {
      log('info', 'send_start', { to: email });
      try {
        const messageId = await sendOneEmail({ transporter, to:email, subject, html, filename, pdfBuffer });
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