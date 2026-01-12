import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function TenantHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vacateSubmitting, setVacateSubmitting] = useState(false);
  const [vacateMessage, setVacateMessage] = useState('');
  const [now, setNow] = useState(new Date());
  const [announcements, setAnnouncements] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchOverview();
    fetchAnnouncements();
    fetchDocuments();
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function fetchOverview() {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`/tenant/overview`);
      if (!res.ok) throw new Error('Failed to load your home');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAnnouncements() {
    try {
      const res = await apiFetch('/tenant/announcements');
      if (!res.ok) return;
      const json = await res.json();
      setAnnouncements(json.announcements || []);
    } catch (err) {
      console.error('announcements fetch error', err);
    }
  }

  async function fetchDocuments() {
    try {
      const res = await apiFetch('/tenant/documents');
      if (!res.ok) return;
      const json = await res.json();
      setDocuments(json.documents || []);
    } catch (err) {
      console.error('documents fetch error', err);
    }
  }

  async function handleVacateRequest(tenancyId) {
    const requestedMoveOutDate = prompt('Enter intended move-out date (YYYY-MM-DD):');
    if (!requestedMoveOutDate) return;
    const reason = prompt('Reason for vacating (optional):') || '';
    try {
      setVacateSubmitting(true);
      setVacateMessage('');
      const res = await apiFetch(`/tenant/vacate-requests`, {
        method: 'POST',
        body: JSON.stringify({ tenancyId, requestedMoveOutDate, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to submit vacate request');
      setVacateMessage('Vacate request submitted successfully.');
    } catch (err) {
      console.error(err);
      setVacateMessage(err.message || 'Failed to submit vacate request');
    } finally {
      setVacateSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading your details...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded">{error}</div>
      </div>
    );
  }

  const tenancies = data?.tenancies || [];
  const activeTenancy = tenancies[0] || null;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="hero hero-banner">
        <p className="helper" style={{ fontWeight: 700, marginBottom: 4 }}>Capital Assets by SkyYalla Limited</p>
        <h1 className="hero-title">Tenant Portal</h1>
        <p className="hero-subtitle">
          {greeting}
          {activeTenancy?.tenant?.full_name ? `, ${activeTenancy.tenant.full_name}` : ''}. Your wallet, bills, and home.
        </p>
        <p className="helper" style={{ marginTop: 4 }}>{dateStr} · {timeStr}</p>
      </div>

      <main className="flex-1 max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}

        {activeTenancy ? (
          <>
            <section className="card-glass">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Your House</h2>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {activeTenancy.property?.name} · {activeTenancy.unit?.code}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{activeTenancy.property?.location}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    Status: <StatusPill status={activeTenancy.status} /> · Rent: {formatCurrency(activeTenancy.rentAmount)}
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <button
                    disabled={vacateSubmitting}
                    onClick={() => handleVacateRequest(activeTenancy.id)}
                    className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Request to vacate
                  </button>
                  {vacateMessage && (
                    <div className="text-[11px] text-slate-500 max-w-xs text-right">{vacateMessage}</div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 card-glass">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Rent Wallet</h2>
                {activeTenancy.wallet ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Paybill</div>
                      <div className="font-mono text-slate-900">
                        {activeTenancy.wallet.paybill?.shortcode || '—'}
                      </div>
                      {activeTenancy.wallet.paybill?.name ? (
                        <div className="text-[11px] text-slate-500">{activeTenancy.wallet.paybill.name}</div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Account (A/C) Number</div>
                      <div className="font-mono text-slate-900 break-all">
                        {activeTenancy.wallet.accountReference}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Use this as A/C when paying via M-Pesa Paybill.
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Wallet Balance</div>
                      <div className="text-xl font-semibold text-slate-900">
                        {formatCurrency(activeTenancy.wallet.balance)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Wallet not set up yet. Contact your landlord/caretaker.
                  </div>
                )}
              </div>

              <div className="md:col-span-2 card-glass">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Latest Bill</h2>
                {activeTenancy.latestBill ? (
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 uppercase mb-1">Billing Period</div>
                      <div className="text-slate-900 font-medium">{activeTenancy.latestBill.billingPeriod}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Due date: {formatDate(activeTenancy.latestBill.dueDate) || '-'}
                      </div>
                      <div className="mt-1">
                        Status: <StatusPill status={activeTenancy.latestBill.status || 'unpaid'} />
                      </div>
                    </div>
                    <div className="flex flex-col items-start md:items-end">
                      <div className="text-xs text-slate-500 uppercase mb-1">Total</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {formatCurrency(activeTenancy.latestBill.totalAmount)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Paid: {formatCurrency(activeTenancy.latestBill.amountPaid)} · Balance: {formatCurrency(activeTenancy.latestBill.balance)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Wallet auto-pays when you top up.</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    No bill found yet. Once landlord issues the first bill, it will appear here.
                  </div>
                )}
              </div>
            </section>

            <section className="card-glass">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Announcements</h2>
              {announcements.length ? (
                <div className="space-y-2">
                  {announcements.slice(0, 5).map((a) => (
                    <div key={a.id} className="border border-slate-100 rounded-md px-3 py-2 text-sm">
                      <div className="font-medium text-slate-800">{a.title}</div>
                      <div className="text-[11px] text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
                      <div className="text-sm text-slate-700 mt-1">{a.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No announcements yet.</div>
              )}
            </section>

            <section className="card-glass">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Documents</h2>
              {documents.length ? (
                <div className="space-y-2 text-sm">
                  {documents.map((d) => (
                    <div key={d.id} className="border border-slate-100 rounded-md px-3 py-2">
                      <div className="font-medium text-slate-800">{d.type}</div>
                      <div className="text-[11px] text-slate-500">{new Date(d.uploaded_at).toLocaleString()}</div>
                      <a className="text-sky-600 text-xs" href={d.file_url} target="_blank" rel="noreferrer">
                        View file
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No documents uploaded.</div>
              )}
            </section>
          </>
        ) : (
          <section className="card-glass">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">No Active House</h2>
            <p className="text-sm text-slate-500">
              You do not have an active tenancy linked to your account yet.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function StatusPill({ status }) {
  const normalized = (status || '').toLowerCase();
  let colors = 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalized === 'active') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (normalized === 'pending') {
    colors = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (normalized === 'overdue' || normalized === 'ended') {
    colors = 'bg-red-50 text-red-700 border-red-100';
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        colors,
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default TenantHome;
