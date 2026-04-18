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
    ['Outcome',                   overview.outcome],
    ['Total Respondents',         overview.totalRespondents],
    ['Total Assigned',            overview.totalAssigned],
    ['Response Rate (%)',         overview.totalAssigned > 0
      ? +((overview.totalRespondents / overview.totalAssigned) * 100).toFixed(1)
      : 0],
    ['New Expat Count',           overview.newExpatCount],
    ['Overall Satisfaction (%)',  +overview.overallPct.toFixed(1)],
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
  const qHeaders = sortedQuestions.map(q => `Q${q.number}`);
  const respHeader = ['Customer Name', 'New Expat?', ...qHeaders];
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
    ['Outcome',               overview.outcome],
    ['Overall Satisfaction',  `${overview.overallPct.toFixed(1)}%`],
    ['Respondents',           `${overview.totalRespondents} / ${overview.totalAssigned}`],
    ['New Expats',            overview.newExpatCount],
    [],
    ['KPI OUTCOMES'],
    ['Section', 'Score /4', 'Satisfaction %', 'Target %', 'Outcome'],
    ...kpiRows.map(k => [k.section, +k.avg.toFixed(2), +k.pct.toFixed(1), k.target, k.outcome]),
    [],
    ['SECTION BREAKDOWN'],
  ];

  for (const sKey of sectionOrder) {
    const sLabel = sectionLabels[sKey] ?? sKey;
    const sQuestions = questions.filter(q => q.section === sKey).sort((a, b) => a.number - b.number);
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
        <td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;color:${s.pct >= 80 ? '#10b981' : '#ef4444'};">${s.pct.toFixed(1)}%</td>
        <td style="padding:10px 16px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">${s.appliesTo}</td>
      </tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.quarterLabel} — Quarterly Report</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:40px 36px;text-align:center;">
      <p style="color:rgba(255,255,255,0.5);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">Quarterly Feedback Report</p>
      <h1 style="color:#fff;font-size:26px;font-weight:700;margin:0;">${data.quarterLabel}</h1>
      <div style="display:inline-block;margin-top:14px;background:${color}22;border:1px solid ${color}55;border-radius:20px;padding:5px 18px;">
        <span style="color:${color};font-size:13px;font-weight:700;">${data.outcome}</span>
      </div>
    </div>
    <div style="display:flex;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <div style="flex:1;padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;">Overall Score</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:${color};">${data.overallPct.toFixed(1)}%</p>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;">Responses</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:#1e293b;">${data.totalRespondents}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">of ${data.totalAssigned} assigned</p>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;">Target</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:#1e293b;">80%</p>
        <p style="margin:2px 0 0;font-size:11px;color:${data.overallPct >= 80 ? '#10b981' : '#ef4444'};">
          ${data.overallPct >= 80 ? '✓ Met' : '✗ Not Met'}
        </p>
      </div>
    </div>
    <div style="padding:32px 36px;">
      <p style="font-size:14px;color:#475569;margin:0 0 24px;">
        Please find attached the full quarterly feedback report for <strong>${data.quarterLabel}</strong>.
        The Excel workbook includes an Overview, individual response data, and the complete breakdown.
      </p>
      <p style="font-size:13px;font-weight:600;color:#1e293b;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.6px;">Section Breakdown</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Section</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Score</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Satisfaction</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Scope</th>
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
// HANDLER
// ─────────────────────────────────────────

// Vercel serverless functions default to a 10 s timeout on Hobby, 60 s on Pro.
// Set this in vercel.json: { "functions": { "api/send-report-email.ts": { "maxDuration": 60 } } }

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  log('info', 'request_received', { method: req.method });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      log('warn', 'auth_missing');
      return res.status(401).json({ error: 'No authorization header' });
    }

    log('info', 'auth_check_start');

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

    // ── Env check ─────────────────────────────────────────────────────────────
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      log('error', 'env_missing', 'EMAIL_USER or EMAIL_PASSWORD not set');
      return res.status(500).json({ error: 'Email credentials not configured on the server.' });
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
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
      responses: responses.length,
      questions: questions.length,
    });

    // ── Build Excel ────────────────────────────────────────────────────────────
    log('info', 'excel_build_start');
    let excelBuffer: Buffer;
    try {
      excelBuffer = buildExcel({ recipients, overview, responses, questions, kpiRows });
      log('info', 'excel_build_ok', { bytes: excelBuffer.length });
    } catch (xlsxErr: any) {
      log('error', 'excel_build_failed', { error: xlsxErr.message });
      return res.status(500).json({ error: 'Failed to generate Excel report: ' + xlsxErr.message });
    }

    const filename = `${overview.quarterLabel.replace(/\s+/g, '_')}_Report.xlsx`;

    // ── Mailer ─────────────────────────────────────────────────────────────────
    // FIX: Added explicit timeouts so the transporter never hangs indefinitely.
    // connectionTimeout: how long to wait for the TCP connection to establish.
    // greetingTimeout:   how long to wait for the SMTP greeting banner.
    // socketTimeout:     idle socket timeout — prevents a stalled connection from
    //                    blocking the serverless function until Vercel kills it.
    log('info', 'smtp_create_transporter');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10_000,  // 10 s to connect
      greetingTimeout:   8_000,   //  8 s for SMTP greeting
      socketTimeout:     15_000,  // 15 s idle socket limit
    });

    // Verify SMTP credentials before attempting to send (fast-fail)
    log('info', 'smtp_verify_start');
    try {
      await transporter.verify();
      log('info', 'smtp_verify_ok');
    } catch (verifyErr: any) {
      log('error', 'smtp_verify_failed', { error: verifyErr.message });
      return res.status(502).json({
        error: 'Cannot connect to the email server. Check EMAIL_USER / EMAIL_PASSWORD and ensure "Less secure app access" or an App Password is configured for the Gmail account.',
        detail: verifyErr.message,
      });
    }

    const html = generateReportEmail({
      quarterLabel:     overview.quarterLabel,
      outcome:          overview.outcome,
      overallPct:       overview.overallPct,
      totalRespondents: overview.totalRespondents,
      totalAssigned:    overview.totalAssigned,
      sections:         overview.sections,
    });

    // ── Send per recipient ─────────────────────────────────────────────────────
    const results: EmailResult[] = [];

    for (const email of validRecipients) {
      log('info', 'smtp_send_start', { to: email });
      try {
        const info = await transporter.sendMail({
          from:    `Car Rental Feedback <${process.env.EMAIL_USER}>`,
          to:      email,
          subject: `📊 ${overview.quarterLabel} Feedback Report — ${overview.outcome}`,
          html,
          attachments: [
            {
              filename,
              content:     excelBuffer,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });
        log('info', 'smtp_send_ok', { to: email, messageId: info.messageId });
        results.push({ email, success: true });
      } catch (sendErr: any) {
        log('error', 'smtp_send_failed', { to: email, error: sendErr.message });
        results.push({ email, success: false, error: sendErr.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const durationMs = Date.now() - startMs;

    log('info', 'handler_complete', {
      sent: succeeded,
      total: validRecipients.length,
      durationMs,
    });

    // Return 207 Multi-Status when some (but not all) emails failed, 200 when all succeeded.
    const statusCode = succeeded === 0 ? 500 : succeeded < validRecipients.length ? 207 : 200;

    return res.status(statusCode).json({
      success: succeeded > 0,
      results,
      sent:    succeeded,
      total:   validRecipients.length,
      durationMs,
    });

  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    log('error', 'handler_fatal', { error: err.message, stack: err.stack, durationMs });
    return res.status(500).json({ error: err.message || 'Failed to send report emails' });
  }
}