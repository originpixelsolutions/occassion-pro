/**
 * OccasionPro Email Templates
 * All templates use inline CSS for maximum email client compatibility.
 * Designed for dark-friendly email clients but renders well in light mode.
 */

const BASE_URL = process.env.WEB_URL ?? 'https://app.occasionpro.in'

function base(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OccasionPro</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;‌&nbsp;‌&nbsp;‌</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;padding:10px 14px;">
                    <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.5px;">OccasionPro</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card body -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
                © ${new Date().getFullYear()} OccasionPro. All rights reserved.<br />
                <a href="${BASE_URL}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${BASE_URL}/privacy" style="color:#9ca3af;">Privacy Policy</a>
                &nbsp;·&nbsp;
                <a href="${BASE_URL}/data-request" style="color:#9ca3af;">Your Data Rights</a>
              </p>
              <p style="margin:6px 0 0 0;color:#d1d5db;font-size:10px;line-height:1.5;">
                You may request access, correction, erasure, or portability of your personal data at any time
                under the Digital Personal Data Protection Act 2023.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string, color = '#7c3aed'): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background-color:${color};">
        <a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.3px;">${text}</a>
      </td>
    </tr>
  </table>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${text}</h1>`
}

function para(text: string): string {
  return `<p style="margin:12px 0;color:#374151;font-size:14px;line-height:1.7;">${text}</p>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />`
}

function note(text: string): string {
  return `<p style="margin:16px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">${text}</p>`
}

// ─── Template functions ───────────────────────────────────────────────────────

export class EmailTemplates {

  static welcome(params: {
    name: string
    workspaceName: string
    tenantSlug: string
  }): { subject: string; html: string; text: string } {
    const dashboardUrl = `${BASE_URL}/${params.tenantSlug}/dashboard`
    const html = base(`
      ${heading(`Welcome to OccasionPro, ${params.name}! 🎉`)}
      ${para(`Your workspace <strong>${params.workspaceName}</strong> has been created and is ready to go. You have a 14-day Growth trial activated — no credit card required.`)}
      ${btn('Open Your Dashboard', dashboardUrl)}
      ${divider()}
      ${para('Here\'s what you can do right away:')}
      <ul style="color:#374151;font-size:14px;line-height:2;padding-left:20px;margin:8px 0;">
        <li>Create your first event</li>
        <li>Invite your team members</li>
        <li>Add vendors and guests</li>
        <li>Design animated invitations</li>
      </ul>
      ${note(`If you didn't create this account, you can safely ignore this email.`)}
    `, `Welcome to OccasionPro! Your workspace ${params.workspaceName} is ready.`)

    return {
      subject: `Welcome to OccasionPro — ${params.workspaceName} is ready`,
      html,
      text: `Welcome to OccasionPro, ${params.name}!\n\nYour workspace "${params.workspaceName}" has been created.\nVisit: ${dashboardUrl}`,
    }
  }

  static teamInvitation(params: {
    inviterName: string
    workspaceName: string
    role: string
    inviteUrl: string
    expiresInHours?: number
  }): { subject: string; html: string; text: string } {
    const html = base(`
      ${heading(`You've been invited to join ${params.workspaceName}`)}
      ${para(`<strong>${params.inviterName}</strong> has invited you to collaborate on <strong>${params.workspaceName}</strong> as a <strong>${params.role}</strong>.`)}
      ${btn('Accept Invitation', params.inviteUrl)}
      ${divider()}
      ${para('OccasionPro is an enterprise event management platform for weddings, corporate events, concerts, and more.')}
      ${note(`This invitation link expires in ${params.expiresInHours ?? 72} hours. If you weren't expecting this, ignore this email.`)}
    `, `${params.inviterName} invited you to ${params.workspaceName} on OccasionPro`)

    return {
      subject: `${params.inviterName} invited you to ${params.workspaceName}`,
      html,
      text: `${params.inviterName} invited you to join ${params.workspaceName} as ${params.role}.\nAccept: ${params.inviteUrl}`,
    }
  }

  static clientPortalMagicLink(params: {
    clientName: string
    eventName: string
    magicLinkUrl: string
    expiresInMinutes?: number
  }): { subject: string; html: string; text: string } {
    const html = base(`
      ${heading(`Your secure access link for ${params.eventName}`)}
      ${para(`Hello ${params.clientName},`)}
      ${para(`Click the button below to access your client portal for <strong>${params.eventName}</strong>. No password required.`)}
      ${btn('Access Client Portal', params.magicLinkUrl, '#059669')}
      ${divider()}
      ${note(`This link expires in ${params.expiresInMinutes ?? 15} minutes. Do not share it with others — it's tied to your identity.`)}
    `, `Access your ${params.eventName} client portal`)

    return {
      subject: `Your access link for ${params.eventName}`,
      html,
      text: `Hello ${params.clientName},\n\nAccess your client portal:\n${params.magicLinkUrl}\n\nExpires in ${params.expiresInMinutes ?? 15} minutes.`,
    }
  }

  static vendorRegistrationInvite(params: {
    vendorName: string
    workspaceName: string
    eventName: string
    registerUrl: string
  }): { subject: string; html: string; text: string } {
    const html = base(`
      ${heading(`You've been added as a vendor for ${params.eventName}`)}
      ${para(`<strong>${params.workspaceName}</strong> has added you as a vendor for <strong>${params.eventName}</strong> on OccasionPro.`)}
      ${para(`Create your vendor account to view your deliverables, submit invoices, and communicate with the event team.`)}
      ${btn('Create Vendor Account', params.registerUrl, '#0891b2')}
      ${divider()}
      ${note(`If you have questions about this event, contact ${params.workspaceName} directly.`)}
    `, `You're a vendor for ${params.eventName}`)

    return {
      subject: `You've been added as a vendor — ${params.eventName}`,
      html,
      text: `Hello ${params.vendorName},\n\n${params.workspaceName} has added you as a vendor for ${params.eventName}.\nCreate your account: ${params.registerUrl}`,
    }
  }

  static trialWarning(params: {
    name: string
    workspaceName: string
    daysLeft: number
    upgradeUrl: string
    currentPlan: string
  }): { subject: string; html: string; text: string } {
    const urgency = params.daysLeft === 1 ? '⚠️ Last day!' : `⏰ ${params.daysLeft} days left`
    const html = base(`
      ${heading(`${urgency} Your trial ends soon`)}
      ${para(`Hello ${params.name},`)}
      ${para(`Your <strong>${params.currentPlan}</strong> trial for <strong>${params.workspaceName}</strong> expires in <strong>${params.daysLeft} day${params.daysLeft !== 1 ? 's' : ''}</strong>.`)}
      ${para(`Upgrade now to keep all your data, events, and team access. Your workspace will move to the free tier if you don\'t upgrade.`)}
      ${btn('Upgrade Now', params.upgradeUrl, params.daysLeft === 1 ? '#dc2626' : '#7c3aed')}
      ${divider()}
      ${note('Questions? Reply to this email or contact support@occasionpro.in')}
    `, `Your OccasionPro trial ends in ${params.daysLeft} day${params.daysLeft !== 1 ? 's' : ''}`)

    return {
      subject: `${urgency} Your OccasionPro trial ends in ${params.daysLeft} day${params.daysLeft !== 1 ? 's' : ''}`,
      html,
      text: `Hello ${params.name},\n\nYour ${params.currentPlan} trial ends in ${params.daysLeft} days.\nUpgrade: ${params.upgradeUrl}`,
    }
  }

  static trialExpired(params: {
    name: string
    workspaceName: string
    upgradeUrl: string
  }): { subject: string; html: string; text: string } {
    const html = base(`
      ${heading('Your trial has ended')}
      ${para(`Hello ${params.name},`)}
      ${para(`Your Growth trial for <strong>${params.workspaceName}</strong> has expired. Your workspace has been moved to the <strong>Starter (free)</strong> tier.`)}
      <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">Features now restricted:</p>
        <ul style="color:#7f1d1d;font-size:13px;margin:8px 0;padding-left:18px;">
          <li>Events limited to 2</li>
          <li>Advanced AI features disabled</li>
          <li>Animated invitations disabled</li>
          <li>Client portal limited</li>
        </ul>
      </div>
      ${btn('Upgrade to Restore Access', params.upgradeUrl, '#dc2626')}
      ${note('Your data is safe. Upgrading will immediately restore all features.')}
    `, 'Your OccasionPro trial has ended')

    return {
      subject: `Your OccasionPro trial has ended — upgrade to restore access`,
      html,
      text: `Hello ${params.name},\n\nYour trial has expired. Upgrade to restore full access.\n${params.upgradeUrl}`,
    }
  }

  static supportTicketReply(params: {
    userName: string
    ticketId: string
    ticketSubject: string
    replyText: string
    ticketUrl: string
  }): { subject: string; html: string; text: string } {
    const html = base(`
      ${heading('New reply to your support ticket')}
      ${para(`Hello ${params.userName},`)}
      ${para(`There's a new reply to your ticket <strong>#${params.ticketId}: ${params.ticketSubject}</strong>`)}
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${params.replyText}</p>
      </div>
      ${btn('View Full Conversation', params.ticketUrl, '#6366f1')}
      ${note('Reply to this email or click the button above to respond.')}
    `, `Reply on ticket #${params.ticketId}`)

    return {
      subject: `[OccasionPro Support] Reply on #${params.ticketId}: ${params.ticketSubject}`,
      html,
      text: `Hello ${params.userName},\n\nNew reply on ticket #${params.ticketId}:\n\n${params.replyText}\n\nView: ${params.ticketUrl}`,
    }
  }

  static passwordReset(params: {
    name: string
    resetUrl: string
    expiresInMinutes?: number
  }): { subject: string; html: string; text: string } {
    const html = base(`
      ${heading('Reset your password')}
      ${para(`Hello ${params.name},`)}
      ${para(`We received a request to reset your OccasionPro password. Click below to create a new password.`)}
      ${btn('Reset Password', params.resetUrl, '#374151')}
      ${divider()}
      ${note(`This link expires in ${params.expiresInMinutes ?? 30} minutes. If you didn't request a reset, ignore this email — your password won't change.`)}
    `, 'Reset your OccasionPro password')

    return {
      subject: `Reset your OccasionPro password`,
      html,
      text: `Hello ${params.name},\n\nReset your password:\n${params.resetUrl}\n\nExpires in ${params.expiresInMinutes ?? 30} minutes.`,
    }
  }

  static invoiceReceipt(params: {
    clientName: string
    invoiceNumber: string
    eventName: string
    amount: number
    currency: string
    paidAt: string
    receiptUrl: string
  }): { subject: string; html: string; text: string } {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: params.currency,
    }).format(params.amount)

    const html = base(`
      ${heading('Payment received ✅')}
      ${para(`Hello ${params.clientName},`)}
      ${para(`We've received your payment for <strong>${params.eventName}</strong>.`)}
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;margin:16px 0;">
        <tr>
          <td style="padding:16px;">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              ${[
                ['Invoice', `#${params.invoiceNumber}`],
                ['Event', params.eventName],
                ['Amount', `<strong>${formatted}</strong>`],
                ['Date', params.paidAt],
              ].map(([k, v]) => `
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;">${k}</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;">${v}</td>
                </tr>`).join('')}
            </table>
          </td>
        </tr>
      </table>
      ${btn('Download Receipt', params.receiptUrl, '#059669')}
    `, `Payment received for invoice #${params.invoiceNumber}`)

    return {
      subject: `Payment received — Invoice #${params.invoiceNumber}`,
      html,
      text: `Hello ${params.clientName},\n\nPayment received for ${params.eventName}.\nAmount: ${formatted}\nInvoice: #${params.invoiceNumber}\nReceipt: ${params.receiptUrl}`,
    }
  }
}
