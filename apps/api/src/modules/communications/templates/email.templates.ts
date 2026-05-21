/**
 * OccasionPro — Email Templates
 *
 * All templates return { subject, html, text } ready to pass to EmailService.send().
 * HTML uses inline styles for maximum email-client compatibility.
 *
 * Usage:
 *   import { EmailTemplates } from './templates/email.templates'
 *   await emailService.send(EmailTemplates.welcome({ name, workspaceName }), user.email)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout helpers
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_COLOR   = '#7c3aed'   // violet-700
const BRAND_LIGHT   = '#f3f0ff'   // very light violet
const BG_COLOR      = '#f8f7fc'   // near-white with slight violet
const CARD_BG       = '#ffffff'
const TEXT_DARK     = '#111118'
const TEXT_MID      = '#4b5563'
const TEXT_LIGHT    = '#9ca3af'
const BORDER_COLOR  = '#e5e2f0'
const SUCCESS_COLOR = '#16a34a'
const WARNING_COLOR = '#d97706'
const DANGER_COLOR  = '#dc2626'
const FONT_STACK    = "'Inter', 'Helvetica Neue', Arial, sans-serif"

function logo(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
      <tr>
        <td style="background:${BRAND_COLOR};width:40px;height:40px;border-radius:10px;text-align:center;vertical-align:middle;">
          <span style="color:#fff;font-size:20px;font-weight:700;line-height:40px;">⚡</span>
        </td>
        <td style="padding-left:10px;vertical-align:middle;">
          <span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${TEXT_DARK};letter-spacing:-0.3px;">OccasionPro</span>
        </td>
      </tr>
    </table>`
}

function footer(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:40px;border-top:1px solid ${BORDER_COLOR};padding-top:24px;">
      <tr>
        <td style="text-align:center;">
          <p style="font-family:${FONT_STACK};font-size:12px;color:${TEXT_LIGHT};margin:0 0 8px;">
            OccasionPro — AI-powered enterprise event operating system
          </p>
          <p style="font-family:${FONT_STACK};font-size:12px;color:${TEXT_LIGHT};margin:0;">
            © ${new Date().getFullYear()} OccasionPro. All rights reserved. ·
            <a href="https://app.occasionpro.in/settings" style="color:${TEXT_LIGHT};text-decoration:underline;">Manage notifications</a>
          </p>
        </td>
      </tr>
    </table>`
}

function ctaButton(text: string, url: string, color = BRAND_COLOR): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="background:${color};border-radius:10px;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${text}</a>
        </td>
      </tr>
    </table>`
}

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <style>
    @media (prefers-color-scheme: dark) {
      body { background-color: #0f0f13 !important; }
      .card { background-color: #1a1a24 !important; border-color: #2d2d42 !important; }
      .text-dark { color: #f1f0f6 !important; }
      .text-mid { color: #a0a0b8 !important; }
    }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; padding:0 16px !important; }
      .card { padding:24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:${FONT_STACK};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_COLOR};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
          <tr>
            <td>
              <div class="card" style="background:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
                ${logo()}
                ${content}
                ${footer()}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function h1(text: string): string {
  return `<h1 class="text-dark" style="font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${TEXT_DARK};margin:0 0 8px;line-height:1.3;">${text}</h1>`
}

function p(text: string, color = TEXT_MID): string {
  return `<p class="text-mid" style="font-family:${FONT_STACK};font-size:15px;color:${color};margin:0 0 16px;line-height:1.6;">${text}</p>`
}

function infoBox(content: string, accent = BRAND_LIGHT): string {
  return `
    <div style="background:${accent};border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="font-family:${FONT_STACK};font-size:14px;color:${TEXT_DARK};margin:0;line-height:1.6;">${content}</p>
    </div>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER_COLOR};margin:24px 0;">`
}

// ─────────────────────────────────────────────────────────────────────────────
// Template definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface WelcomeParams {
  name: string
  workspaceName: string
  workspaceUrl: string
  plan: string
  trialDays?: number
}

export interface PasswordResetParams {
  name: string
  resetUrl: string
  expiresInMinutes?: number
}

export interface VerifyEmailParams {
  name: string
  verifyUrl: string
}

export interface TrialWelcomeParams {
  name: string
  workspaceName: string
  dashboardUrl: string
  trialDays: number
  planName: string
}

export interface TrialExpiringSoonParams {
  name: string
  workspaceName: string
  daysLeft: number
  upgradeUrl: string
  planName: string
}

export interface TrialExpiredParams {
  name: string
  workspaceName: string
  upgradeUrl: string
  planName: string
}

export interface RsvpConfirmationParams {
  guestName: string
  eventName: string
  eventDate: string          // formatted string e.g. "Saturday, 14 June 2025"
  eventTime: string          // e.g. "6:30 PM IST"
  venueName: string
  venueAddress: string
  rsvpStatus: 'confirmed' | 'declined' | 'maybe'
  invitationUrl?: string
  qrCodeUrl?: string         // URL to QR code image
  dietaryNote?: string
}

export interface EventReminderParams {
  guestName: string
  eventName: string
  eventDate: string
  eventTime: string
  venueName: string
  venueAddress: string
  invitationUrl?: string
  daysUntilEvent: number
}

export interface InvoiceDeliveryParams {
  clientName: string
  invoiceNumber: string
  invoiceUrl: string
  eventName: string
  amount: string              // formatted: "₹1,25,000"
  dueDate: string
  paymentUrl?: string
  companyName: string
}

export interface PaymentReceiptParams {
  clientName: string
  invoiceNumber: string
  amount: string
  paymentDate: string
  paymentMethod: string
  receiptUrl?: string
  eventName: string
  companyName: string
}

export interface GuestThankYouParams {
  guestName: string
  eventName: string
  surveyUrl?: string
  photoAlbumUrl?: string
  message?: string
  companyName: string
}

export interface TeamInviteParams {
  inviteeName: string
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  expiresInHours?: number
}

export interface VendorInviteParams {
  vendorName: string
  eventName: string
  companyName: string
  inviteUrl: string
  message?: string
}

// ─────────────────────────────────────────────────────────────────────────────

export const EmailTemplates = {

  // ── Auth ──────────────────────────────────────────────────────────────────

  welcome({ name, workspaceName, workspaceUrl, plan, trialDays = 14 }: WelcomeParams) {
    const subject = `Welcome to OccasionPro, ${name}! 🎉`
    const html = wrap(`
      ${h1(`Welcome, ${name}! 🎉`)}
      ${p(`Your workspace <strong>${workspaceName}</strong> is ready. You're now on the <strong>${plan}</strong> plan${trialDays ? ` with a ${trialDays}-day free trial` : ''}.`)}
      ${p('Here\'s what you can do right away:')}
      <ul style="font-family:${FONT_STACK};font-size:14px;color:${TEXT_MID};padding-left:20px;margin:0 0 16px;line-height:2;">
        <li>Create your first event</li>
        <li>Invite your team members</li>
        <li>Set up your client portal</li>
        <li>Configure payment gateway</li>
      </ul>
      ${ctaButton('Open Your Dashboard', workspaceUrl)}
      ${infoBox(`<strong>Workspace URL:</strong> <a href="${workspaceUrl}" style="color:${BRAND_COLOR};text-decoration:none;">${workspaceUrl}</a>`)}
      ${p('Need help? Reply to this email or visit our help centre.', TEXT_LIGHT)}
    `)
    const text = `Welcome to OccasionPro, ${name}! Your workspace "${workspaceName}" is ready. Visit ${workspaceUrl} to get started.`
    return { subject, html, text }
  },

  verifyEmail({ name, verifyUrl }: VerifyEmailParams) {
    const subject = 'Verify your OccasionPro email address'
    const html = wrap(`
      ${h1('Verify your email')}
      ${p(`Hi ${name}, click the button below to verify your email address and activate your OccasionPro account.`)}
      ${ctaButton('Verify Email Address', verifyUrl)}
      ${p('This link expires in 24 hours. If you didn\'t create an account, you can safely ignore this email.', TEXT_LIGHT)}
      ${divider()}
      ${p(`Or copy this link: <a href="${verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${verifyUrl}</a>`, TEXT_LIGHT)}
    `)
    const text = `Hi ${name}, verify your OccasionPro email: ${verifyUrl} (expires in 24 hours)`
    return { subject, html, text }
  },

  passwordReset({ name, resetUrl, expiresInMinutes = 15 }: PasswordResetParams) {
    const subject = 'Reset your OccasionPro password'
    const html = wrap(`
      ${h1('Reset your password')}
      ${p(`Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.`)}
      ${ctaButton('Reset Password', resetUrl)}
      ${infoBox(`⏱️ This link expires in <strong>${expiresInMinutes} minutes</strong>.`)}
      ${p('If you didn\'t request a password reset, you can safely ignore this email. Your account remains secure.', TEXT_LIGHT)}
      ${divider()}
      ${p(`Or copy this link: <a href="${resetUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${resetUrl}</a>`, TEXT_LIGHT)}
    `)
    const text = `Hi ${name}, reset your OccasionPro password: ${resetUrl} (expires in ${expiresInMinutes} minutes)`
    return { subject, html, text }
  },

  // ── Subscription lifecycle ─────────────────────────────────────────────────

  trialWelcome({ name, workspaceName, dashboardUrl, trialDays, planName }: TrialWelcomeParams) {
    const subject = `Your ${trialDays}-day OccasionPro trial has started! 🚀`
    const html = wrap(`
      ${h1(`Your ${trialDays}-day trial has started! 🚀`)}
      ${p(`Hi ${name}, your <strong>${planName}</strong> trial for <strong>${workspaceName}</strong> is now active.`)}
      ${p('Everything is unlocked for the next 14 days. Here\'s what to explore:')}
      <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 24px;width:100%;">
        ${[
          ['⚡', 'AI Command Center', 'Smart insights, auto-suggestions, risk predictions'],
          ['📋', 'Event Management', 'Full lifecycle from enquiry to post-event wrap-up'],
          ['👥', 'Guest & RSVP', 'Digital invitations, RSVP tracking, check-in QR'],
          ['💰', 'Finance & Invoicing', 'GST-compliant invoices, payment tracking, P&L'],
          ['🗺️', 'Floor Plan Editor', 'Drag-drop seating, zone management, guest assignment'],
          ['📡', 'Real-time Runsheets', 'Live day-of coordination with your whole team'],
        ].map(([icon, title, desc]) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid ${BORDER_COLOR};">
              <span style="font-size:20px;margin-right:12px;vertical-align:middle;">${icon}</span>
              <span style="font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${TEXT_DARK};vertical-align:middle;">${title}</span>
              <span style="font-family:${FONT_STACK};font-size:13px;color:${TEXT_MID};display:block;padding-left:36px;margin-top:2px;">${desc}</span>
            </td>
          </tr>`).join('')}
      </table>
      ${ctaButton('Open Dashboard', dashboardUrl)}
      ${p('Questions? We\'re here to help — just reply to this email.', TEXT_LIGHT)}
    `)
    const text = `Hi ${name}, your ${trialDays}-day ${planName} trial for ${workspaceName} has started. Visit ${dashboardUrl} to explore all features.`
    return { subject, html, text }
  },

  trialExpiringSoon({ name, workspaceName, daysLeft, upgradeUrl, planName }: TrialExpiringSoonParams) {
    const subject = `Your OccasionPro trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
    const html = wrap(`
      ${h1(`Trial ending in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} ⏰`)}
      ${p(`Hi ${name}, your <strong>${planName}</strong> trial for <strong>${workspaceName}</strong> ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.`)}
      ${p('Upgrade now to keep all your events, data, and team members. Nothing will be deleted.')}
      ${ctaButton('Upgrade Now — Keep Everything', upgradeUrl, BRAND_COLOR)}
      ${infoBox('✨ Upgrading takes 2 minutes. No credit card data is stored — payments are processed securely via Razorpay.')}
      ${p('If you have questions about which plan is right for you, just reply to this email.', TEXT_LIGHT)}
    `)
    const text = `Hi ${name}, your OccasionPro trial for ${workspaceName} expires in ${daysLeft} days. Upgrade at ${upgradeUrl}`
    return { subject, html, text }
  },

  trialExpired({ name, workspaceName, upgradeUrl, planName }: TrialExpiredParams) {
    const subject = 'Your OccasionPro trial has ended'
    const html = wrap(`
      ${h1('Your trial has ended')}
      ${p(`Hi ${name}, your <strong>${planName}</strong> trial for <strong>${workspaceName}</strong> has expired.`)}
      ${p('Your workspace is now in <strong>read-only mode</strong>. All your data is safe — upgrade to restore full access.')}
      ${ctaButton('Restore Full Access', upgradeUrl, BRAND_COLOR)}
      ${infoBox('💾 <strong>Your data is safe.</strong> Events, guests, vendors, and all configurations are preserved. Upgrading instantly restores all functionality.')}
      ${divider()}
      ${p('Need a custom plan or have budget constraints? Reply to this email and we\'ll find a solution.', TEXT_LIGHT)}
    `)
    const text = `Hi ${name}, your OccasionPro trial for ${workspaceName} has expired. Upgrade at ${upgradeUrl} to restore access.`
    return { subject, html, text }
  },

  // ── Guest-facing ───────────────────────────────────────────────────────────

  rsvpConfirmation({
    guestName, eventName, eventDate, eventTime, venueName, venueAddress,
    rsvpStatus, invitationUrl, dietaryNote,
  }: RsvpConfirmationParams) {
    const statusConfig = {
      confirmed: { label: '✅ Confirmed', color: SUCCESS_COLOR, bg: '#f0fdf4' },
      declined:  { label: '❌ Declined',  color: DANGER_COLOR,  bg: '#fff1f2' },
      maybe:     { label: '🤔 Maybe',     color: WARNING_COLOR, bg: '#fffbeb' },
    }
    const status = statusConfig[rsvpStatus]
    const subject = rsvpStatus === 'confirmed'
      ? `RSVP Confirmed — ${eventName} 🎉`
      : rsvpStatus === 'declined'
      ? `RSVP Received — ${eventName}`
      : `RSVP Updated — ${eventName}`

    const html = wrap(`
      ${h1(`RSVP ${rsvpStatus === 'confirmed' ? 'Confirmed' : 'Received'}!`)}
      ${p(`Hi ${guestName}, your RSVP for <strong>${eventName}</strong> has been recorded.`)}
      <div style="background:${status.bg};border-radius:10px;padding:16px 20px;margin:16px 0;border-left:4px solid ${status.color};">
        <span style="font-family:${FONT_STACK};font-size:16px;font-weight:700;color:${status.color};">${status.label}</span>
      </div>
      ${rsvpStatus !== 'declined' ? `
        <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;width:100%;">
          ${[
            ['📅', 'Date', eventDate],
            ['🕐', 'Time', eventTime],
            ['📍', 'Venue', venueName],
            ['🗺️', 'Address', venueAddress],
            ...(dietaryNote ? [['🍽️', 'Dietary Note', dietaryNote]] : []),
          ].map(([icon, label, value]) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};width:140px;">
                <span style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${TEXT_MID};">${icon} ${label}</span>
              </td>
              <td style="padding:8px 0 8px 16px;border-bottom:1px solid ${BORDER_COLOR};">
                <span style="font-family:${FONT_STACK};font-size:13px;color:${TEXT_DARK};">${value}</span>
              </td>
            </tr>`).join('')}
        </table>
      ` : ''}
      ${invitationUrl ? ctaButton('View Invitation', invitationUrl) : ''}
      ${p('Add this event to your calendar and we look forward to seeing you! 🎊', TEXT_LIGHT)}
    `)
    const text = `Hi ${guestName}, your RSVP (${rsvpStatus}) for ${eventName} on ${eventDate} at ${eventTime} has been recorded. Venue: ${venueName}, ${venueAddress}`
    return { subject, html, text }
  },

  eventReminder({ guestName, eventName, eventDate, eventTime, venueName, venueAddress, invitationUrl, daysUntilEvent }: EventReminderParams) {
    const subject = daysUntilEvent === 0
      ? `Today is ${eventName}! 🎉`
      : daysUntilEvent === 1
      ? `${eventName} is tomorrow! 🎉`
      : `Reminder: ${eventName} is in ${daysUntilEvent} days`

    const html = wrap(`
      ${h1(daysUntilEvent === 0 ? 'Today\'s the day! 🎉' : daysUntilEvent === 1 ? 'See you tomorrow! 🎉' : `${daysUntilEvent} days to go!`)}
      ${p(`Hi ${guestName}, just a reminder that <strong>${eventName}</strong> is coming up ${daysUntilEvent === 0 ? 'today' : daysUntilEvent === 1 ? 'tomorrow' : `in ${daysUntilEvent} days`}!`)}
      <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;width:100%;">
        ${[
          ['📅', 'Date', eventDate],
          ['🕐', 'Time', eventTime],
          ['📍', 'Venue', venueName],
          ['🗺️', 'Address', venueAddress],
        ].map(([icon, label, value]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};width:120px;">
              <span style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${TEXT_MID};">${icon} ${label}</span>
            </td>
            <td style="padding:8px 0 8px 16px;border-bottom:1px solid ${BORDER_COLOR};">
              <span style="font-family:${FONT_STACK};font-size:13px;color:${TEXT_DARK};">${value}</span>
            </td>
          </tr>`).join('')}
      </table>
      ${invitationUrl ? ctaButton('View Details', invitationUrl) : ''}
      ${p('We look forward to celebrating with you! 🎊', TEXT_LIGHT)}
    `)
    const text = `Hi ${guestName}, reminder: ${eventName} is ${daysUntilEvent === 0 ? 'today' : daysUntilEvent === 1 ? 'tomorrow' : `in ${daysUntilEvent} days`}! ${eventDate} ${eventTime} at ${venueName}, ${venueAddress}`
    return { subject, html, text }
  },

  guestThankYou({ guestName, eventName, surveyUrl, photoAlbumUrl, message, companyName }: GuestThankYouParams) {
    const subject = `Thank you for being part of ${eventName} 🙏`
    const html = wrap(`
      ${h1(`Thank you, ${guestName}! 🙏`)}
      ${p(message ?? `We're so grateful you joined us for <strong>${eventName}</strong>. Your presence made the event truly special.`)}
      ${surveyUrl ? `
        ${divider()}
        ${p('We\'d love to hear from you! Your feedback helps us make every event even better.')}
        ${ctaButton('Share Your Feedback', surveyUrl)}
      ` : ''}
      ${photoAlbumUrl ? `
        ${divider()}
        ${p('The event photos are now available:')}
        ${ctaButton('View Photo Album', photoAlbumUrl)}
      ` : ''}
      ${divider()}
      ${p(`With gratitude,<br><strong>${companyName}</strong>`, TEXT_DARK)}
    `)
    const text = `Thank you for joining ${eventName}, ${guestName}!${surveyUrl ? ` Share your feedback: ${surveyUrl}` : ''}${photoAlbumUrl ? ` View photos: ${photoAlbumUrl}` : ''}`
    return { subject, html, text }
  },

  // ── Finance ────────────────────────────────────────────────────────────────

  invoiceDelivery({ clientName, invoiceNumber, invoiceUrl, eventName, amount, dueDate, paymentUrl, companyName }: InvoiceDeliveryParams) {
    const subject = `Invoice ${invoiceNumber} from ${companyName} — ${eventName}`
    const html = wrap(`
      ${h1(`Invoice ${invoiceNumber}`)}
      ${p(`Hi ${clientName}, please find your invoice for <strong>${eventName}</strong> attached below.`)}
      <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;width:100%;">
        ${[
          ['Invoice No.', invoiceNumber],
          ['Event', eventName],
          ['Amount', `<strong style="font-size:18px;color:${TEXT_DARK};">${amount}</strong>`],
          ['Due Date', dueDate],
        ].map(([label, value]) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid ${BORDER_COLOR};width:140px;">
              <span style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${TEXT_MID};">${label}</span>
            </td>
            <td style="padding:10px 0 10px 16px;border-bottom:1px solid ${BORDER_COLOR};">
              <span style="font-family:${FONT_STACK};font-size:13px;">${value}</span>
            </td>
          </tr>`).join('')}
      </table>
      ${paymentUrl ? ctaButton('Pay Now', paymentUrl, SUCCESS_COLOR) : ''}
      ${ctaButton('Download Invoice', invoiceUrl)}
      ${p('For any questions about this invoice, please reply to this email.', TEXT_LIGHT)}
      ${p(`Regards,<br><strong>${companyName}</strong>`, TEXT_DARK)}
    `)
    const text = `Invoice ${invoiceNumber} from ${companyName} for ${eventName}. Amount: ${amount}. Due: ${dueDate}. View at ${invoiceUrl}`
    return { subject, html, text }
  },

  paymentReceipt({ clientName, invoiceNumber, amount, paymentDate, paymentMethod, receiptUrl, eventName, companyName }: PaymentReceiptParams) {
    const subject = `Payment received — ${invoiceNumber} ✅`
    const html = wrap(`
      ${h1('Payment confirmed ✅')}
      ${p(`Hi ${clientName}, we've received your payment. Thank you!`)}
      <div style="background:${SUCCESS_COLOR}15;border-radius:10px;padding:20px;margin:20px 0;border-left:4px solid ${SUCCESS_COLOR};">
        <p style="font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${SUCCESS_COLOR};margin:0 0 4px;">${amount}</p>
        <p style="font-family:${FONT_STACK};font-size:13px;color:${TEXT_MID};margin:0;">Received on ${paymentDate} via ${paymentMethod}</p>
      </div>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;">
        ${[
          ['Invoice', invoiceNumber],
          ['Event', eventName],
          ['Payment Date', paymentDate],
          ['Payment Method', paymentMethod],
        ].map(([label, value]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};width:160px;">
              <span style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${TEXT_MID};">${label}</span>
            </td>
            <td style="padding:8px 0 8px 16px;border-bottom:1px solid ${BORDER_COLOR};">
              <span style="font-family:${FONT_STACK};font-size:13px;color:${TEXT_DARK};">${value}</span>
            </td>
          </tr>`).join('')}
      </table>
      ${receiptUrl ? ctaButton('Download Receipt', receiptUrl) : ''}
      ${p(`Regards,<br><strong>${companyName}</strong>`, TEXT_DARK)}
    `)
    const text = `Payment of ${amount} received for invoice ${invoiceNumber} (${eventName}) on ${paymentDate}. Thank you, ${clientName}!`
    return { subject, html, text }
  },

  // ── Team & Vendor ──────────────────────────────────────────────────────────

  teamInvite({ inviteeName, inviterName, workspaceName, role, inviteUrl, expiresInHours = 72 }: TeamInviteParams) {
    const subject = `You've been invited to join ${workspaceName} on OccasionPro`
    const html = wrap(`
      ${h1(`You're invited! 🎉`)}
      ${p(`<strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on OccasionPro as a <strong>${role}</strong>.`)}
      ${p('OccasionPro is an AI-powered event operating system used by professional event companies to manage events, guests, vendors, and teams — all in one place.')}
      ${ctaButton('Accept Invitation', inviteUrl)}
      ${infoBox(`⏱️ This invitation expires in <strong>${expiresInHours} hours</strong>.`)}
      ${p('If you weren\'t expecting this invitation or don\'t know who sent it, you can safely ignore this email.', TEXT_LIGHT)}
    `)
    const text = `Hi ${inviteeName}, ${inviterName} has invited you to join ${workspaceName} on OccasionPro as ${role}. Accept at ${inviteUrl} (expires in ${expiresInHours} hours)`
    return { subject, html, text }
  },

  vendorInvite({ vendorName, eventName, companyName, inviteUrl, message }: VendorInviteParams) {
    const subject = `Vendor invitation — ${eventName}`
    const html = wrap(`
      ${h1('Vendor invitation')}
      ${p(`Hi ${vendorName}, <strong>${companyName}</strong> has invited you to collaborate on <strong>${eventName}</strong> via OccasionPro.`)}
      ${message ? infoBox(message) : ''}
      ${p('Through the vendor portal, you can view your assignments, submit deliverables, track payments, and communicate with the event team.')}
      ${ctaButton('Access Vendor Portal', inviteUrl)}
      ${p('This link is unique to you. Please do not share it.', TEXT_LIGHT)}
    `)
    const text = `Hi ${vendorName}, ${companyName} has invited you to collaborate on ${eventName}. Access your vendor portal at ${inviteUrl}`
    return { subject, html, text }
  },

} as const
