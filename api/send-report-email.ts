// api/send-report-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

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
// EXCEL GENERATION
// ─────────────────────────────────────────

function buildExcel(payload: SendReportEmailRequest): Buffer {
  const wb = XLSX.utils.book_new();
  const { overview, responses, questions, kpiRows } = payload;

  // ── Sheet 1: Overview ──────────────────────────────────────────────────────
  const overviewRows: (string | number)[][] = [
    ['Quarter Report — ' + overview.quarterLabel],
    [],
    ['Outcome',                  overview.outcome],
    ['Total Respondents',        overview.totalRespondents],
    ['Total Assigned',           overview.totalAssigned],
    ['Response Rate (%)',        overview.totalAssigned > 0
      ? +((overview.totalRespondents / overview.totalAssigned) * 100).toFixed(1)
      : 0],
    ['New Expat Count',          overview.newExpatCount],
    ['Overall Satisfaction (%)', +overview.overallPct.toFixed(1)],
    [],
    ['Section', 'Avg Score (/4)', 'Satisfaction (%)', 'Applies To'],
    ...overview.sections.map(s => [s.label, +s.avg.toFixed(2), +s.pct.toFixed(1), s.appliesTo]),
    [],
    ['KPI Thresholds'],
    ['≥ 85%', 'Incentive (+3%)'],
    ['≥ 80%', 'On Target'],
    ['≥ 70%', 'Below Target'],
    ['< 70%', 'Penalty (−3%)'],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  wsOverview['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 22 }];
  wsOverview['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // ── Sheet 2: Responses Table ───────────────────────────────────────────────
  const sortedQuestions = [...questions].sort((a, b) => a.number - b.number);
  const respHeader = ['Customer Name', 'New Expat?', ...sortedQuestions.map(q => `Q${q.number}`)];
  const respRows = responses.map(r => [
    r.customerName,
    r.isNew ? 'Yes' : 'No',
    ...sortedQuestions.map(q => {
      const val = r.answers[`Q${q.number}`];
      return val !== undefined && val !== null ? val : '—';
    }),
  ]);

  const wsResponses = XLSX.utils.aoa_to_sheet([respHeader, ...respRows]);
  wsResponses['!cols'] = [
    { wch: 24 },
    { wch: 12 },
    ...sortedQuestions.map(() => ({ wch: 6 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsResponses, 'Responses');

  // ── Sheet 3: Full Report ───────────────────────────────────────────────────
  const sectionOrder = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'];
  const sectionLabels: Record<string, string> = {
    service_initiation: 'Service Initiation',
    service_delivery:   'Service Delivery',
    driver_quality:     'Driver Quality',
    overall:            'Overall Experience',
  };
  const sectionAppliesTo: Record<string, string> = {
    service_initiation: 'New expats only',
    service_delivery:   'All respondents',
    driver_quality:     'All respondents',
    overall:            'All respondents',
  };

  const fullRows: (string | number)[][] = [
    [`${overview.quarterLabel} — Full Report`],
    [],
    ['SUMMARY'],
    ['Outcome',              overview.outcome],
    ['Overall Satisfaction', `${overview.overallPct.toFixed(1)}%`],
    ['Respondents',          `${overview.totalRespondents} / ${overview.totalAssigned}`],
    ['New Expats',           overview.newExpatCount],
    [],
    ['KPI OUTCOMES'],
    ['Section', 'Score /4', 'Satisfaction %', 'Target %', 'Outcome'],
    ...kpiRows.map(k => [k.section, +k.avg.toFixed(2), +k.pct.toFixed(1), k.target, k.outcome]),
    [],
    ['SECTION BREAKDOWN'],
  ];

  for (const sKey of sectionOrder) {
    const sLabel     = sectionLabels[sKey] ?? sKey;
    const sQuestions = questions
      .filter(q => q.section === sKey)
      .sort((a, b) => a.number - b.number);
    if (sQuestions.length === 0) continue;
    fullRows.push([], [sLabel, `(${sectionAppliesTo[sKey]})`], ['Q#', 'Question Text']);
    sQuestions.forEach(q => fullRows.push([`Q${q.number}`, q.text]));
  }

  fullRows.push(
    [],
    ['INDIVIDUAL RESPONSES'],
    ['Customer', 'New Expat?', ...sortedQuestions.map(q => `Q${q.number}`)],
  );
  responses.forEach(r => {
    fullRows.push([
      r.customerName,
      r.isNew ? 'Yes' : 'No',
      ...sortedQuestions.map(q => {
        const val = r.answers[`Q${q.number}`];
        return val !== undefined && val !== null ? val : '—';
      }),
    ]);
  });

  const wsFull = XLSX.utils.aoa_to_sheet(fullRows);
  wsFull['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsFull, 'Full Report');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px 36px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Car Rental Feedback System</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">${data.quarterLabel} — Feedback Report</h1>
    </div>
    <div style="padding:28px 36px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Outcome</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:${color};">${data.outcome}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Overall Satisfaction</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">${data.overallPct.toFixed(1)}%</p>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Respondents</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">${data.totalRespondents}<span style="font-size:12px;font-weight:400;color:#94a3b8;"> / ${data.totalAssigned}</span></p>
        </div>
      </div>
      <h3 style="margin:0 0 12px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Section Results</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Section</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Avg /4</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Satisfaction</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Applies To</th>
          </tr>
        </thead>
        <tbody>${sectionRows}</tbody>
      </table>
      <div style="margin-top:28px;padding:16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#64748b;">
          📎 <strong>Attachment:</strong> ${data.quarterLabel.replace(/\s+/g, '_')}_Report.xlsx —
          sheets: <strong>Overview</strong>, <strong>Responses</strong>, <strong>Full Report</strong>.
        </p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:24px 36px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:13px;font-weight:600;color:#d97706;margin:0 0 4px;">Car Rental Feedback System</p>
      <p style="font-size:11px;color:#94a3b8;margin:0;">This is an automated report. Please do not reply.</p>
      <p style="font-size:11px;color:#94a3b8;margin:3px 0 0;">© ${new Date().getFullYear()} All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────
// NODEMAILER TRANSPORTER
//
// Created fresh per request — avoids stale connection-pool state
// that causes silent hangs in Vercel's stateless serverless environment.
//
// port 587 + secure:false  = STARTTLS (correct for Google App Passwords)
// port 465 + secure:true   = SSL/TLS   (do NOT use with App Passwords)
// ─────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false, // STARTTLS — correct setting for App Passwords on port 587
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!, // 16-char Google App Password, no spaces
    },
    connectionTimeout: 10_000, // 10s to establish TCP connection
    greetingTimeout:    8_000, //  8s to receive SMTP greeting banner
    socketTimeout:     15_000, // 15s max idle time — prevents silent stalls
  });
}

// ─────────────────────────────────────────
// SEND ONE EMAIL  (with hard per-email timeout)
// ─────────────────────────────────────────

const PER_EMAIL_TIMEOUT_MS = 25_000; // 25s per recipient

async function sendOneEmail(opts: {
  transporter: ReturnType<typeof createTransporter>;
  to: string;
  subject: string;
  html: string;
  filename: string;
  excelBuffer: Buffer;
}): Promise<string> {
  const sendPromise = opts.transporter.sendMail({
    from:    `Car Rental Feedback <${process.env.EMAIL_USER}>`,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    attachments: [
      {
        filename:    opts.filename,
        content:     opts.excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });

  // If Gmail SMTP stalls we reject fast rather than blocking the whole function
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Send timed out after ${PER_EMAIL_TIMEOUT_MS / 1000}s — Gmail SMTP did not respond`)),
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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  );

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return res.status(405).json({ error: 'Method not allowed' }); }

  log('info', 'request_received');

  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
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
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !['admin', 'superadmin'].includes(roleData.role)) {
      log('warn', 'role_check_failed', { role: roleData?.role, error: roleError?.message });
      return res.status(403).json({ error: 'Admin access required' });
    }
    log('info', 'role_ok', { role: roleData.role });

    // ── 2. Env check ──────────────────────────────────────────────────────────
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      log('error', 'env_missing', 'EMAIL_USER or EMAIL_PASSWORD not set');
      return res.status(500).json({
        error: 'Email credentials not configured. Add EMAIL_USER and EMAIL_PASSWORD in Vercel → Settings → Environment Variables.',
      });
    }

    // ── 3. Parse body ─────────────────────────────────────────────────────────
    const { recipients, overview, responses, questions, kpiRows } =
      req.body as SendReportEmailRequest;

    if (!recipients?.length || !overview || !responses || !questions || !kpiRows) {
      log('warn', 'body_invalid', 'Missing required fields');
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const validRecipients = recipients.filter(e => typeof e === 'string' && e.includes('@'));
    if (validRecipients.length === 0) {
      log('warn', 'recipients_invalid', { provided: recipients });
      return res.status(400).json({ error: 'No valid recipient email addresses provided.' });
    }

    log('info', 'body_ok', {
      recipients: validRecipients.length,
      responses:  responses.length,
      questions:  questions.length,
    });

    // ── 4. Build Excel ────────────────────────────────────────────────────────
    log('info', 'excel_build_start');
    let excelBuffer: Buffer;
    try {
      excelBuffer = buildExcel({ recipients, overview, responses, questions, kpiRows });
      log('info', 'excel_build_ok', { bytes: excelBuffer.length });
    } catch (xlsxErr: any) {
      log('error', 'excel_build_failed', { error: xlsxErr.message });
      return res.status(500).json({ error: 'Failed to generate Excel: ' + xlsxErr.message });
    }

    const filename = `${overview.quarterLabel.replace(/\s+/g, '_')}_Report.xlsx`;
    const html     = generateReportEmail({
      quarterLabel:     overview.quarterLabel,
      outcome:          overview.outcome,
      overallPct:       overview.overallPct,
      totalRespondents: overview.totalRespondents,
      totalAssigned:    overview.totalAssigned,
      sections:         overview.sections,
    });
    const subject = `📊 ${overview.quarterLabel} Feedback Report — ${overview.outcome}`;

    // ── 5. Create transporter — NO verify() call ──────────────────────────────
    // verify() was the root cause of the 3-minute hang.
    // sendMail() will throw with a clear error if credentials are wrong.
    const transporter = createTransporter();
    log('info', 'transporter_ready', { user: process.env.EMAIL_USER });

    // ── 6. Send to each recipient ─────────────────────────────────────────────
    const results: EmailResult[] = [];

    for (const email of validRecipients) {
      log('info', 'send_start', { to: email });
      try {
        const messageId = await sendOneEmail({
          transporter, to: email, subject, html, filename, excelBuffer,
        });
        log('info', 'send_ok', { to: email, messageId });
        results.push({ email, success: true });
      } catch (sendErr: any) {
        log('error', 'send_failed', { to: email, error: sendErr.message });
        results.push({ email, success: false, error: sendErr.message });
      }
    }

    // ── 7. Return result ──────────────────────────────────────────────────────
    const succeeded  = results.filter(r => r.success).length;
    const durationMs = Date.now() - startMs;

    log('info', 'handler_complete', { sent: succeeded, total: validRecipients.length, durationMs });

    // 200 = all sent  |  207 = partial  |  500 = all failed
    const statusCode = succeeded === 0 ? 500 : succeeded < validRecipients.length ? 207 : 200;

    return res.status(statusCode).json({
      success:    succeeded > 0,
      results,
      sent:       succeeded,
      total:      validRecipients.length,
      durationMs,
    });

  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    log('error', 'handler_fatal', { error: err.message, stack: err.stack, durationMs });
    return res.status(500).json({ error: err.message || 'Failed to send report emails' });
  }
}