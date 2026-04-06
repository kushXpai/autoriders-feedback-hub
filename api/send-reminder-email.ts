// api/send-reminder-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────
// REQUEST BODY
// ─────────────────────────────────────────

interface SendFeedbackEmailRequest {
  quarterLabel: string;
  appUrl: string;
  customers: {
    name: string;
    email: string;
    phone: string | null;
  }[];
}

interface EmailResult {
  email: string;
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────
// REMINDER EMAIL TEMPLATE
// ─────────────────────────────────────────

function generateReminderEmail(data: {
  customerName: string;
  quarterLabel: string;
  appUrl: string;
  email: string;
  phone: string;
}): string {
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reminder — ${data.quarterLabel} Feedback Form</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background-color: #f0f0f0;
      padding: 32px 16px;
      color: #1a1a1a;
      line-height: 1.7;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
    }
    .letterhead {
      background: #ffffff;
      border-top: 5px solid #1a1a2e;
      padding: 32px 48px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #d4d4d4;
    }
    .org-name {
      font-family: 'Arial', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .org-sub {
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      color: #666666;
      margin-top: 3px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .ref-block {
      text-align: right;
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      color: #666666;
      line-height: 1.8;
    }
    .ref-block strong {
      display: block;
      color: #1a1a2e;
      font-size: 12px;
    }
    .letter-body {
      background: #ffffff;
      padding: 40px 48px;
    }
    .date-line {
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      color: #444444;
      margin-bottom: 28px;
    }
    .subject-line {
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      margin-bottom: 28px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .subject-line span {
      font-weight: 700;
      text-decoration: underline;
    }
    .salutation {
      font-size: 15px;
      margin-bottom: 20px;
      color: #1a1a1a;
    }
    .para {
      font-size: 14px;
      color: #333333;
      margin-bottom: 18px;
      line-height: 1.8;
    }
    .para strong { color: #1a1a2e; }
    .credentials-section {
      margin: 28px 0;
      border: 1px solid #cccccc;
    }
    .credentials-header {
      background: #1a1a2e;
      padding: 10px 20px;
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .credentials-table {
      width: 100%;
      border-collapse: collapse;
    }
    .credentials-table td {
      padding: 11px 20px;
      font-size: 13px;
      border-bottom: 1px solid #e8e8e8;
      font-family: 'Arial', sans-serif;
    }
    .credentials-table tr:last-child td { border-bottom: none; }
    .credentials-table .label-col {
      color: #555555;
      font-weight: 600;
      width: 42%;
    }
    .credentials-table .value-col {
      color: #1a1a2e;
      font-weight: 600;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12.5px;
    }
    .credentials-table .link-col {
      color: #1a4f9f;
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      font-weight: 600;
    }
    .credentials-table .link-col a { color: #1a4f9f; text-decoration: none; }
    .cta-wrap { margin: 28px 0; }
    .cta-button {
      display: inline-block;
      background-color: #1a1a2e;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 13px 32px;
    }
    .notice {
      background: #f7f7f7;
      border-left: 3px solid #1a1a2e;
      padding: 12px 16px;
      margin: 24px 0;
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      color: #444444;
      line-height: 1.6;
    }
    .notice strong { color: #1a1a2e; }
    .closing { font-size: 14px; color: #333333; margin-bottom: 6px; }
    .signature-name {
      font-family: 'Arial', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #1a1a2e;
      margin-top: 20px;
    }
    .signature-title {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      color: #666666;
      margin-top: 2px;
    }
    .letter-footer {
      background: #1a1a2e;
      padding: 16px 48px;
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      color: #aaaacc;
      text-align: center;
      line-height: 1.8;
    }
    .letter-footer a { color: #aaaacc; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="letterhead">
      <div>
        <div class="org-name">AutoRiders</div>
        <div class="org-sub">Car Rental Services</div>
      </div>
      <div class="ref-block">
        <strong>OFFICIAL CORRESPONDENCE</strong>
        Ref: CRS/FB/${data.quarterLabel.replace(/\s/g, '')}/REM<br />
        Date: ${today}
      </div>
    </div>

    <div class="letter-body">

      <p class="date-line">${today}</p>

      <p class="subject-line">
        <span>Subject: Reminder — Pending Feedback Submission for ${data.quarterLabel}</span>
      </p>

      <p class="salutation">Dear ${data.customerName},</p>

      <p class="para">
        We refer to our earlier communication regarding the submission of your feedback form
        for the period <strong>${data.quarterLabel}</strong>. As per our records, your
        response is yet to be received.
      </p>

      <p class="para">
        We request you to kindly take a few minutes to complete and submit the feedback form
        at the earliest convenience. Your evaluation is an integral part of our service
        improvement process, and we value your assessment greatly.
      </p>

      <p class="para">
        For your reference, your login credentials to access the feedback portal are provided below:
      </p>

      <div class="credentials-section">
        <div class="credentials-header">Portal Access Credentials</div>
        <table class="credentials-table">
          <tr>
            <td class="label-col">Portal URL</td>
            <td class="link-col"><a href="${data.appUrl}">${data.appUrl}</a></td>
          </tr>
          <tr>
            <td class="label-col">Username (Email)</td>
            <td class="value-col">${data.email}</td>
          </tr>
          <tr>
            <td class="label-col">Password</td>
            <td class="value-col">${data.phone || 'Your registered mobile number'}</td>
          </tr>
        </table>
      </div>

      <div class="cta-wrap">
        <a href="${data.appUrl}" class="cta-button">Submit Feedback Now</a>
      </div>

      <p class="para" style="font-size:12px; color:#888888;">
        If the above button does not work, please copy and paste the following link
        into your web browser: <a href="${data.appUrl}" style="color:#1a4f9f;">${data.appUrl}</a>
      </p>

      <div class="notice">
        <strong>Note:</strong> Your password is your registered mobile number.
        Please keep your login credentials strictly confidential and do not share them
        with any third party. If you have already submitted your feedback, kindly
        disregard this communication.
      </div>

      <p class="para">
        We appreciate your continued patronage and look forward to receiving your valued
        feedback. Should you require any assistance, please do not hesitate to reach out
        to us.
      </p>

      <p class="closing">Yours sincerely,</p>
      <p class="signature-name">Customer Relations Team</p>
      <p class="signature-title">AutoRiders — Car Rental Services</p>

    </div>

    <div class="letter-footer">
      This is a system-generated official communication. Please do not reply to this email directly. &nbsp;|&nbsp;
      &copy; ${new Date().getFullYear()} AutoRiders. All rights reserved.
    </div>

  </div>
</body>
</html>
  `;
}

// ─────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'superadmin'].includes(roleData.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(500).json({ error: 'Email credentials not configured.' });
    }

    const { quarterLabel, appUrl, customers } = req.body as SendFeedbackEmailRequest;
    if (!quarterLabel || !appUrl || !customers?.length) {
      return res.status(400).json({ error: 'Missing required fields: quarterLabel, appUrl, customers' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    const results: EmailResult[] = [];

    for (const customer of customers) {
      if (!customer.email?.includes('@')) {
        results.push({ email: customer.email, success: false, error: 'Invalid email address' });
        continue;
      }

      try {
        const html = generateReminderEmail({
          customerName: customer.name,
          quarterLabel,
          appUrl,
          email: customer.email,
          phone: customer.phone ?? '',
        });

        await transporter.sendMail({
          from: `Car Rental Feedback <${process.env.EMAIL_USER}>`,
          to: customer.email,
          subject: `Reminder: Pending Feedback Submission — ${quarterLabel} | AutoRiders`,
          html,
        });

        results.push({ email: customer.email, success: true });
      } catch (err: any) {
        console.error(`Reminder email failed for ${customer.email}:`, err.message);
        results.push({ email: customer.email, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    console.log(`Reminder emails sent: ${succeeded}/${customers.length}`);

    return res.status(200).json({ success: true, results, sent: succeeded, total: customers.length });

  } catch (err: any) {
    console.error('send-reminder-email fatal error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send reminder emails' });
  }
}