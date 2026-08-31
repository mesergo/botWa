import i18n from './index';

const AUTH_ERROR_KEYS: Record<string, string> = {
  'Invalid credentials': 'errors.invalidCredentials',
  'הזמנה לא תקינה': 'apiErrors.invalidInvite',
  'ההזמנה פגה': 'apiErrors.expiredInvite',
  'לא ניתן לשנות את כתובת האימייל בהזמנה זו': 'apiErrors.inviteEmailLocked',
  'לא ניתן לשנות את השם המלא בהזמנה זו': 'apiErrors.inviteNameLocked',
  'יש לאשר התחברות לחשבון המוזמן לפני השלמת ההרשמה': 'apiErrors.inviteConfirmationRequired',
  'האימייל של חשבון Google אינו תואם להזמנה': 'apiErrors.inviteGoogleEmailMismatch',
  'אימות גוגל נכשל, נסה שנית': 'apiErrors.googleAuthFailed',
  'שם העסק הוא שדה חובה': 'apiErrors.businessNameRequired',
  'כתובת אימייל אינה תקינה': 'apiErrors.invalidEmail',
  'מספר טלפון אינו תקין': 'apiErrors.invalidPhone',
  'הסיסמה חייבת להכיל לפחות 6 תווים': 'apiErrors.passwordTooShort',
  'כתובת האימייל כבר קיימת במערכת': 'apiErrors.emailExists',
};

export const translateAuthApiError = (
  error: unknown,
  fallbackKey: string,
): string => {
  if (typeof error === 'string' && error.trim()) {
    const translationKey = AUTH_ERROR_KEYS[error];
    return translationKey ? i18n.t(translationKey, { ns: 'auth' }) : error;
  }

  return i18n.t(fallbackKey, { ns: 'auth' });
};
