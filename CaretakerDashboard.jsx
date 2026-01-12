import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function CaretakerDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertyUnits, setPropertyUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [unitId, setUnitId] = useState('');
  const [readingDate, setReadingDate] = useState('');
  const [readingValue, setReadingValue] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [waterMessage, setWaterMessage] = useState('');
  const [waterSubmitting, setWaterSubmitting] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      loadUnitsForProperty(selectedPropertyId);
    } else {
      setPropertyUnits([]);
      setUnitId('');
    }
  }, [selectedPropertyId]);

  async function loadOverview() {
    try {
      setLoading(true);
      const res = await apiFetch(`/caretaker/overview`);
      if (!res.ok) throw new Error('Failed to load caretaker dashboard');
      const json = await res.json();
      setOverview(json);
      if (json.properties?.length) {
        setSelectedPropertyId(json.properties[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function loadUnitsForProperty(propertyId) {
    try {
      setUnitsLoading(true);
      const res = await apiFetch(`/caretaker/properties`);
      if (!res.ok) throw new Error('Failed to load caretaker properties');
      const json = await res.json();
      const units = (json.units || []).filter((u) => u.property_id === Number(propertyId));
      setPropertyUnits(units);
      if (units.length) setUnitId(units[0].id);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load units');
    } finally {
      setUnitsLoading(false);
    }
  }

  async function handleWaterSubmit(e) {
    e.preventDefault();
    if (!selectedPropertyId || !unitId || !readingDate || !readingValue) {
      setWaterMessage('Please fill all required fields.');
      return;
    }

    try {
      setWaterSubmitting(true);
      setWaterMessage('');
      const res = await apiFetch(`/caretaker/water-logs`, {
        method: 'POST',
        body: JSON.stringify({
          propertyId: Number(selectedPropertyId),
          unitId: Number(unitId),
          readingDate,
          readingValue: Number(readingValue),
          pricePerUnit: pricePerUnit ? Number(pricePerUnit) : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save water reading');
      }

      setWaterMessage(
        `Saved. Units used: ${json.unitsUsed}, amount: ${formatCurrency(json.amount)} (${json.billingPeriod}).`
      );
      setReadingValue('');
    } catch (err) {
      console.error(err);
      setWaterMessage(err.message || 'Failed to save reading');
    } finally {
      setWaterSubmitting(false);
    }
  }

  async function updateTicketStatus(ticketId, status) {
    try {
      const res = await apiFetch(`/caretaker/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update status');
      await loadOverview();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update status');
    }
  }

  if (loading && !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading caretaker dashboard...</div>
      </div>
    );
  }

  const summary = overview?.summary || {
    totalUnits: 0,
    occupiedUnits: 0,
    openTicketsCount: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <main className="flex-1 max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Caretaker Panel</h1>
            <p className="text-sm text-slate-500">
              Manage your properties, record water readings, and handle tenant issues.
            </p>
          </div>
          {overview?.caretaker && (
            <div className="text-right text-xs text-slate-500">
              Logged in as
              <div className="font-medium text-slate-800">{overview.caretaker.full_name}</div>
              <div>{overview.caretaker.phone}</div>
            </div>
          )}
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Units Under You"
            value={summary.totalUnits}
            description={`${summary.occupiedUnits} occupied`}
          />
          <StatCard label="Open Issues" value={summary.openTicketsCount} description="Tenant tickets to handle" />
          <StatCard
            label="Assigned Properties"
            value={overview?.properties?.length || 0}
            description="Buildings you manage"
          />
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify_between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Your Properties</h2>
            </div>
            {overview?.properties?.length ? (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1 text-sm">
                {overview.properties.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedPropertyId(p.id)}
                      className={[
                        'w-full text-left px-3 py-2 rounded-lg border transition flex flex-col',
                        p.id === Number(selectedPropertyId)
                          ? 'border-sky-500 bg-sky-50/70 text-sky-800'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.location && <span className="text-xs text-slate-500 mt-0.5">{p.location}</span>}
                      <span className="text-xs text-slate-500 mt-1">
                        {p.totalUnits} units • {p.occupiedUnits} occupied • {p.vacantUnits} vacant
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">No properties assigned.</div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Record Water Reading</h2>
            {selectedPropertyId ? (
              <form onSubmit={handleWaterSubmit} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Unit</label>
                  {unitsLoading ? (
                    <div className="text-xs text-slate-500">Loading units...</div>
                  ) : propertyUnits.length ? (
                    <select
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      value={unitId}
                      onChange={(e) => setUnitId(e.target.value)}
                    >
                      {propertyUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.unit_code} ({u.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-slate-500">No units found for this property.</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Reading Date</label>
                    <input
                      type="date"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      value={readingDate}
                      onChange={(e) => setReadingDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Reading Value</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      value={readingValue}
                      onChange={(e) => setReadingValue(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Price Per Unit (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    placeholder="e.g. 50"
                  />
                </div>

                {waterMessage && <div className="text-xs text-slate-500">{waterMessage}</div>}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={waterSubmitting || !unitId}
                    className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  >
                    {waterSubmitting ? 'Saving...' : 'Save Reading'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-sm text-slate-500">Select a property on the left to start recording readings.</div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Tenant Issues</h2>
            {overview?.openTickets?.length ? (
              <div className="space-y-2 text-sm">
                {overview.openTickets.map((t) => (
                  <div
                    key={t.id}
                    className="border border-slate-100 rounded-lg px-3 py-2 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-800">{t.title}</div>
                      <div className="flex items-center gap-2">
                        <PriorityPill priority={t.priority} />
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.propertyName} • {t.unitCode && `Unit ${t.unitCode}`} • {formatDate(t.createdAt)}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => updateTicketStatus(t.id, 'in_progress')}
                        className="text-[11px] px-2 py-1 rounded border border-sky-200 text-sky-700 hover:bg-sky-50"
                      >
                        Mark in progress
                      </button>
                      <button
                        onClick={() => updateTicketStatus(t.id, 'resolved')}
                        className="text-[11px] px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No open issues. Good job 👍</div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Recent Water Readings</h2>
            {overview?.recentWaterLogs?.length ? (
              <div className="overflow-x-auto text-xs sm:text-sm">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70">
                      <Th>Date</Th>
                      <Th>Property</Th>
                      <Th>Unit</Th>
                      <Th align="right">Units</Th>
                      <Th align="right">Amount</Th>
                      <Th>Period</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentWaterLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 last:border-0">
                        <Td>{formatDate(log.readingDate)}</Td>
                        <Td>{log.propertyName}</Td>
                        <Td>{log.unitCode}</Td>
                        <Td align="right">{log.unitsUsed}</Td>
                        <Td align="right">{formatCurrency(log.amount)}</Td>
                        <Td>{log.billingPeriod}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No readings recorded yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, description }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-4 flex flex-col">
      <div className="text-xs font-medium text-slate-500 uppercase">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
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
  if (normalized === 'open') {
    colors = 'bg-sky-50 text-sky-700 border-sky-100';
  } else if (normalized === 'in_progress') {
    colors = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (normalized === 'resolved') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
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
      {priority}
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

export default CaretakerDashboard;
