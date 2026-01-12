import 'dotenv/config';
import { supabase } from './supabaseClient.js';
import { sendSms } from './lib/smsProvider.js';

/**
 * Simple worker to process queued sms_logs.
 */

async function processQueued(limit = 50) {
  const { data: logs, error } = await supabase
    .from('sms_logs')
    .select('id, recipient_phone, message_text, template_code, provider_response')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('smsWorker: failed to fetch queued logs', error);
    return;
  }

  if (!logs?.length) {
    console.log('smsWorker: no queued sms_logs');
    return;
  }

  const maxAttempts = 3;

  for (const log of logs) {
    let attempts = 0;
    try {
      if (log.provider_response) {
        const parsed = JSON.parse(log.provider_response);
        attempts = parsed?.attempts ? Number(parsed.attempts) || 0 : 0;
      }
    } catch (_err) {
      attempts = 0;
    }

    if (attempts >= maxAttempts) {
      await supabase
        .from('sms_logs')
        .update({ status: 'failed', provider_response: JSON.stringify({ attempts, error: 'max attempts reached' }) })
        .eq('id', log.id);
      continue;
    }

    try {
      const result = await sendSms({
        to: log.recipient_phone,
        body: log.message_text,
        templateCode: log.template_code,
      });

      const nextStatus = result.success ? 'sent' : result.response === 'twilio_not_configured' ? 'queued' : 'failed';
      const nextAttempts = result.response === 'twilio_not_configured' ? attempts : attempts + 1;

      const { error: updateError } = await supabase
        .from('sms_logs')
        .update({
          status: nextStatus,
          provider_response: result.response
            ? JSON.stringify({ attempts: nextAttempts, response: result.response })
            : JSON.stringify({ attempts: nextAttempts }),
          sent_at: result.success ? new Date().toISOString() : null,
        })
        .eq('id', log.id);

      if (updateError) {
        console.error(`smsWorker: failed to update sms_log ${log.id}`, updateError);
      }
    } catch (err) {
      console.error(`smsWorker: error processing sms_log ${log.id}`, err);
      await supabase
        .from('sms_logs')
        .update({
          status: 'queued',
          provider_response: JSON.stringify({ attempts: attempts + 1, error: err?.message || 'sendSms error' }),
        })
        .eq('id', log.id);
    }
  }
}

processQueued().then(() => {
  console.log('smsWorker: done');
  process.exit(0);
});
