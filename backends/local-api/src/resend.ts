type ResendEmail = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function isResendConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY"));
}

export async function sendResendEmail(input: ResendEmail): Promise<void> {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`resend_failed_${res.status}:${text.slice(0, 400)}`);
  }
}

export function apkzioWebBaseUrl(): string {
  return env("APKZIO_WEB_URL") || "https://apkzio.com";
}

export function apkzioApiBaseUrl(): string {
  return env("APKZIO_API_URL") || "https://api.apkzio.com";
}

export function resendFromAddress(): string {
  return env("RESEND_FROM") || "ApkZio <no-reply@apkzio.com>";
}

export function buildVerifyEmail(to: string, token: string): ResendEmail {
  const link = `${apkzioWebBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your ApkZio email";
  const text = `Verify your email: ${link}`;
  const html = `<p>Verify your email address:</p><p><a href="${link}">${link}</a></p>`;
  return { from: resendFromAddress(), to, subject, text, html };
}

export function buildResetPasswordEmail(to: string, token: string): ResendEmail {
  const link = `${apkzioWebBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your ApkZio password";
  const text = `Reset your password: ${link}`;
  const html = `<p>Reset your password:</p><p><a href="${link}">${link}</a></p>`;
  return { from: resendFromAddress(), to, subject, text, html };
}

export function buildBuildNotificationEmail(input: {
  to: string;
  status: "success" | "failed";
  appName: string;
  versionName: string;
  versionCode: number;
  artifactPath?: string | null;
}): ResendEmail {
  const subject =
    input.status === "success"
      ? `ApkZio build ready: ${input.appName}`
      : `ApkZio build failed: ${input.appName}`;

  const artifactUrl = input.artifactPath ? `${apkzioApiBaseUrl()}${input.artifactPath}` : null;
  const title = `${input.appName} (${input.versionName} · ${input.versionCode})`;
  const text =
    input.status === "success"
      ? `Your build is ready: ${title}${artifactUrl ? `\nDownload: ${artifactUrl}` : ""}`
      : `Your build failed: ${title}`;

  const html =
    input.status === "success"
      ? `<p>Your build is ready:</p><p><strong>${title}</strong></p>${artifactUrl ? `<p><a href="${artifactUrl}">Download artifact</a></p>` : ""}`
      : `<p>Your build failed:</p><p><strong>${title}</strong></p>`;

  return { from: resendFromAddress(), to: input.to, subject, text, html };
}

