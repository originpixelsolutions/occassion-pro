/**
 * OccasionPro WhatsApp Message Templates
 * Used with both Baileys (free-form) and Meta Cloud API (template messages).
 */

export class WhatsAppTemplates {

  /** Invitation send */
  static invitation(params: {
    guestName: string
    eventName: string
    inviteLink: string
  }): string {
    return `🎉 *You're invited!*

Hello ${params.guestName},

You're cordially invited to *${params.eventName}*.

View your personalised invitation here:
${params.inviteLink}

We look forward to celebrating with you! 🥂`
  }

  /** RSVP reminder */
  static rsvpReminder(params: {
    guestName: string
    eventName: string
    rsvpDeadline: string
    rsvpLink: string
  }): string {
    return `⏰ *RSVP Reminder*

Hi ${params.guestName},

Please confirm your attendance for *${params.eventName}*.

📅 RSVP deadline: ${params.rsvpDeadline}

Click here to respond:
${params.rsvpLink}

Your response helps us plan better. Thank you! 🙏`
  }

  /** Thank you after event */
  static thankYou(params: {
    guestName: string
    eventName: string
    feedbackLink?: string
  }): string {
    return `💛 *Thank You for Attending!*

Dear ${params.guestName},

It was wonderful having you at *${params.eventName}*. We hope you had a memorable experience.

${params.feedbackLink ? `Share your feedback:\n${params.feedbackLink}\n\n` : ''}Looking forward to the next occasion together! 🌟`
  }

  /** OTP verification */
  static otp(params: { otp: string }): string {
    return `*${params.otp}* is your OccasionPro verification code.

Valid for 5 minutes. Do not share with anyone.

OccasionPro Support: support@occasionpro.in`
  }

  /** Guest portal access link */
  static guestPortalAccess(params: {
    guestName: string
    eventName: string
    accessLink: string
  }): string {
    return `🔗 *Your Guest Portal Access*

Hello ${params.guestName},

Access your guest portal for *${params.eventName}*:

${params.accessLink}

View your invitation, RSVP status, accommodation details, and more.

_Link is secure and personal to you._`
  }

  /** Vendor assignment notification */
  static vendorAssigned(params: {
    vendorName: string
    eventName: string
    category: string
    portalLink: string
  }): string {
    return `📋 *New Event Assignment*

Hello ${params.vendorName},

You've been assigned as *${params.category}* vendor for:
*${params.eventName}*

Access your vendor portal to view deliverables, timelines, and submit invoices:
${params.portalLink}

Please confirm your availability at your earliest convenience.`
  }

  /** Payment reminder */
  static paymentReminder(params: {
    clientName: string
    eventName: string
    amount: string
    dueDate: string
    paymentLink: string
  }): string {
    return `💰 *Payment Due Reminder*

Hello ${params.clientName},

A payment is due for *${params.eventName}*:

Amount: *${params.amount}*
Due by: ${params.dueDate}

Pay securely:
${params.paymentLink}

Questions? Reply to this message.`
  }
}
