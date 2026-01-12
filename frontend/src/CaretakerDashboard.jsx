
import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function CaretakerDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState('overview'); // overview | water | issues | leads | announcements

  const [propertyOptions, setPropertyOptions] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [waterForm, setWaterForm] = useState({ readingDate: '', readingValue: '', pricePerUnit: '' });
  const [waterMessage, setWaterMessage] = useState('');
  const [waterSubmitting, setWaterSubmitting] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState('');

  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadForm, setLeadForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
    propertyId: '',
    unitId: '',
  });
  const [leadMessage, setLeadMessage] = useState('');

  useEffect(() => {
    initialLoad();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) {
      setUnitOptions([]);
      setSelectedUnitId('');
      return;
    }
    const units = allUnits.filter((u) => u.property_id === Number(selectedPropertyId));
    setUnitOptions(units);
    if (!units.find((u) => u.id === Number(selectedUnitId))) {
      setSelectedUnitId(units[0]?.id ? String(units[0].id) : '');
    }
  }, [selectedPropertyId, allUnits, selectedUnitId]);

  async function initialLoad() {
    try {
      setLoading(true);
      await Promise.all([loadOverview(), loadProperties(), loadTickets(), loadLeads()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadOverview() {
    try {
      const res = await apiFetch(`/caretaker/overview`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load caretaker dashboard');
      setOverview(json);
      if (!selectedPropertyId && json.properties?.length) {
        setSelectedPropertyId(String(json.properties[0].id));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    }
  }

  async function loadProperties() {
    try {
      setUnitsLoading(true);
      const res = await apiFetch(`/caretaker/properties`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load caretaker properties');
      setPropertyOptions(json.properties || []);
      setAllUnits(json.units || []);
      if (!selectedPropertyId && json.properties?.length) {
        setSelectedPropertyId(String(json.properties[0].id));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load properties');
    } finally {
      setUnitsLoading(false);
    }
  }

  async function loadTickets() {
    try {
      setTicketsLoading(true);
      setTicketError('');
      const res = await apiFetch(`/caretaker/tickets`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load issues');
      const list = json.tickets || [];
      setTickets(list);

      let toSelect = selectedTicketId;
      const firstId = list[0]?.id || null;
      if (toSelect && !list.find((t) => t.id === toSelect)) {
        toSelect = firstId;
      }
      if (!toSelect && firstId) {
        toSelect = firstId;
      }

      setSelectedTicketId(toSelect);
      if (toSelect) {
        loadMessages(toSelect);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
      setTicketError(err.message || 'Failed to load issues');
    } finally {
      setTicketsLoading(false);
    }
  }

  async function loadLeads() {
    try {
      setLeadsLoading(true);
      const res = await apiFetch(`/caretaker/tenant-leads`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load leads');
      setLeads(json.leads || []);
    } catch (err) {
      console.error(err);
      setLeadMessage(err.message || 'Failed to load leads');
    } finally {
      setLeadsLoading(false);
    }
  }

  async function loadMessages(ticketId) {
    if (!ticketId) return;
    try {
      setMessagesLoading(true);
      setMessageError('');
      const res = await apiFetch(`/caretaker/tickets/${ticketId}/messages`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load messages');
      setMessages(json.messages || []);
    } catch (err) {
      console.error(err);
      setMessageError(err.message || 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleWaterSubmit(e) {
    e.preventDefault();
    if (!selectedPropertyId || !selectedUnitId || !waterForm.readingDate || !waterForm.readingValue) {
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
          unitId: Number(selectedUnitId),
          readingDate: waterForm.readingDate,
          readingValue: Number(waterForm.readingValue),
          pricePerUnit: waterForm.pricePerUnit ? Number(waterForm.pricePerUnit) : 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save water reading');
      }
      setWaterMessage(
        `Saved. Units used: ${json.unitsUsed}, amount: ${formatCurrency(json.amount)} (${json.billingPeriod}).`
      );
      setWaterForm({ ...waterForm, readingValue: '' });
      loadOverview();
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
      await Promise.all([loadTickets(), loadOverview()]);
    } catch (err) {
      console.error(err);
      setTicketError(err.message || 'Failed to update status');
    }
  }

  function handleSelectTicket(ticketId, goToIssues = false) {
    setSelectedTicketId(ticketId);
    loadMessages(ticketId);
    if (goToIssues) setTab('issues');
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!selectedTicketId) {
      setMessageError('Select an issue first.');
      return;
    }
    if (!messageText.trim()) {
      setMessageError('Please type a reply.');
      return;
    }
    try {
      setMessageError('');
      const res = await apiFetch(`/caretaker/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: messageText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to send message');
      setMessageText('');
      loadMessages(selectedTicketId);
    } catch (err) {
      console.error(err);
      setMessageError(err.message || 'Failed to send message');
    }
  }

  async function handleLeadSubmit(e) {
    e.preventDefault();
    if (!leadForm.fullName || !leadForm.phone || !leadForm.propertyId) {
      setLeadMessage('Full name, phone, and property are required.');
      return;
    }
    try {
      setLeadMessage('');
      const res = await apiFetch(`/caretaker/tenant-leads`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: leadForm.fullName,
          phone: leadForm.phone,
          email: leadForm.email,
          notes: leadForm.notes,
          propertyId: Number(leadForm.propertyId),
          unitId: leadForm.unitId ? Number(leadForm.unitId) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to save lead');
      setLeadMessage('Lead captured.');
      setLeadForm({ fullName: '', phone: '', email: '', notes: '', propertyId: '', unitId: '' });
      loadLeads();
    } catch (err) {
      console.error(err);
      setLeadMessage(err.message || 'Failed to save lead');
    }
  }

  const summary = overview?.summary || {
    totalUnits: 0,
    occupiedUnits: 0,
    openTicketsCount: 0,
  };


  if (loading && !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading caretaker dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Caretaker console</p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Daily operations</h1>
          <p className="text-sm text-slate-500">Stay on top of issues, readings, and new tenant leads.</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div className="font-semibold text-slate-800">{overview?.caretaker?.full_name || 'Caretaker'}</div>
          <div>{overview?.caretaker?.phone}</div>
          <div className="text-xs mt-1">{formatDateTime(now)}</div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <TabButton label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
        <TabButton label="Water" active={tab === 'water'} onClick={() => setTab('water')} />
        <TabButton label="Issues" active={tab === 'issues'} onClick={() => setTab('issues')} />
        <TabButton label="Leads" active={tab === 'leads'} onClick={() => setTab('leads')} />
        <TabButton label="Announcements" active={tab === 'announcements'} onClick={() => setTab('announcements')} />
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <StatCard label="Units under you" value={summary.totalUnits} description={`${summary.occupiedUnits} occupied`} />
            <StatCard label="Open issues" value={summary.openTicketsCount} description="Tickets needing attention" />
            <StatCard
              label="Assigned properties"
              value={overview?.properties?.length || 0}
              description="Buildings you manage"
            />
            <StatCard label="Latest log" value={overview?.recentWaterLogs?.[0]?.billingPeriod || '--'} description="Water period" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Your properties</h2>
                <div className="text-xs text-slate-500">{overview?.properties?.length || 0} active</div>
              </div>
              {overview?.properties?.length ? (
                <div className="space-y-2">
                  {overview.properties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPropertyId(String(p.id))}
                      className={[
                        'w-full text-left px-3 py-2 rounded-lg border transition flex flex-col',
                        selectedPropertyId === String(p.id)
                          ? 'border-sky-500 bg-sky-50 text-sky-800'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-[11px] text-slate-500">{p.location || 'Unknown location'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {p.totalUnits} units - {p.occupiedUnits} occupied - {p.vacantUnits} vacant
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No properties assigned.</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Open issues</h2>
                <button
                  className="text-xs text-sky-700 hover:text-sky-800"
                  onClick={() => setTab('issues')}
                >
                  Go to issues
                </button>
              </div>
              {overview?.openTickets?.length ? (
                <div className="space-y-2">
                  {overview.openTickets.map((t) => (
                    <div
                      key={t.id}
                      className="border border-slate-100 rounded-lg px-3 py-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-800">{t.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {t.propertyName || 'Property'} {t.unitCode ? `- Unit ${t.unitCode}` : ''} -{' '}
                            {formatDate(t.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <PriorityPill priority={t.priority} />
                          <StatusPill status={t.status} />
                        </div>
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <button
                          onClick={() => handleSelectTicket(t.id, true)}
                          className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          Open thread
                        </button>
                        <button
                          onClick={() => updateTicketStatus(t.id, 'in_progress')}
                          className="px-2 py-1 rounded border border-sky-200 text-sky-700 hover:bg-sky-50"
                        >
                          Mark in progress
                        </button>
                        <button
                          onClick={() => updateTicketStatus(t.id, 'resolved')}
                          className="px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          Mark resolved
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No open issues.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Recent water readings</h2>
              <button
                className="text-xs text-sky-700 hover:text-sky-800"
                onClick={() => setTab('water')}
              >
                Log water reading
              </button>
            </div>
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
        </div>
      )}

      {tab === 'water' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Record water reading</h2>
              {waterMessage && <div className="text-[11px] text-slate-500">{waterMessage}</div>}
            </div>
            <form onSubmit={handleWaterSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Property</label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                  >
                    <option value="">Select property</option>
                    {propertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Unit</label>
                  {unitsLoading ? (
                    <div className="text-xs text-slate-500">Loading units...</div>
                  ) : (
                    <select
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                    >
                      <option value="">Select unit</option>
                      {unitOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.unit_code} ({u.type})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Reading date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={waterForm.readingDate}
                    onChange={(e) => setWaterForm({ ...waterForm, readingDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Reading value</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={waterForm.readingValue}
                    onChange={(e) => setWaterForm({ ...waterForm, readingValue: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Price per unit (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={waterForm.pricePerUnit}
                  onChange={(e) => setWaterForm({ ...waterForm, pricePerUnit: e.target.value })}
                  placeholder="e.g. 50"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={waterSubmitting || !selectedUnitId}
                  className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                >
                  {waterSubmitting ? 'Saving...' : 'Save reading'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Recent readings</h2>
            {overview?.recentWaterLogs?.length ? (
              <div className="space-y-2 text-sm max-h-[420px] overflow-y-auto pr-1">
                {overview.recentWaterLogs.map((log) => (
                  <div key={log.id} className="border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800">
                        {log.propertyName} {log.unitCode ? `- ${log.unitCode}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(log.readingDate)} - {log.billingPeriod}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <div className="font-semibold text-slate-800">{log.unitsUsed} units</div>
                      <div>{formatCurrency(log.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No readings yet.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">All tickets</h2>
              <button
                className="text-xs text-sky-700 hover:text-sky-800"
                onClick={() => loadTickets()}
              >
                Refresh
              </button>
            </div>
            {ticketError && <div className="text-xs text-red-600">{ticketError}</div>}
            {ticketsLoading ? (
              <div className="text-sm text-slate-500">Loading issues...</div>
            ) : tickets.length ? (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className={[
                      'border rounded-lg px-3 py-2 flex flex-col gap-1 cursor-pointer',
                      selectedTicketId === t.id ? 'border-sky-400 bg-sky-50' : 'border-slate-100 bg-white hover:bg-slate-50',
                    ].join(' ')}
                    onClick={() => handleSelectTicket(t.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-800">{t.title}</div>
                      <div className="flex items-center gap-2">
                        <PriorityPill priority={t.priority} />
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.propertyName || 'Property'} {t.unitCode ? `- ${t.unitCode}` : ''} -{' '}
                      {t.tenantName ? `Tenant: ${t.tenantName} - ` : ''}
                      {formatDate(t.createdAt)}
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTicketStatus(t.id, 'in_progress');
                        }}
                        className="px-2 py-1 rounded border border-sky-200 text-sky-700 hover:bg-sky-50"
                      >
                        Mark in progress
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTicketStatus(t.id, 'resolved');
                        }}
                        className="px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No tickets found.</div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Ticket thread</h2>
              {selectedTicketId && (
                <div className="text-[11px] text-slate-500">Ticket #{selectedTicketId}</div>
              )}
            </div>
            {messagesLoading ? (
              <div className="text-sm text-slate-500">Loading messages...</div>
            ) : selectedTicketId ? (
              <>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {messages.length ? (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className="border border-slate-100 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {formatSender(m.sender_type)}
                          </span>
                          <span className="text-[11px] text-slate-500">{formatDateTime(m.created_at)}</span>
                        </div>
                        <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{m.message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No messages yet.</div>
                  )}
                </div>
                <form onSubmit={sendMessage} className="space-y-2">
                  <textarea
                    rows="3"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Reply to tenant..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                  {messageError && <div className="text-xs text-red-600">{messageError}</div>}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700"
                    >
                      Send reply
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-sm text-slate-500">Select a ticket to view and reply.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Capture tenant lead</h2>
            <form onSubmit={handleLeadSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Full name</label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={leadForm.fullName}
                    onChange={(e) => setLeadForm({ ...leadForm, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Property</label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    value={leadForm.propertyId}
                    onChange={(e) => setLeadForm({ ...leadForm, propertyId: e.target.value, unitId: '' })}
                  >
                    <option value="">Select property</option>
                    {propertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Unit (optional)</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={leadForm.unitId}
                  onChange={(e) => setLeadForm({ ...leadForm, unitId: e.target.value })}
                >
                  <option value="">Select unit</option>
                  {allUnits
                    .filter((u) => u.property_id === Number(leadForm.propertyId))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_code} ({u.status})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Notes</label>
                <textarea
                  rows="3"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                />
              </div>
              {leadMessage && <div className="text-xs text-slate-600">{leadMessage}</div>}
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700"
              >
                Save lead
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Recent leads</h2>
              <button
                className="text-xs text-sky-700 hover:text-sky-800"
                onClick={() => loadLeads()}
              >
                Refresh
              </button>
            </div>
            {leadsLoading ? (
              <div className="text-sm text-slate-500">Loading leads...</div>
            ) : leads.length ? (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {leads.map((lead) => (
                  <div key={lead.id} className="border border-slate-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-800">{lead.full_name}</div>
                      <StatusPill status={lead.status || 'pending'} />
                    </div>
                    <div className="text-xs text-slate-500">{lead.phone} {lead.email ? ` - ${lead.email}` : ''}</div>
                    <div className="text-xs text-slate-500">
                      {propertyName(lead.property_id)} {lead.unit_id ? ` - ${unitCode(lead.unit_id)}` : ''}
                    </div>
                    {lead.notes && <div className="text-sm text-slate-700 mt-1">{lead.notes}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(lead.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No leads captured yet.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">Announcements</h2>
          <p className="text-sm text-slate-600">
            Announcement posting and scheduling for caretakers will live here. For now, manage announcements from the landlord
            dashboard.
          </p>
        </div>
      )}
    </div>
  );

  function propertyName(id) {
    if (!id) return 'Property';
    return propertyOptions.find((p) => p.id === id)?.name || 'Property';
  }

  function unitCode(id) {
    if (!id) return 'Unit';
    return allUnits.find((u) => u.id === id)?.unit_code || 'Unit';
  }
}


function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-full text-sm border transition',
        active ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
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

function formatSender(senderType) {
  if (!senderType) return 'User';
  if (senderType === 'tenant') return 'Tenant';
  if (senderType === 'landlord') return 'Landlord';
  if (senderType === 'caretaker') return 'Caretaker';
  return senderType;
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
  return `${d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`;
}

export default CaretakerDashboard;
