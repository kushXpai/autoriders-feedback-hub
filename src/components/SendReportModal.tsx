// components/SendReportModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// FIXES APPLIED
// 1. Modal is now rendered via a React Portal into document.body — this
//    guarantees it escapes ANY parent stacking context (overflow:hidden,
//    transform, will-change, etc.) that was preventing position:fixed from
//    being viewport-relative.
// 2. Backdrop uses backdropFilter blur (unchanged) + pointer-events fix.
// 3. Timeout increased to 45s to give the API enough runway (the API itself
//    has a 20s per-email limit + auth overhead).
// 4. All success/error states, animations, and accessibility are preserved.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Mail, Plus, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

interface SendReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quarterLabel: string;
  onSend: (recipients: string[]) => Promise<void>;
}

type ModalState = 'idle' | 'sending' | 'success' | 'error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 45 s — covers auth (2–3 s) + Excel build (~1 s) + email send (up to 20 s)
// with headroom to spare before Vercel's 60 s function limit.
const SEND_TIMEOUT_MS = 45_000;

// ─────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────

export default function SendReportModal({
  isOpen,
  onClose,
  quarterLabel,
  onSend,
}: SendReportModalProps) {
  const [emails, setEmails] = useState<string[]>(['']);
  const [state, setState] = useState<ModalState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Track elapsed seconds while sending so the user sees "Sending… (5s)"
  const [elapsedSec, setElapsedSec] = useState(0);

  // Reset state every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setEmails(['']);
      setState('idle');
      setErrorMsg('');
      setElapsedSec(0);
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'sending') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, state, onClose]);

  // Elapsed-seconds ticker — helps users know it's still working
  useEffect(() => {
    if (state !== 'sending') { setElapsedSec(0); return; }
    const id = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const validEmails = emails.filter(e => EMAIL_REGEX.test(e.trim()));
  const validCount = validEmails.length;

  const updateEmail = (index: number, value: string) => {
    setEmails(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addRecipient = () => setEmails(prev => [...prev, '']);

  const removeRecipient = (index: number) => {
    setEmails(prev => prev.length === 1 ? [''] : prev.filter((_, i) => i !== index));
  };

  const handleSend = useCallback(async () => {
    if (validCount === 0 || state === 'sending') return;

    setState('sending');
    setErrorMsg('');

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Request timed out. The server may be busy — please try again in a moment.')),
        SEND_TIMEOUT_MS,
      ),
    );

    try {
      await Promise.race([onSend(validEmails), timeoutPromise]);
      setState('success');
    } catch (err: any) {
      console.error('[SendReportModal] send failed:', err);
      setState('error');
      setErrorMsg(
        err?.message?.includes('timed out')
          ? 'The request timed out. Check your network connection or try again.'
          : err?.message || 'An unexpected error occurred. Please try again.',
      );
    }
  }, [validCount, validEmails, state, onSend]);

  if (!isOpen) return null;

  // ── Portal target ──────────────────────────────────────────────────────────
  // Rendering into document.body means NO parent CSS can affect position:fixed.
  // This is the definitive fix for modals that appear "attached to the page".
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  const modal = (
    <>
      {/* ── Keyframe styles injected once ── */}
      <style>{`
        @keyframes crModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes crSpin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        .cr-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99998;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .cr-modal-center {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          pointer-events: none;
        }
        .cr-modal-box {
          pointer-events: auto;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.22);
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          animation: crModalIn 0.2s ease-out;
        }
      `}</style>

      {/* ── Blurred backdrop ── */}
      <div
        className="cr-modal-backdrop"
        onClick={state !== 'sending' ? onClose : undefined}
      />

      {/* ── Viewport-centred container ── */}
      <div className="cr-modal-center">
        <div
          className="cr-modal-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-report-title"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: '10px',
              background: '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Mail size={18} color="#475569" />
            </div>

            <div style={{ flex: 1 }}>
              <h2 id="send-report-title" style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                Send Report
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{quarterLabel}</p>
            </div>

            <button
              onClick={onClose}
              disabled={state === 'sending'}
              aria-label="Close"
              style={{
                border: 'none', background: 'transparent',
                cursor: state === 'sending' ? 'not-allowed' : 'pointer',
                padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center',
                color: '#94a3b8',
                opacity: state === 'sending' ? 0.4 : 1,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '20px 24px' }}>

            {/* SUCCESS */}
            {state === 'success' && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '16px 0 8px', gap: '12px', textAlign: 'center',
              }}>
                <CheckCircle size={44} color="#10b981" />
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>
                    Report Sent Successfully
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Sent to {validCount} recipient{validCount !== 1 ? 's' : ''}. Check your inbox.
                  </p>
                </div>
              </div>
            )}

            {/* ERROR */}
            {state === 'error' && (
              <div style={{
                display: 'flex', gap: '10px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
              }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '13px', color: '#b91c1c' }}>
                    Failed to send
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', lineHeight: 1.5 }}>
                    {errorMsg}
                  </p>
                </div>
              </div>
            )}

            {/* IDLE / SENDING / ERROR — show form */}
            {state !== 'success' && (
              <>
                <label style={{
                  display: 'block', fontSize: '12px', fontWeight: 600,
                  color: '#475569', marginBottom: '10px',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  Recipients{' '}
                  <span style={{
                    textTransform: 'none', fontWeight: 400,
                    color: validCount > 0 ? '#10b981' : '#94a3b8',
                  }}>
                    ({validCount} valid)
                  </span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {emails.map((email, index) => {
                    const isValid = EMAIL_REGEX.test(email.trim());
                    const hasContent = email.trim().length > 0;
                    return (
                      <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                          border: `1px solid ${hasContent && !isValid ? '#fca5a5' : '#e2e8f0'}`,
                          borderRadius: '8px', padding: '0 10px',
                          background: state === 'sending' ? '#f8fafc' : '#fff',
                          transition: 'border-color 0.15s',
                        }}>
                          <Mail size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                          <input
                            type="email"
                            value={email}
                            onChange={e => updateEmail(index, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addRecipient(); }}
                            placeholder="email@example.com"
                            disabled={state === 'sending'}
                            style={{
                              flex: 1, border: 'none', outline: 'none',
                              fontSize: '13px', color: '#0f172a',
                              background: 'transparent', padding: '9px 0',
                              cursor: state === 'sending' ? 'not-allowed' : 'text',
                            }}
                          />
                          {isValid && <CheckCircle size={14} color="#10b981" style={{ flexShrink: 0 }} />}
                        </div>

                        <button
                          onClick={() => removeRecipient(index)}
                          disabled={state === 'sending'}
                          aria-label="Remove recipient"
                          style={{
                            border: 'none', background: 'transparent',
                            cursor: state === 'sending' ? 'not-allowed' : 'pointer',
                            padding: '6px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center',
                            color: '#cbd5e1',
                            opacity: state === 'sending' ? 0.4 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addRecipient}
                  disabled={state === 'sending'}
                  style={{
                    marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '12px',
                    color: state === 'sending' ? '#cbd5e1' : '#6366f1',
                    background: 'transparent', border: 'none',
                    cursor: state === 'sending' ? 'not-allowed' : 'pointer',
                    padding: '4px 2px', fontWeight: 500,
                  }}
                >
                  <Plus size={13} />
                  Add another recipient
                </button>

                {/* What's Included */}
                <div style={{
                  marginTop: '16px', background: '#f8fafc',
                  border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px',
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    What's Included
                  </p>
                  {[
                    'Excel file attached (3 sheets)',
                    'Sheet 1: Report overview & KPIs',
                    'Sheet 2: Individual responses table',
                    'Sheet 3: Full detailed breakdown',
                  ].map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>•</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '8px',
            padding: '12px 24px 20px',
            borderTop: state !== 'success' ? '1px solid #f1f5f9' : 'none',
          }}>
            {state === 'success' ? (
              <button
                onClick={onClose}
                style={{
                  padding: '9px 20px', borderRadius: '8px', border: 'none',
                  background: '#10b981', color: '#fff',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={state === 'sending'}
                  style={{
                    padding: '9px 16px', borderRadius: '8px',
                    border: '1px solid #e2e8f0', background: '#fff',
                    color: '#475569', fontSize: '13px', fontWeight: 500,
                    cursor: state === 'sending' ? 'not-allowed' : 'pointer',
                    opacity: state === 'sending' ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleSend}
                  disabled={validCount === 0 || state === 'sending'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 18px', borderRadius: '8px', border: 'none',
                    background: validCount === 0 ? '#cbd5e1' : '#6366f1',
                    color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: validCount === 0 || state === 'sending' ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    minWidth: 130,
                    justifyContent: 'center',
                  }}
                >
                  {state === 'sending' ? (
                    <>
                      <Loader2
                        size={14}
                        style={{ animation: 'crSpin 0.8s linear infinite', flexShrink: 0 }}
                      />
                      Sending{elapsedSec > 0 ? ` (${elapsedSec}s)` : '…'}
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Send Report
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, portalTarget);
}