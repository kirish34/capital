import 'dotenv/config';
import twilio from 'twilio';

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

let client = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, {
    lazyLoading: true,
  });
}

export async function sendSms({ to, body, templateCode }) {
  if (!client) {
    return {
      success: false,
      response: 'twilio_not_configured',
    };
  }

  try {
    const result = await client.messages.create({
      to,
      from: TWILIO_FROM_NUMBER,
      body,
    });

    return {
      success: true,
      response: {
        sid: result.sid,
        status: result.status,
        template: templateCode || null,
      },
    };
  } catch (err) {
    console.error('sendSms error:', err);
    return {
      success: false,
      response: err?.message || 'twilio_error',
    };
  }
}
