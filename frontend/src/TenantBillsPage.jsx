import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function TenantBillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchBills();
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function fetchBills() {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`/tenant/bills`);
      if (!res.ok) throw new Error('Failed to load bills');
      const json = await res.json();
      setBills(json.bills || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !bills.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading your bills...</div>
      </div>
    );
  }

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="hero hero-banner">
        <p className="helper" style={{ fontWeight: 700, marginBottom: 4 }}>Capital Assets by SkyYalla Limited</p>
        <h1 className="hero-title">My Bills</h1>
        <p className="hero-subtitle">{greeting}. Track your rent, water, and other charges.</p>
        <p className="helper" style={{ marginTop: 4 }}>{dateStr} · {timeStr}</p>
      </div>

      <main className="flex-1 max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded text-sm">{error}</div>
        )}

        <section className="card-glass">
          {bills.length ? (
            <div className="table-wrap">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr>
                    <Th>Period</Th>
                    <Th>House</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Paid</Th>
                    <Th align="right">Balance</Th>
                    <Th>Status</Th>
                    <Th>Due Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id}>
                      <Td>{b.billingPeriod}</Td>
                      <Td>
                        <div className="stack">
                          <span className="text-slate-800 text-xs sm:text-sm">{b.propertyName || '-'}</span>
                          <span className="text-[11px] text-slate-500">{b.unitCode}</span>
                        </div>
                      </Td>
                      <Td align="right">{formatCurrency(b.totalAmount)}</Td>
                      <Td align="right">{formatCurrency(b.amountPaid)}</Td>
                      <Td align="right">{formatCurrency(b.balance)}</Td>
                      <Td>
                        <StatusPill status={b.status} />
                      </Td>
                      <Td>{formatDate(b.dueDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No bills found yet.</div>
          )}
        </section>
      </main>
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th
      className={[
        'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left', className = '' }) {
  return (
    <td
      className={[
        'px-3 py-2 text-slate-700 align-middle',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  );
}

function StatusPill({ status }) {
  const normalized = (status || '').toLowerCase();
  let colors = 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalized === 'paid') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (normalized === 'overdue') {
    colors = 'bg-red-50 text-red-700 border-red-100';
  } else if (normalized === 'partial') {
    colors = 'bg-amber-50 text-amber-700 border-amber-100';
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

export default TenantBillsPage;
