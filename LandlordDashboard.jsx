import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function LandlordDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [billingPeriod, setBillingPeriod] = useState(getCurrentBillingPeriod());
  const [leads, setLeads] = useState([]);
  const [leadError, setLeadError] = useState('');
  const [leadLoading, setLeadLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, billingPeriod]);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (selectedPropertyId !== 'all') {
        params.set('propertyId', selectedPropertyId);
      }
      if (billingPeriod) {
        params.set('billingPeriod', billingPeriod);
      }

      const res = await apiFetch(`/landlord/dashboard?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load dashboard');
      }
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeads() {
    try {
      setLeadLoading(true);
      setLeadError('');
      const res = await apiFetch(`/landlord/tenant-leads`);
      if (!res.ok) throw new Error('Failed to load leads');
      const json = await res.json();
      setLeads(json.leads || []);
    } catch (err) {
      console.error(err);
      setLeadError(err.message || 'Failed to load leads');
    } finally {
      setLeadLoading(false);
    }
  }

  async function handleApproveLead(id) {
    try {
      const res = await apiFetch(`/landlord/tenant-leads/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Approve failed');
      }
      await fetchLeads();
    } catch (err) {
      alert(err.message || 'Failed to approve lead');
    }
  }

  async function handleRejectLead(id) {
    try {
      const res = await apiFetch(`/landlord/tenant-leads/${id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Reject failed');
      }
      await fetchLeads();
    } catch (err) {
      alert(err.message || 'Failed to reject lead');
    }
  }

  function handlePropertyChange(e) {
    setSelectedPropertyId(e.target.value);
  }

  function handleBillingPeriodChange(e) {
    setBillingPeriod(e.target.value);
  }

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded">{error}</div>
      </div>
    );
  }

  const summary = dashboard?.summary || {
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    expectedThisMonth: 0,
    collectedThisMonth: 0,
    outstandingThisMonth: 0,
    overdueCount: 0,
    openTicketsCount: 0,
  };

  return (
    <div className="page">
      <div className="hero">
        <h1 className="hero-title">Landlord Dashboard</h1>
        <p className="hero-subtitle">Sky-blue overview of your properties, collections, and tenant activity.</p>
      </div>

      <div className="card-glass" style={{ marginBottom: 12 }}>
        <div className="form-grid">
          <div>
            <label className="helper">Property</label>
            <select className="input" value={selectedPropertyId} onChange={handlePropertyChange}>
              <option value="all">All properties</option>
              {dashboard?.properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="helper">Billing Period</label>
            <input type="month" className="input" value={billingPeriod} onChange={handleBillingPeriodChange} />
          </div>
          {error && <div className="helper" style={{ color: '#b91c1c', gridColumn: '1 / -1' }}>{error}</div>}
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 12 }}>
        <div className="card-glass">
          <StatCard
            label="Total Units"
            value={summary.totalUnits}
            description={`${summary.occupiedUnits} occupied / ${summary.vacantUnits} vacant`}
          />
        </div>
        <div className="card-glass">
          <StatCard
            label="Expected This Period"
            value={formatCurrency(summary.expectedThisMonth)}
            description="Based on active tenancies"
          />
        </div>
        <div className="card-glass">
          <StatCard
            label="Collected So Far"
            value={formatCurrency(summary.collectedThisMonth)}
            description={`Outstanding: ${formatCurrency(summary.outstandingThisMonth)}`}
          />
        </div>
        <div className="card-glass">
          <StatCard
            label="Overdue & Issues"
            value={`${summary.overdueCount} overdue`}
            description={`${summary.openTicketsCount} open issues`}
          />
        </div>
      </div>

      <SectionCard title="Properties & Occupancy">
        {dashboard?.properties?.length ? (
          <div className="table-wrap">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <Th>Property</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Occupied</Th>
                  <Th align="right">Vacant</Th>
                  <Th align="right">Occupancy</Th>
                </tr>
              </thead>
              <tbody>
                {dashboard.properties.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td align="right">{p.totalUnits}</Td>
                    <Td align="right">{p.occupiedUnits}</Td>
                    <Td align="right">{p.vacantUnits}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-slate-700 font-medium">{p.occupancyPercent}%</span>
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-2 bg-sky-500 rounded-full" style={{ width: `${p.occupancyPercent}%` }} />
                        </div>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No properties found yet. Start by registering a property." />
        )}
      </SectionCard>

      <div className="form-grid" style={{ marginTop: 18 }}>
        <div className="card-glass">
          <SectionCard title="Bills & Collections (Current Period)">
            {dashboard?.overdueBills?.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <Th>Tenant</Th>
                      <Th>Unit</Th>
                      <Th>Period</Th>
                      <Th align="right">Total</Th>
                      <Th align="right">Paid</Th>
                      <Th align="right">Balance</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.overdueBills.slice(0, 8).map((b) => (
                      <tr key={b.id}>
                        <Td>
                          <div className="stack">
                            <span className="font-medium text-slate-800">{b.tenantName || 'Unknown'}</span>
                            <span className="text-xs text-slate-500">{b.propertyName || ''}</span>
                          </div>
                        </Td>
                        <Td>{b.unitCode}</Td>
                        <Td>{b.billingPeriod}</Td>
                        <Td align="right">{formatCurrency(b.totalAmount)}</Td>
                        <Td align="right">{formatCurrency(b.amountPaid)}</Td>
                        <Td align="right">{formatCurrency(b.balance)}</Td>
                        <Td>
                          <StatusPill status={b.status} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No unpaid or overdue bills for this period. Nice." />
            )}
          </SectionCard>

          <SectionCard title="Recent Payments">
            {dashboard?.recentPayments?.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Tenant</Th>
                      <Th>Unit</Th>
                      <Th>Period</Th>
                      <Th align="right">Amount</Th>
                      <Th>Method</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentPayments.slice(0, 8).map((p) => (
                      <tr key={p.id}>
                        <Td>{formatDateTime(p.paidAt)}</Td>
                        <Td>{p.tenantName || 'Unknown'}</Td>
                        <Td>{p.unitCode}</Td>
                        <Td>{p.billingPeriod}</Td>
                        <Td align="right">{formatCurrency(p.amount)}</Td>
                        <Td>
                          <span className="badge badge-muted">{p.method === 'wallet_auto' ? 'Wallet (Auto)' : p.method}</span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No payments recorded yet for this period." />
            )}
          </SectionCard>
        </div>

        <div className="card-glass">
          <SectionCard title="Open Issues & Maintenance">
            {dashboard?.openTickets?.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <Th>Title</Th>
                      <Th>Property</Th>
                      <Th>Unit</Th>
                      <Th>Priority</Th>
                      <Th>Status</Th>
                      <Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.openTickets.slice(0, 8).map((t) => (
                      <tr key={t.id}>
                        <Td className="max-w-[180px]">
                          <span className="line-clamp-2">{t.title}</span>
                        </Td>
                        <Td>{t.propertyName}</Td>
                        <Td>{t.unitCode}</Td>
                        <Td>
                          <PriorityPill priority={t.priority} />
                        </Td>
                        <Td>
                          <StatusPill status={t.status} />
                        </Td>
                        <Td>{formatDate(t.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No open issues at the moment." />
            )}
          </SectionCard>

          <SectionCard title="Active Vacate Requests">
            {dashboard?.vacateRequests?.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <Th>Tenant</Th>
                      <Th>Property</Th>
                      <Th>Unit</Th>
                      <Th>Move-out Date</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.vacateRequests.slice(0, 8).map((v) => (
                      <tr key={v.id}>
                        <Td>{v.tenantName}</Td>
                        <Td>{v.propertyName}</Td>
                        <Td>{v.unitCode}</Td>
                        <Td>{formatDate(v.requestedMoveOutDate)}</Td>
                        <Td>
                          <StatusPill status={v.status} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No active vacate requests at the moment." />
            )}
          </SectionCard>

          <SectionCard title="Tenant Leads (approval)">
            {leadError && <div className="text-xs text-red-600 mb-2">{leadError}</div>}
            {leadLoading ? (
              <div className="text-sm text-slate-500">Loading leads...</div>
            ) : leads?.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Contact</Th>
                      <Th>Property</Th>
                      <Th>Unit</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <Td>{lead.full_name}</Td>
                        <Td>
                          <div className="stack">
                            <span>{lead.phone}</span>
                            <span className="text-[11px] text-slate-500">{lead.email || ''}</span>
                          </div>
                        </Td>
                        <Td>
                          {(dashboard?.properties || []).find((p) => p.id === lead.property_id)?.name || lead.property_id}
                        </Td>
                        <Td>{lead.unit_id || '—'}</Td>
                        <Td>
                          <StatusPill status={lead.status} />
                        </Td>
                        <Td>
                          {lead.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button className="badge badge-success" onClick={() => handleApproveLead(lead.id)}>
                                Approve
                              </button>
                              <button className="badge badge-muted" onClick={() => handleRejectLead(lead.id)}>
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Completed</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No leads from caretakers yet." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Small UI helpers ----------------- */

function SidebarLink({ label, active }) {
  return (
    <button
      className={[
        'w-full text-left px-3 py-2 rounded-md transition',
        active ? 'bg-sky-500 text-white font-medium shadow-sm' : 'text-slate-200 hover:bg-slate-800 hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, description }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-4 sm:px-5 sm:py-5 flex flex-col justify-between">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="py-6 flex flex-col items-center justify-center text-center text-sm text-slate-500">
      <div className="w-10 h-10 mb-2 rounded-full bg-sky-50 flex items-center justify-center">
        <span className="text-sky-500 text-lg">i</span>
      </div>
      <p>{message}</p>
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
  } else if (normalized === 'open' || normalized === 'pending') {
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

function PriorityPill({ priority }) {
  const normalized = (priority || '').toLowerCase();
  let colors = 'bg-slate-50 text-slate-700 border-slate-200';

  if (normalized === 'high') {
    colors = 'bg-red-50 text-red-700 border-red-100';
  } else if (normalized === 'medium') {
    colors = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (normalized === 'low') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        colors,
      ].join(' ')}
    >
      {priority || 'N/A'}
    </span>
  );
}

/* ----------------- Format helpers ----------------- */

function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `KES ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCurrentBillingPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`; // YYYY-MM for <input type="month">
}

export default LandlordDashboard;
