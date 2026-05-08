/**
 * Email Service
 * 
 * Stub implementation that logs emails to console
 * TODO: Integrate with SendGrid, Mailgun, or Resend
 */

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  html?: string;
}

/**
 * Send an email
 * Currently just logs to console
 * TODO: Integrate real email service
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  console.log('\n📧 ============= EMAIL =============');
  console.log(`To: ${options.to}`);
  console.log(`From: ${options.from || 'noreply@apkzio.com'}`);
  console.log(`Subject: ${options.subject}`);
  console.log('-----------------------------------');
  console.log(options.body);
  console.log('===================================\n');
  
  // TODO: Integrate with real email service
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: options.to,
  //   from: options.from || 'noreply@apkzio.com',
  //   subject: options.subject,
  //   text: options.body,
  //   html: options.html || options.body,
  // });
  
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: options.from || 'noreply@apkzio.com',
  //   to: options.to,
  //   subject: options.subject,
  //   text: options.body,
  //   html: options.html || options.body,
  // });
}

/**
 * Send a team invitation email
 * Specialized template for team invites
 */
export async function sendTeamInviteEmail(
  to: string,
  inviterName: string,
  role: string,
  inviteUrl: string
): Promise<void> {
  const subject = `${inviterName} invited you to join their ApkZio team`;
  
  const body = `
Hi there,

${inviterName} has invited you to join their team on ApkZio.

Role: ${role}

Accept your invitation:
${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
ApkZio Team
`.trim();
  
  await sendEmail({
    to,
    subject,
    body,
  });
}
