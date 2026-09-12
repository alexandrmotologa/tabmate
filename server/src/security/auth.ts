import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user?: TelegramUser;
  query_id?: string;
  auth_date?: number;
  hash?: string;
}

/**
 * Validates Telegram Mini App initData using HMAC-SHA256.
 * Bypasses signature checking if DEMO_MODE is true or TELEGRAM_BOT_TOKEN is not configured.
 */
export function validateTelegramInitData(
  initData: string,
  botToken?: string
): { isValid: boolean; data?: ValidatedInitData } {
  if (!initData) {
    return { isValid: false };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  const parsedData: ValidatedInitData = {};
  const userStr = params.get('user');
  if (userStr) {
    try {
      parsedData.user = JSON.parse(userStr);
    } catch {
      // ignore JSON parse error
    }
  }

  const authDateStr = params.get('auth_date');
  if (authDateStr) {
    parsedData.auth_date = parseInt(authDateStr, 10);
  }

  // If demo mode or no token is configured, allow mock initData
  if (!botToken || process.env.DEMO_MODE === 'true') {
    return { isValid: true, data: parsedData };
  }

  if (!hash) {
    return { isValid: false };
  }

  params.delete('hash');

  // Sort remaining parameters alphabetically
  const dataCheckArr: string[] = [];
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join('\n');

  // Secret key = HMAC_SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculated hash = HMAC_SHA256(secretKey, dataCheckString)
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const isValid = calculatedHash === hash;
  return { isValid, data: isValid ? parsedData : undefined };
}
