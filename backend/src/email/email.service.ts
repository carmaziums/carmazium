import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;

    constructor() {
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_APP_PASSWORD;

        if (!user || !pass) {
            this.logger.warn('Email credentials not found in environment variables. Email Service will fail.');
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: pass?.trim(),
            },
        });
    }

    /**
     * Sends an onboarding welcome email asynchronously based on user role.
     */
    async sendWelcomeEmail(toEmail: string, firstName?: string, role: string = 'BUYER') {
        const name = firstName || 'there';
        
        let roleSpecificMessage = `You can now explore the marketplace, access premium dealer tools, and connect with millions of buyers and sellers worldwide.`;
        
        if (role === 'DEALER') {
            roleSpecificMessage = `As a Dealer, you can now manage your inventory, receive leads, and configure your dealership profile to reach maximum buyers.`;
        } else if (role === 'FINANCE_PARTNER' || role === 'INSURANCE_PARTNER') {
            roleSpecificMessage = `We are excited to have you as a Partner. Access your custom dashboard to start managing vehicle financing and services!`;
        } else if (role === 'BUYER' || role === 'SELLER') {
            roleSpecificMessage = `You can now securely buy, sell, and trade vehicles under our verified KYC protection.`;
        }

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; min-height: 100vh; background-color: #f4f4f5; padding: 40px 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="background-color: #ed1c24; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to CarMazium!</h1>
                    </div>
                    <div style="padding: 40px 30px;">
                        <p style="font-size: 18px; color: #3f3f46; margin-bottom: 20px;">Hi ${name},</p>
                        <p style="font-size: 16px; color: #52525b; line-height: 1.6; margin-bottom: 30px;">
                            We're thrilled to have you on board! CarMazium is the premier platform to buy, sell, and auction vehicles seamlessly.
                        </p>
                        <p style="font-size: 16px; color: #52525b; line-height: 1.6; margin-bottom: 30px;">
                            ${roleSpecificMessage}
                        </p>
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://carmazium.vercel.app'}/auth/login" style="background-color: #ed1c24; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Get Started</a>
                        </div>
                        <p style="font-size: 14px; color: #71717a; line-height: 1.5;">
                            If you have any questions or need assistance, simply reply to this email. We're here to help!
                        </p>
                        <div style="margin-top: 40px; border-top: 1px solid #e4e4e7; padding-top: 20px; text-align: center;">
                            <p style="font-size: 12px; color: #a1a1aa; margin: 0;">&copy; ${new Date().getFullYear()} CarMazium. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"CarMazium Team" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: 'Welcome to CarMazium! 🚗',
            html: htmlContent,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Welcome email successfully sent to ${toEmail}`);
        } catch (error: any) {
            this.logger.error(`Failed to send welcome email to ${toEmail}. Error: ${error.message}`);
        }
    }
}
