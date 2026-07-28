import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

/**
 * Sends transactional email via SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS are configured.
 * Without those, every send just logs to the server console — keeps flows like
 * password reset fully testable without a real mail provider.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private client() {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>("SMTP_HOST");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    if (!host || !user || !pass) return null;
    this.transporter = createTransport({
      host,
      port: Number(this.config.get<string>("SMTP_PORT") ?? 587),
      secure: this.config.get<string>("SMTP_SECURE") === "true",
      auth: { user, pass }
    });
    return this.transporter;
  }

  async send(params: { to: string; subject: string; html: string; text: string }) {
    const client = this.client();
    const from = this.config.get<string>("SMTP_FROM") ?? "no-reply@myecom.local";
    if (!client) {
      this.logger.log(`[mail:not configured] To: ${params.to} | Subject: ${params.subject}\n${params.text}`);
      return { delivered: false };
    }
    await client.sendMail({ from, to: params.to, subject: params.subject, html: params.html, text: params.text });
    return { delivered: true };
  }
}
