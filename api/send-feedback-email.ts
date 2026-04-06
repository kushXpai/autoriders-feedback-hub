// api/send-feedback-email.ts
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
// EMAIL TEMPLATE
// ─────────────────────────────────────────

function generateFeedbackInviteEmail(data: {
  customerName: string;
  quarterLabel: string;
  appUrl: string;
  email: string;
  phone: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feedback Form — ${data.quarterLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      padding: 36px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .header p {
      color: rgba(255,255,255,0.85);
      font-size: 14px;
      margin-top: 6px;
    }
    .body {
      padding: 36px 30px;
    }
    .greeting {
      font-size: 16px;
      color: #1e293b;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .intro {
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
      line-height: 1.7;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .info-card h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      font-size: 13px;
      color: #1e293b;
      font-weight: 600;
      text-align: right;
    }
    .info-value.mono {
      font-family: 'Courier New', Courier, monospace;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .cta-section {
      text-align: center;
      margin: 28px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #ffffff !important;
      padding: 14px 36px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
      letter-spacing: 0.2px;
    }
    .note {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
    }
    .note p {
      font-size: 13px;
      color: #78350f;
      margin: 0;
    }
    .url-fallback {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      margin-top: 16px;
    }
    .url-fallback a {
      color: #d97706;
      word-break: break-all;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
      margin: 24px 0;
    }
    .footer {
      background: #f8fafc;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer .brand {
      font-size: 13px;
      font-weight: 600;
      color: #d97706;
      margin-bottom: 6px;
    }
    .footer p {
      font-size: 12px;
      color: #94a3b8;
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <div class="container">

    <div class="header">
      <h1>📋 ${data.quarterLabel} Feedback Form</h1>
      <p>Your feedback helps us serve you better</p>
    </div>

    <div class="body">
      <p class="greeting">Dear ${data.customerName},</p>
      <p class="intro">
        We hope you are doing well. As part of our commitment to continuous improvement,
        we kindly request you to take a few minutes to fill in your feedback form for
        <strong>${data.quarterLabel}</strong>. Your responses are valuable and help us
        enhance the quality of our service.
      </p>

      <div class="info-card">
        <h3>Your Login Credentials</h3>
        <div class="info-row">
          <span class="info-label">Login URL</span>
          <span class="info-value"><a href="${data.appUrl}" style="color: #d97706;">${data.appUrl}</a></span>
        </div>
        <div class="info-row">
          <span class="info-label">Username&nbsp;(Email)</span>
          <span class="info-value mono">${data.email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Password</span>
          <span class="info-value mono">${data.phone || 'Your mobile number'}</span>
        </div>
      </div>

      <div class="note">
        <p>
          🔒 <strong>Note:</strong> Your password is your registered mobile number.
          Please keep your credentials confidential and do not share them with anyone.
        </p>
      </div>

      <div class="cta-section">
        <a href="${data.appUrl}" class="cta-button">
          Fill Feedback Form →
        </a>
      </div>

      <p class="url-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br />
        <a href="${data.appUrl}">${data.appUrl}</a>
      </p>

      <div class="divider"></div>

      <p style="font-size: 13px; color: #64748b; text-align: center;">
        Please fill in the form at the earliest. If you have already submitted your feedback,
        kindly disregard this email. Thank you for your time.
      </p>
    </div>

    <div class="footer">
      <p class="brand">Car Rental Feedback System</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} All rights reserved.</p>
    </div>

  </div>
</body>
</html>
  `;
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
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reminder: ${data.quarterLabel} Feedback Form</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      padding: 36px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .header p {
      color: rgba(255,255,255,0.85);
      font-size: 14px;
      margin-top: 6px;
    }
    .body { padding: 36px 30px; }
    .greeting {
      font-size: 16px;
      color: #1e293b;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .intro {
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
      line-height: 1.7;
    }
    .highlight-box {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
      text-align: center;
    }
    .highlight-box p {
      font-size: 14px;
      color: #9a3412;
      margin: 0;
    }
    .highlight-box strong {
      font-size: 15px;
      display: block;
      margin-bottom: 4px;
      color: #7c2d12;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .info-card h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 13px; color: #64748b; font-weight: 500; }
    .info-value { font-size: 13px; color: #1e293b; font-weight: 600; text-align: right; }
    .info-value.mono {
      font-family: 'Courier New', Courier, monospace;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .cta-section { text-align: center; margin: 28px 0; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: #ffffff !important;
      padding: 14px 36px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);
      letter-spacing: 0.2px;
    }
    .note {
      background: #fff7ed;
      border-left: 3px solid #f97316;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
    }
    .note p { font-size: 13px; color: #7c2d12; margin: 0; }
    .url-fallback { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px; }
    .url-fallback a { color: #ea580c; word-break: break-all; }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
      margin: 24px 0;
    }
    .footer {
      background: #f8fafc;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer .brand { font-size: 13px; font-weight: 600; color: #ea580c; margin-bottom: 6px; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 3px 0; }
  </style>
</head>
<body>
  <div class="container">

    <div class="header">
      <h1>⏰ Reminder: ${data.quarterLabel} Feedback Form</h1>
      <p>A gentle nudge — we haven't heard from you yet</p>
    </div>

    <div class="body">
      <p class="greeting">Dear ${data.customerName},</p>
      <p class="intro">
        We noticed that your feedback form for <strong>${data.quarterLabel}</strong> is still
        pending. We completely understand that things get busy, so we wanted to send you a
        friendly reminder. Your response is very important to us and takes only a few minutes
        to complete.
      </p>

      <div class="highlight-box">
        <strong>⏳ Your feedback is still awaited</strong>
        <p>Filling in this form helps us improve our service quality directly for you.</p>
      </div>

      <div class="info-card">
        <h3>Your Login Credentials</h3>
        <div class="info-row">
          <span class="info-label">Login URL</span>
          <span class="info-value"><a href="${data.appUrl}" style="color: #ea580c;">${data.appUrl}</a></span>
        </div>
        <div class="info-row">
          <span class="info-label">Username&nbsp;(Email)</span>
          <span class="info-value mono">${data.email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Password</span>
          <span class="info-value mono">${data.phone || 'Your mobile number'}</span>
        </div>
      </div>

      <div class="cta-section">
        <a href="${data.appUrl}" class="cta-button">
          Fill Feedback Form Now →
        </a>
      </div>

      <p class="url-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br />
        <a href="${data.appUrl}">${data.appUrl}</a>
      </p>

      <div class="divider"></div>

      <div class="note">
        <p>
          ⚠️ <strong>Already submitted?</strong> If you have already filled in your feedback,
          please disregard this reminder. We apologise for any inconvenience.
          Thank you for your time and continued trust in us.
        </p>
      </div>
    </div>

    <div class="footer">
      <p class="brand">Car Rental Feedback System</p>
      <p>This is an automated reminder. Please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} All rights reserved.</p>
    </div>

  </div>
</body>
</html>
  `;
}

// ─────────────────────────────────────────
// REMINDER HANDLER  (POST /api/send-reminder-email)
// ─────────────────────────────────────────

export async function reminderHandler(req: VercelRequest, res: VercelResponse) {
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
          subject: `⏰ Reminder: Please Fill Your ${quarterLabel} Feedback Form`,
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
    // ── Step A: Verify caller using service role (avoids proxy/network issues) ──
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

    // ── Step B: Validate env vars ─────────────────────────────────────────
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(500).json({ error: 'Email credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in Vercel env vars.' });
    }

    // ── Step C: Parse body ────────────────────────────────────────────────
    const { quarterLabel, appUrl, customers } = req.body as SendFeedbackEmailRequest;

    if (!quarterLabel || !appUrl || !customers?.length) {
      return res.status(400).json({ error: 'Missing required fields: quarterLabel, appUrl, customers' });
    }

    // ── Step D: Create Nodemailer transporter ─────────────────────────────
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // ── Step E: Send one email per customer ───────────────────────────────
    const results: EmailResult[] = [];

    for (const customer of customers) {
      if (!customer.email?.includes('@')) {
        results.push({ email: customer.email, success: false, error: 'Invalid email address' });
        continue;
      }

      try {
        const html = generateFeedbackInviteEmail({
          customerName: customer.name,
          quarterLabel,
          appUrl,
          email: customer.email,
          phone: customer.phone ?? '',
        });

        await transporter.sendMail({
          from: `Car Rental Feedback <${process.env.EMAIL_USER}>`,
          to: customer.email,
          subject: `📋 Action Required: Please Fill Your ${quarterLabel} Feedback Form`,
          html,
        });

        results.push({ email: customer.email, success: true });
      } catch (err: any) {
        console.error(`Email failed for ${customer.email}:`, err.message);
        results.push({ email: customer.email, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    console.log(`Emails sent: ${succeeded}/${customers.length}`);

    return res.status(200).json({ success: true, results, sent: succeeded, total: customers.length });

  } catch (err: any) {
    console.error('send-feedback-email fatal error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send emails' });
  }
}