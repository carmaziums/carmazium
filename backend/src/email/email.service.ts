import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private resend: Resend;
    private readonly fromAddress: string;
    private readonly frontendUrl: string;
    private readonly logoUrl: string;

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            this.logger.warn('RESEND_API_KEY not found in environment variables. Email Service will fail.');
        }

        this.resend = new Resend(apiKey || '');
        this.fromAddress = process.env.EMAIL_FROM || 'CarMazium <noreply@carmazium.com>';
        this.frontendUrl = process.env.FRONTEND_URL || 'https://carmazium.vercel.app';
        this.logoUrl = `${this.frontendUrl}/assets/images/logo.png`;
    }

    // ─── Brand Template Shell ────────────────────────────────────────

    /**
     * Wraps email body content inside a branded CarMazium layout
     * with logo header, brand colors, and footer.
     */
    private wrapInBrandTemplate(bodyHtml: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CarMazium</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">

        <!-- Header with Logo -->
        <div style="text-align: center; padding: 32px 0 24px;">
            <a href="${this.frontendUrl}" target="_blank" style="text-decoration: none;">
                <img src="${this.logoUrl}" alt="CarMazium" width="180" height="45" style="display: inline-block; max-width: 180px; height: auto;" />
            </a>
        </div>

        <!-- Main Card -->
        <div style="background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">

            <!-- Red Accent Strip -->
            <div style="height: 4px; background: linear-gradient(90deg, #ed1c24, #ff4d4d, #ed1c24);"></div>

            <!-- Body Content -->
            <div style="padding: 48px 40px 40px;">
                ${bodyHtml}
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 32px 20px 16px;">
            <!-- Social / Quick Links -->
            <div style="margin-bottom: 20px;">
                <a href="${this.frontendUrl}/search" style="display: inline-block; margin: 0 10px; color: #94a3b8; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Browse Cars</a>
                <span style="color: #334155;">•</span>
                <a href="${this.frontendUrl}/sell" style="display: inline-block; margin: 0 10px; color: #94a3b8; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Sell Yours</a>
                <span style="color: #334155;">•</span>
                <a href="${this.frontendUrl}/pricing" style="display: inline-block; margin: 0 10px; color: #94a3b8; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Pricing</a>
            </div>

            <p style="font-size: 11px; color: #475569; margin: 0 0 8px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} CarMazium Ltd. All rights reserved.
            </p>
            <p style="font-size: 10px; color: #334155; margin: 0;">
                The premier platform to buy, sell, and auction vehicles.
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    // ─── Welcome Email ──────────────────────────────────────────────

    /**
     * Sends an onboarding welcome email asynchronously based on user role.
     */
    async sendWelcomeEmail(toEmail: string, firstName?: string, role: string = 'BUYER') {
        const name = firstName || 'there';

        const roleConfigs: Record<string, { greeting: string; tagline: string; features: string[] }> = {
            DEALER: {
                greeting: `Welcome aboard, ${name}!`,
                tagline: 'Your dealership command centre is ready.',
                features: [
                    'Manage your full vehicle inventory from one dashboard',
                    'Receive and respond to buyer leads & offers in real-time',
                    'Track performance analytics, revenue trends & conversion metrics',
                    'Configure your dealership profile to maximise buyer reach',
                ],
            },
            SELLER: {
                greeting: `Hey ${name}, welcome!`,
                tagline: 'You\'re all set to list and sell vehicles.',
                features: [
                    'Create professional listings with AI-powered descriptions',
                    'Receive offers and counter-offers directly on your dashboard',
                    'Track listing views, engagement, and buyer interest',
                    'Secure transactions with verified KYC protection',
                ],
            },
            BUYER: {
                greeting: `Hey ${name}, welcome!`,
                tagline: 'Start exploring thousands of verified vehicles.',
                features: [
                    'Search and filter from a curated marketplace of quality vehicles',
                    'Make offers and negotiate prices directly with sellers',
                    'Get instant vehicle history and HPI checks',
                    'Save favourites and receive price-drop alerts',
                ],
            },
            FINANCE_PARTNER: {
                greeting: `Welcome, ${name}!`,
                tagline: 'Your finance partner dashboard is live.',
                features: [
                    'Manage vehicle finance applications from your dashboard',
                    'Connect directly with buyers looking for financing',
                    'Track application progress and conversion rates',
                    'Configure your offerings and approval criteria',
                ],
            },
            INSURANCE_PARTNER: {
                greeting: `Welcome, ${name}!`,
                tagline: 'Your insurance partner portal is ready.',
                features: [
                    'Manage insurance quote requests from your dashboard',
                    'Connect with buyers seeking vehicle insurance',
                    'Track quote-to-policy conversion metrics',
                    'Configure coverage tiers and pricing rules',
                ],
            },
        };

        const config = roleConfigs[role] || roleConfigs.BUYER;

        const featureListHtml = config.features
            .map(
                (f) => `
                <tr>
                    <td width="28" valign="top" style="padding: 6px 0;">
                        <div style="width: 20px; height: 20px; background: rgba(237,28,36,0.1); border: 1px solid rgba(237,28,36,0.2); border-radius: 6px; text-align: center; line-height: 20px; font-size: 11px; color: #ed1c24;">✓</div>
                    </td>
                    <td style="padding: 6px 0 6px 12px; color: #cbd5e1; font-size: 14px; line-height: 1.5;">${f}</td>
                </tr>`,
            )
            .join('');

        const bodyHtml = `
            <!-- Greeting -->
            <h1 style="margin: 0 0 8px; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                ${config.greeting}
            </h1>
            <p style="margin: 0 0 32px; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                ${config.tagline}
            </p>

            <!-- Divider -->
            <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); margin: 0 0 28px;"></div>

            <!-- What's included -->
            <p style="margin: 0 0 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">
                What you can do
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                ${featureListHtml}
            </table>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 36px 0 24px;">
                <a href="${this.frontendUrl}/dashboard" target="_blank"
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ed1c24, #c41920); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px; box-shadow: 0 8px 25px rgba(237,28,36,0.35);">
                    Go to Dashboard →
                </a>
            </div>

            <!-- Support note -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; text-align: center; margin-top: 20px;">
                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                    Need help getting started? Simply reply to this email — our team is here for you.
                </p>
            </div>
        `;

        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromAddress,
                to: [toEmail],
                subject: `Welcome to CarMazium, ${name}! 🚗`,
                html: this.wrapInBrandTemplate(bodyHtml),
            });

            if (error) {
                this.logger.error(`Failed to send welcome email to ${toEmail}. Error: ${error.message}`);
                return;
            }

            this.logger.log(`Welcome email sent to ${toEmail} (id: ${data?.id})`);
        } catch (error: any) {
            this.logger.error(`Failed to send welcome email to ${toEmail}. Error: ${error.message}`);
        }
    }

    // ─── Generic Sender ─────────────────────────────────────────────

    /**
     * Send a branded transactional email with custom body content.
     * The body HTML is automatically wrapped in the CarMazium brand template.
     */
    async sendBrandedEmail(options: {
        to: string | string[];
        subject: string;
        bodyHtml: string;
        replyTo?: string;
    }) {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromAddress,
                to: Array.isArray(options.to) ? options.to : [options.to],
                subject: options.subject,
                html: this.wrapInBrandTemplate(options.bodyHtml),
                replyTo: options.replyTo,
            });

            if (error) {
                this.logger.error(`Failed to send branded email. Error: ${error.message}`);
                return null;
            }

            this.logger.log(`Branded email sent (id: ${data?.id})`);
            return data;
        } catch (error: any) {
            this.logger.error(`Failed to send branded email. Error: ${error.message}`);
            return null;
        }
    }

    /**
     * Send a raw email without the brand template wrapper.
     * Use this for system/transactional emails that don't need branding.
     */
    async sendEmail(options: {
        to: string | string[];
        subject: string;
        html: string;
        replyTo?: string;
    }) {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromAddress,
                to: Array.isArray(options.to) ? options.to : [options.to],
                subject: options.subject,
                html: options.html,
                replyTo: options.replyTo,
            });

            if (error) {
                this.logger.error(`Failed to send email. Error: ${error.message}`);
                return null;
            }

            this.logger.log(`Email sent (id: ${data?.id})`);
            return data;
        } catch (error: any) {
            this.logger.error(`Failed to send email. Error: ${error.message}`);
            return null;
        }
    }

    async sendKycSubmissionAdminAlert(adminEmails: string[], dealerName: string) {
        const bodyHtml = `
            <h1 style="margin: 0 0 16px; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                New Dealer KYC Submission 🛡️
            </h1>
            <p style="margin: 0 0 24px; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                A new dealer profile, <strong>${dealerName}</strong>, has submitted their business verification documents for review.
            </p>
            <p style="margin: 0 0 32px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Please log in to your Superadmin Dashboard and navigate to the Dealer KYC section to inspect their submitted files and approve or reject them field-by-field.
            </p>
            <div style="text-align: center; margin: 36px 0 24px;">
                <a href="${this.frontendUrl}/dashboard/admin/dealer-verification" target="_blank"
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ed1c24, #c41920); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px; box-shadow: 0 8px 25px rgba(237,28,36,0.35);">
                    Review KYC Submission
                </a>
            </div>
        `;
        return this.sendBrandedEmail({
            to: adminEmails,
            subject: `Action Required: New KYC Submission from ${dealerName} 🛡️`,
            bodyHtml,
        });
    }

    async sendKycApprovedDealerAlert(dealerEmail: string, dealerName: string) {
        const bodyHtml = `
            <h1 style="margin: 0 0 16px; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                KYC Verification Approved! 🎉
            </h1>
            <p style="margin: 0 0 24px; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Dear <strong>${dealerName}</strong>, we are thrilled to inform you that your dealership business verification (KYC) has been fully approved by our administration!
            </p>
            <p style="margin: 0 0 32px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                All your submitted business documents have been verified. Your dealer dashboard is now fully unlocked and ready to use. You can list cars, run auctions, and manage leads!
            </p>
            <div style="text-align: center; margin: 36px 0 24px;">
                <a href="${this.frontendUrl}/dashboard/dealer" target="_blank"
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #4ade80, #16a34a); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px; box-shadow: 0 8px 25px rgba(74,222,128,0.35);">
                    Access Dealer Dashboard
                </a>
            </div>
        `;
        return this.sendBrandedEmail({
            to: dealerEmail,
            subject: 'Congratulations! Your CarMazium Dealer Profile is Approved 🎉',
            bodyHtml,
        });
    }

    async sendKycRejectedDealerAlert(dealerEmail: string, dealerName: string, rejectedFields: { field: string; note: string }[]) {
        const fieldListHtml = rejectedFields
            .map(
                (f) => `
                <li style="margin-bottom: 12px; color: #fda4af; font-size: 14px; line-height: 1.5;">
                    <strong style="color: #ffffff;">${f.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}:</strong> 
                    <span style="display: block; font-style: italic; color: #cbd5e1; margin-top: 4px; padding-left: 12px; border-left: 2px solid #f43f5e;">"${f.note || 'No reason provided.'}"</span>
                </li>`,
            )
            .join('');

        const bodyHtml = `
            <h1 style="margin: 0 0 16px; font-family: 'Poppins', 'Segoe UI', sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                KYC Verification Update ⚠️
            </h1>
            <p style="margin: 0 0 24px; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Dear <strong>${dealerName}</strong>, some of the business verification documents you provided could not be approved by our administration.
            </p>
            <p style="margin: 0 0 16px; font-size: 14px; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
                Please review the feedback and re-upload the following details:
            </p>
            <ul style="margin: 0 0 32px; padding-left: 20px;">
                ${fieldListHtml}
            </ul>
            <p style="margin: 0 0 32px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Note that your previously approved documents are locked and saved; you only need to re-submit these specific items.
            </p>
            <div style="text-align: center; margin: 36px 0 24px;">
                <a href="${this.frontendUrl}/dashboard/dealer" target="_blank"
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ed1c24, #c41920); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px; box-shadow: 0 8px 25px rgba(237,28,36,0.35);">
                    Update Documents
                </a>
            </div>
        `;
        return this.sendBrandedEmail({
            to: dealerEmail,
            subject: 'Action Required: Update your CarMazium Dealer Documents ⚠️',
            bodyHtml,
        });
    }
}

