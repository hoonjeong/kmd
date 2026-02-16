import axios from 'axios';

interface SendSMSResult {
  success: boolean;
  message?: string;
}

export async function sendSMS(phone: string, message: string): Promise<SendSMSResult> {
  const userId = process.env.SMS_USER_ID;
  const authKey = process.env.SMS_AUTH_KEY;
  const sender = process.env.SMS_DEFAULT_CALLNUM;

  if (!userId || !authKey || !sender) {
    console.error('SMS env vars missing: SMS_USER_ID, SMS_AUTH_KEY, SMS_DEFAULT_CALLNUM');
    return { success: false, message: 'SMS 설정이 되어있지 않습니다.' };
  }

  const params = new URLSearchParams();
  params.append('key', authKey);
  params.append('user_id', userId);
  params.append('sender', sender);
  params.append('receiver', phone.replace(/-/g, ''));
  params.append('msg', message);

  try {
    const res = await axios.post('https://apis.aligo.in/send/', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (res.data.result_code === '1') {
      return { success: true };
    }

    console.error('Aligo SMS error:', res.data);
    return { success: false, message: res.data.message || 'SMS 발송에 실패했습니다.' };
  } catch (err) {
    console.error('SMS send error:', err);
    return { success: false, message: 'SMS 발송 중 오류가 발생했습니다.' };
  }
}
