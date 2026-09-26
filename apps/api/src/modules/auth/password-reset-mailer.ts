export interface PasswordResetMailer {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}

export class UnconfiguredPasswordResetMailer implements PasswordResetMailer {
  async sendPasswordReset(_email: string, _resetUrl: string): Promise<void> {
    throw new Error('Password reset email delivery is not configured');
  }
}
