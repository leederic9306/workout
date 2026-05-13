import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Resend 이메일 발송 서비스
// @MX:NOTE: [AUTO] 이메일 발송 실패는 회원가입 트랜잭션을 차단하면 안 됨 (fire-and-forget)
@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly apiKey: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY') ?? '';
    this.appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  // 이메일 인증 메일 발송 (실패해도 호출자에게 예외 던지지 않음)
  async sendVerificationEmail(
    to: string,
    verificationToken: string,
  ): Promise<void> {
    try {
      if (!this.apiKey || this.apiKey === 're_test_placeholder') {
        this.logger.debug(
          `[DEV] Skipping Resend send to ${to} (no real API key)`,
        );
        return;
      }

      const verificationUrl = `${this.appUrl}/auth/verify-email?token=${verificationToken}`;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Workout <noreply@workout.com>',
          to,
          subject: '이메일 인증을 완료해 주세요',
          html: `<p>아래 링크를 클릭하여 이메일 인증을 완료해 주세요:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Resend send failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      // 이메일 발송 실패는 무시 (회원가입 흐름 보호)
      this.logger.error(
        `Resend email send error: ${(error as Error).message}`,
      );
    }
  }
}
