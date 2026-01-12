import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from './lib/apiClient.js';

function TenantTenancyDetails() {
  const { tenancyId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDetails();
  }, [tenancyId]);

  async function loadDetails() {
    try {
      setLoading(true);
      const res = await apiFetch(`/landlord/tenancies/${tenancyId}/overview`);
      if (!res.ok) throw new Error('Failed to load tenancy details');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading tenancy details...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      </div>
    );
  }

  const { tenancy, wallet, walletTransactions, bills, payments } = data || {};
  const tenant = tenancy?.tenants;
  const unit = tenancy?.units;
  const property = tenancy?.properties;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800">
          <div className="text-2xl font-bold text-sky-400">RentPay</div>
          <div className="text-xs text-slate-400 mt-1">Landlord Portal</div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 text-sm">
          <SidebarLink label="Dashboard" />
          <SidebarLink label="Properties & Units" />
          <SidebarLink label="Tenants & Tenancies" active />
        </nav>
      </aside>

      <main className="flex-1 p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              {tenant?.full_name || 'Tenant'} – {unit?.unit_code}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {property?.name} • {property?.location}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Tenant & Tenancy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-500 text-xs uppercase mb-1">Tenant</div>
                <div className="font-medium text-slate-900">{tenant?.full_name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Phone: {tenant?.phone || '-'}
                  <br />
                  Email: {tenant?.email || '-'}
                  <br />
                  ID: {tenant?.id_number || '-'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs uppercase mb-1">Tenancy</div>
                <div className="text-sm text-slate-800">
                  Status: <StatusPill status={tenancy?.status} />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Start: {formatDate(tenancy?.start_date)}
                  <br />
                  Rent: {formatCurrency(tenancy?.rent_amount)}
                  <br />
                  Deposit: {formatCurrency(tenancy?.deposit_amount)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Wallet</h2>
            {wallet ? (
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Account Reference</div>
                  <div className="font-mono text-slate-900">{wallet.account_reference}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Paybill: <span className="font-mono">123456</span> (example)
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Balance</div>
                  <div className="text-xl font-semibold text-slate-900">
                    {formatCurrency(wallet.balance)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Status: <StatusPill status={wallet.status} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                No wallet found. Tenancy may not be fully set up.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Wallet Transactions</h2>
            {walletTransactions?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70">
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Source</Th>
                      <Th align="right">Amount</Th>
                      <Th>Receipt</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                        <Td>{formatDateTime(tx.created_at)}</Td>
                        <Td>
                          <StatusPill status={tx.type} />
                        </Td>
                        <Td className="text-xs">{tx.source}</Td>
                        <Td align="right">
                          {tx.type === 'credit' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </Td>
                        <Td className="text-xs">
                          {tx.mpesa_receipt || <span className="text-slate-400">-</span>}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No wallet transactions yet.</div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Bills & Payments</h2>
            {bills?.length ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70">
                        <Th>Period</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Paid</Th>
                        <Th align="right">Balance</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b) => {
                        const balance = Number(b.total_amount) - Number(b.amount_paid);
                        return (
                          <tr key={b.id} className="border-b border-slate-100 last:border-0">
                            <Td>{b.billing_period}</Td>
                            <Td align="right">{formatCurrency(b.total_amount)}</Td>
                            <Td align="right">{formatCurrency(b.amount_paid)}</Td>
                            <Td align="right">{formatCurrency(balance)}</Td>
                            <Td>
                              <StatusPill status={b.status} />
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Recent Payments</h3>
                  {payments?.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/70">
                            <Th>Date</Th>
                            <Th align="right">Amount</Th>
                            <Th>Method</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.id} className="border-b border-slate-100 last:border-0">
                              <Td>{formatDateTime(p.paid_at)}</Td>
                              <Td align="right">{formatCurrency(p.amount)}</Td>
                              <Td>{p.method}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      No payments recorded yet for this tenancy.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No bills generated yet.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ label, active }) {
  return (
    <button
      className={[
        'w-full text-left px-3 py-2 rounded-md transition',
        active
          ? 'bg-sky-500 text-white font-medium shadow-sm'
          : 'text-slate-200 hover:bg-slate-800 hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
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

  if (normalized === 'active' || normalized === 'credit') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (normalized === 'debit' || normalized === 'overdue') {
    colors = 'bg-red-50 text-red-700 border-red-100';
  } else if (normalized === 'partial') {
    colors = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (normalized === 'pending' || normalized === 'open') {
    colors = 'bg-sky-50 text-sky-700 border-sky-100';
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

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default TenantTenancyDetails;
