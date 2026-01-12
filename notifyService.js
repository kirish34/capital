import { supabase } from './supabaseClient.js';

export async function notifyTenant({ tenantId, phone, type, title, message, meta = {} }) {
  // Insert in-app notification
  const { error: notifError } = await supabase.from('notifications').insert({
    user_type: 'tenant',
    user_id: tenantId,
    type,
    title,
    message,
    related_tenancy_id: meta.tenancy_id || null,
    related_bill_id: meta.bill_id || null,
    related_ticket_id: meta.ticket_id || null,
  });

  if (notifError) {
    console.error('Error inserting notification:', notifError);
  }

  // Queue SMS log for downstream worker/gateway
  if (phone) {
    const { error: smsError } = await supabase.from('sms_logs').insert({
      recipient_phone: phone,
      recipient_type: 'tenant',
      related_tenancy_id: meta.tenancy_id || null,
      related_wallet_id: meta.wallet_id || null,
      template_code: type?.toUpperCase?.() || null,
      message_text: message,
      status: 'queued',
    });

    if (smsError) {
      console.error('Error inserting sms_log:', smsError);
    }
  }
}
