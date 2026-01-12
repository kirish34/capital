import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';
import { supabase } from './lib/supabaseClient.js';

function LandlordDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [billingPeriod, setBillingPeriod] = useState(getCurrentBillingPeriod());
  const [userName, setUserName] = useState('Landlord');
  const [tab, setTab] = useState('overview'); // overview | properties | tenants | tenantBills
  const [now, setNow] = useState(new Date());
  const [tenantList, setTenantList] = useState([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [tenantForm, setTenantForm] = useState({ fullName: '', phone: '', email: '', idNumber: '', kraPin: '', propertyId: '', unitId: '' });
  const [tenantMessage, setTenantMessage] = useState('');
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [unitOptions, setUnitOptions] = useState([]);
  const [loginTenantId, setLoginTenantId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [caretakers, setCaretakers] = useState([]);
  const [caretakerForm, setCaretakerForm] = useState({ fullName: '', phone: '', email: '', propertyIds: [] });
  const [caretakerMsg, setCaretakerMsg] = useState('');
  const [caretakerLogin, setCaretakerLogin] = useState({ id: '', email: '', password: '' });
  const [caretakerLoginMsg, setCaretakerLoginMsg] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', propertyId: '' });
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [listings, setListings] = useState([]);
  const [listingForm, setListingForm] = useState({ unitId: '', title: '', description: '', rentAmount: '' });
  const [listingMsg, setListingMsg] = useState('');
  const [applications, setApplications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentForm, setDocumentForm] = useState({ tenancyId: '', tenantId: '', type: '', fileUrl: '' });
  const [documentMsg, setDocumentMsg] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [ticketMessagesLoading, setTicketMessagesLoading] = useState(false);
  const [ticketMessageText, setTicketMessageText] = useState('');
  const [ticketMessageError, setTicketMessageError] = useState('');

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, billingPeriod]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email;
      const fullName = data?.user?.user_metadata?.full_name;
      const derived = fullName || (email ? email.split('@')[0] : 'Landlord');
      setUserName(derived);
    });
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === 'tenants') {
      fetchTenants();
      loadPropertiesAndUnits();
      fetchCaretakers();
    }
    if (tab === 'caretakers') {
      loadPropertiesAndUnits();
      fetchCaretakers();
    }
    if (tab === 'announcements') {
      loadPropertiesAndUnits();
      fetchAnnouncements();
    }
    if (tab === 'listings') {
      loadPropertiesAndUnits();
      fetchListings();
    }
    if (tab === 'applications') {
      fetchApplications();
    }
    if (tab === 'documents') {
      fetchDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const list = dashboard?.openTickets || [];
    if (!list.length) {
      setSelectedTicketId(null);
      setTicketMessages([]);
      return;
    }
    if (!selectedTicketId || !list.find((t) => t.id === selectedTicketId)) {
      setSelectedTicketId(list[0].id);
    }
  }, [dashboard?.openTickets, selectedTicketId]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketMessages(selectedTicketId);
    }
  }, [selectedTicketId]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);
      if (billingPeriod) params.set('billingPeriod', billingPeriod);
      const res = await apiFetch(`/landlord/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load dashboard');
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketMessages(ticketId) {
    if (!ticketId) return;
    try {
      setTicketMessagesLoading(true);
      setTicketMessageError('');
      const res = await apiFetch(`/landlord/tickets/${ticketId}/messages`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load messages');
      setTicketMessages(json.messages || []);
    } catch (err) {
      setTicketMessageError(err.message || 'Failed to load messages');
    } finally {
      setTicketMessagesLoading(false);
    }
  }

  async function fetchTenants() {
    try {
      setTenantLoading(true);
      setTenantError('');
      const res = await apiFetch('/landlord/tenants');
      if (!res.ok) throw new Error('Failed to load tenants');
      const data = await res.json();
      setTenantList(data.tenants || []);
    } catch (err) {
      setTenantError(err.message || 'Failed to load tenants');
    } finally {
      setTenantLoading(false);
    }
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    if (!tenantForm.fullName.trim() || !tenantForm.phone.trim()) {
      setTenantMessage('Name and phone are required.');
      return;
    }
    if (!tenantForm.propertyId || !tenantForm.unitId) {
      setTenantMessage('Select a property and a vacant unit for this tenant.');
      return;
    }
    try {
      setTenantMessage('Saving...');
      const res = await apiFetch('/landlord/tenants', {
        method: 'POST',
        body: JSON.stringify({
          fullName: tenantForm.fullName.trim(),
          phone: tenantForm.phone.trim(),
          email: tenantForm.email.trim() || null,
          idNumber: tenantForm.idNumber.trim() || null,
          kraPin: tenantForm.kraPin.trim() || null,
          propertyId: tenantForm.propertyId ? Number(tenantForm.propertyId) : null,
          unitId: tenantForm.unitId ? Number(tenantForm.unitId) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create tenant');
      setTenantMessage('Tenant saved.');
      setTenantForm({ fullName: '', phone: '', email: '', idNumber: '', kraPin: '', propertyId: '', unitId: '' });
      fetchTenants();
    } catch (err) {
      setTenantMessage(err.message || 'Failed to create tenant');
    }
  }

  async function handleSendTicketMessage(e) {
    e.preventDefault();
    if (!selectedTicketId) {
      setTicketMessageError('Select a ticket first.');
      return;
    }
    if (!ticketMessageText.trim()) {
      setTicketMessageError('Please type a reply.');
      return;
    }
    try {
      setTicketMessageError('');
      const res = await apiFetch(`/landlord/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: ticketMessageText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to send message');
      setTicketMessageText('');
      loadTicketMessages(selectedTicketId);
    } catch (err) {
      setTicketMessageError(err.message || 'Failed to send message');
    }
  }

  async function loadPropertiesAndUnits() {
    try {
      const res = await apiFetch('/landlord/properties');
      if (!res.ok) return;
      const data = await res.json();
      setPropertyOptions(data.properties || []);
      setUnitOptions(data.units || []);
    } catch (err) {
      console.error('Failed to load properties/units', err);
    }
  }

  async function fetchCaretakers() {
    try {
      const res = await apiFetch('/landlord/caretakers');
      if (!res.ok) return;
      const data = await res.json();
      setCaretakers(data.caretakers || []);
    } catch (err) {
      console.error('Failed to load caretakers', err);
    }
  }

  async function fetchAnnouncements() {
    try {
      const res = await apiFetch('/landlord/announcements');
      if (!res.ok) return;
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Failed to load announcements', err);
    }
  }

  async function fetchListings() {
    try {
      const res = await apiFetch('/landlord/public-listings');
      if (!res.ok) return;
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err) {
      console.error('Failed to load listings', err);
    }
  }

  async function fetchApplications() {
    try {
      const res = await apiFetch('/landlord/applications');
      if (!res.ok) return;
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (err) {
      console.error('Failed to load applications', err);
    }
  }

  async function fetchDocuments() {
    try {
      const res = await apiFetch('/landlord/documents');
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to load documents', err);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-glass" style={{ color: '#b91c1c' }}>{error}</div>
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

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="hero hero-banner">
        <p className="helper" style={{ fontWeight: 700, marginBottom: 4 }}>Capital Assets by SkyYalla Limited</p>
        <h1 className="hero-title">Landlord Console</h1>
        <p className="hero-subtitle">{greeting}, {userName}.</p>
        <p className="helper" style={{ marginTop: 4 }}>{dateStr} - {timeStr}</p>
      </div>

      <div className="tabs" style={{ marginTop: 14 }}>
        <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`tab-btn ${tab === 'properties' ? 'active' : ''}`} onClick={() => setTab('properties')}>
          Properties & Units
        </button>
        <button className={`tab-btn ${tab === 'tenants' ? 'active' : ''}`} onClick={() => setTab('tenants')}>
          Tenants Management
        </button>
        <button className={`tab-btn ${tab === 'tenantBills' ? 'active' : ''}`} onClick={() => setTab('tenantBills')}>
          Tenant Bills
        </button>
        <button className={`tab-btn ${tab === 'caretakers' ? 'active' : ''}`} onClick={() => setTab('caretakers')}>
          Caretakers
        </button>
        <button className={`tab-btn ${tab === 'announcements' ? 'active' : ''}`} onClick={() => setTab('announcements')}>
          Announcements
        </button>
        <button className={`tab-btn ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>
          Listings
        </button>
        <button className={`tab-btn ${tab === 'applications' ? 'active' : ''}`} onClick={() => setTab('applications')}>
          Applications
        </button>
        <button className={`tab-btn ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>
          Documents
        </button>
      </div>

      {tab === 'overview' && (
        <>
      <div className="card-glass" style={{ marginBottom: 12 }}>
        <div className="form-grid">
          <div>
            <label className="helper">Property</label>
            <select className="input" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
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
            <input type="month" className="input" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} />
          </div>
          {error && (
            <div className="helper" style={{ color: '#b91c1c', gridColumn: '1 / -1' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 12 }}>
        <div className="card-glass">
          <StatCard label="Total Units" value={summary.totalUnits} description={`${summary.occupiedUnits} occupied / ${summary.vacantUnits} vacant`} />
        </div>
        <div className="card-glass">
          <StatCard label="Expected This Period" value={formatCurrency(summary.expectedThisMonth)} description="Based on active tenancies" />
        </div>
        <div className="card-glass">
          <StatCard label="Collected So Far" value={formatCurrency(summary.collectedThisMonth)} description={`Outstanding: ${formatCurrency(summary.outstandingThisMonth)}`} />
        </div>
        <div className="card-glass">
          <StatCard label="Overdue & Issues" value={`${summary.overdueCount} overdue`} description={`${summary.openTicketsCount} open issues`} />
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

      <SectionCard title="Tenancies & Wallets">
        {dashboard?.tenancies?.length ? (
          <div className="table-wrap">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <Th>Tenant</Th>
                  <Th>Property</Th>
                  <Th>Unit</Th>
                  <Th>Status</Th>
                  <Th>Wallet A/C</Th>
                  <Th align="right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {dashboard.tenancies.map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <div className="stack">
                        <span className="font-medium text-slate-800">{t.tenantName || 'Tenant'}</span>
                        <span className="helper">{t.tenantPhone || ''}</span>
                      </div>
                    </Td>
                    <Td>{t.propertyName || '-'}</Td>
                    <Td>{t.unitCode || '-'}</Td>
                    <Td>
                      <StatusPill status={t.status} />
                    </Td>
                    <Td className="font-mono text-xs">{t.walletAccount || '-'}</Td>
                    <Td align="right">{formatCurrency(t.walletBalance)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No tenancies yet. Add tenants to units to see wallets." />
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
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 16 }}>
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
                      {dashboard.openTickets.slice(0, 8).map((t) => {
                        const isSelected = selectedTicketId === t.id;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTicketId(t.id)}
                            style={{ cursor: 'pointer', background: isSelected ? '#ecf5ff' : 'transparent' }}
                          >
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="card" style={{ padding: 12, background: '#0b12241a', borderRadius: 12 }}>
                  {selectedTicketId ? (
                    <>
                      {(() => {
                        const selected = dashboard.openTickets.find((t) => t.id === selectedTicketId);
                        return (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 600 }}>{selected?.title || 'Ticket thread'}</div>
                            <div style={{ fontSize: 12, color: '#555' }}>
                              {`${selected?.propertyName || ''}${selected?.unitCode ? ` - ${selected.unitCode}` : ''}${
                                selected?.priority ? ` - Priority: ${selected.priority}` : ''
                              }`}
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 240, overflowY: 'auto', padding: 8, background: '#fff' }}>
                        {ticketMessagesLoading ? (
                          <div style={{ fontSize: 13, color: '#555' }}>Loading messages...</div>
                        ) : ticketMessages.length ? (
                          ticketMessages.map((m) => (
                            <div key={m.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #e5e7eb' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{m.sender_type || 'user'}</span>
                                <span>{formatDateTime(m.created_at)}</span>
                              </div>
                              <div style={{ fontSize: 13, color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.message}</div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: 13, color: '#555' }}>No messages yet.</div>
                        )}
                      </div>
                      <form onSubmit={handleSendTicketMessage} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          rows="3"
                          value={ticketMessageText}
                          onChange={(e) => setTicketMessageText(e.target.value)}
                          style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: 8, fontSize: 13 }}
                          placeholder="Reply to tenant/caretaker..."
                        />
                        {ticketMessageError && <div style={{ color: '#b91c1c', fontSize: 12 }}>{ticketMessageError}</div>}
                        <div style={{ textAlign: 'right' }}>
                          <button type="submit" className="btn" style={{ padding: '8px 12px' }}>
                            Send reply
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: '#555' }}>Select an issue to view the message thread.</div>
                  )}
                </div>
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
        </div>
      </div>
        </>
      )}

      {tab === 'properties' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Properties & Units</h2>
          {dashboard?.properties?.length ? (
            <div className="table-wrap">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <Th>Property</Th>
                    <Th>Units</Th>
                    <Th>Occupied</Th>
                    <Th>Vacant</Th>
                    <Th>Occupancy</Th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.properties.map((p) => (
                    <tr key={p.id}>
                      <Td>{p.name}</Td>
                      <Td>{p.totalUnits}</Td>
                      <Td>{p.occupiedUnits}</Td>
                      <Td>{p.vacantUnits}</Td>
                      <Td>{p.occupancyPercent}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No properties yet. Add properties in the admin portal, then tenants/units will appear here." />
          )}
        </div>
      )}

      {tab === 'tenants' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Tenant Management</h2>
          <p className="helper">Add tenants and view your current tenant list.</p>

          <div className="card-glass" style={{ marginBottom: 12 }}>
            <form onSubmit={handleCreateTenant} className="form-grid">
              <div>
                <label className="helper">Full Name</label>
                <input className="input" value={tenantForm.fullName} onChange={(e) => setTenantForm({ ...tenantForm, fullName: e.target.value })} placeholder="e.g. Jane Tenant" />
              </div>
              <div>
                <label className="helper">Phone</label>
                <input className="input" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} placeholder="07xx xxx xxx" />
              </div>
              <div>
                <label className="helper">Email</label>
                <input className="input" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} placeholder="tenant@example.com" />
              </div>
              <div>
                <label className="helper">ID Number</label>
                <input className="input" value={tenantForm.idNumber} onChange={(e) => setTenantForm({ ...tenantForm, idNumber: e.target.value })} placeholder="ID / Passport" />
              </div>
              <div>
                <label className="helper">KRA PIN</label>
                <input className="input" value={tenantForm.kraPin} onChange={(e) => setTenantForm({ ...tenantForm, kraPin: e.target.value })} placeholder="e.g. A123456789B" />
              </div>
              <div>
                <label className="helper">Property</label>
                <select
                  className="input"
                  value={tenantForm.propertyId}
                  onChange={(e) => setTenantForm({ ...tenantForm, propertyId: e.target.value, unitId: '' })}
                >
                  <option value="">Select property...</option>
                  {propertyOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="helper">Unit (vacant only)</label>
                <select
                  className="input"
                  value={tenantForm.unitId}
                  onChange={(e) => setTenantForm({ ...tenantForm, unitId: e.target.value })}
                >
                  <option value="">Select unit...</option>
                  {unitOptions
                    .filter((u) => u.status === 'vacant' && (!tenantForm.propertyId || u.property_id === Number(tenantForm.propertyId)))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_code}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
                <div className="helper" style={{ color: tenantError ? '#b91c1c' : '#64748b' }}>
                  {tenantError || tenantMessage}
                </div>
                <button type="submit" className="btn btn-primary">Save Tenant</button>
              </div>
            </form>
          </div>

          <div className="card-glass">
            <h3 className="section-title" style={{ marginBottom: 8 }}>Tenants</h3>
            {tenantLoading ? (
              <div className="helper">Loading tenants...</div>
            ) : tenantList.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Phone</Th>
                      <Th>Email</Th>
                      <Th>ID</Th>
                      <Th>KRA PIN</Th>
                      <Th>Property</Th>
                      <Th>Unit</Th>
                      <Th>Status</Th>
                      <Th>Login</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantList.map((t) => (
                      <tr key={t.id}>
                        <Td>{t.fullName}</Td>
                        <Td>{t.phone}</Td>
                        <Td>{t.email || '-'}</Td>
                        <Td>{t.idNumber || '-'}</Td>
                        <Td>{t.kraPin || '-'}</Td>
                        <Td>{t.propertyName || '-'}</Td>
                        <Td>{t.unitCode || '-'}</Td>
                        <Td><StatusPill status={t.status} /></Td>
                        <Td>
                          {t.authUserId ? (
                            <span className="badge badge-muted">Linked</span>
                          ) : (
                            <button
                              className="btn btn-small"
                              type="button"
                              onClick={() => setLoginTenantId(String(t.id))}
                            >
                              Create Login
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="helper">No tenants yet.</div>
            )}
          </div>

          <div className="card-glass" style={{ marginTop: 12 }}>
            <h3 className="section-title" style={{ marginBottom: 8 }}>Create Tenant Login</h3>
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!loginTenantId || !loginEmail.trim() || !loginPassword.trim()) {
                  setLoginMessage('Select tenant and enter email/password.');
                  return;
                }
                try {
                  setLoginBusy(true);
                  setLoginMessage('Creating...');
                  const res = await apiFetch(`/landlord/tenants/${loginTenantId}/auth`, {
                    method: 'POST',
                    body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.message || 'Failed to create login');
                  setLoginMessage('Login created.');
                  setLoginTenantId('');
                  setLoginEmail('');
                  setLoginPassword('');
                  fetchTenants();
                } catch (err) {
                  setLoginMessage(err.message || 'Failed to create login');
                } finally {
                  setLoginBusy(false);
                }
              }}
            >
              <div>
                <label className="helper">Tenant</label>
                <select className="input" value={loginTenantId} onChange={(e) => setLoginTenantId(e.target.value)}>
                  <option value="">Select tenant...</option>
                  {tenantList
                    .filter((t) => !t.authUserId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.unitCode || 'no unit'})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="helper">Email</label>
                <input className="input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="tenant@example.com" />
              </div>
              <div>
                <label className="helper">Password</label>
                <input type="password" className="input" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Temp password" />
              </div>
              <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
                <div className="helper" style={{ color: '#64748b' }}>{loginMessage}</div>
                <button type="submit" disabled={loginBusy} className="btn btn-primary">
                  {loginBusy ? 'Saving...' : 'Create Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'tenantBills' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Tenant Bills</h2>
          <p className="helper">Review rent, water, and waste bills for your tenants.</p>
          {dashboard?.overdueBills?.length ? (
            <div className="table-wrap">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <Th>Tenant</Th>
                    <Th>Property / Unit</Th>
                    <Th>Period</Th>
                    <Th align="right">Rent</Th>
                    <Th align="right">Water</Th>
                    <Th align="right">Waste</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Paid</Th>
                    <Th align="right">Balance</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.overdueBills.map((b) => (
                    <tr key={b.id}>
                      <Td>
                        <div className="stack">
                          <span className="font-medium text-slate-800">{b.tenantName || 'Tenant'}</span>
                          <span className="helper">{b.propertyName || '-'}</span>
                        </div>
                      </Td>
                      <Td>{b.unitCode || '-'}</Td>
                      <Td>{b.billingPeriod}</Td>
                      <Td align="right">{formatCurrency(b.rentAmount)}</Td>
                      <Td align="right">{formatCurrency(b.waterAmount)}</Td>
                      <Td align="right">{formatCurrency(b.wasteAmount)}</Td>
                      <Td align="right">{formatCurrency(b.totalAmount)}</Td>
                      <Td align="right">{formatCurrency(b.amountPaid)}</Td>
                      <Td align="right">{formatCurrency(b.balance)}</Td>
                      <Td><StatusPill status={b.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No bills to show right now." />
          )}
        </div>
      )}
      {tab === 'caretakers' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Caretaker Management</h2>
          <p className="helper">Register caretakers for your properties, link logins, and delete if needed.</p>

          <div className="card-glass" style={{ marginBottom: 12 }}>
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!caretakerForm.fullName.trim() || !caretakerForm.phone.trim()) {
                  setCaretakerMsg('Name and phone are required.');
                  return;
                }
                try {
                  setCaretakerMsg('Saving...');
                  const res = await apiFetch('/landlord/caretakers', {
                    method: 'POST',
                    body: JSON.stringify({
                      fullName: caretakerForm.fullName.trim(),
                      phone: caretakerForm.phone.trim(),
                      email: caretakerForm.email.trim() || null,
                      propertyIds: caretakerForm.propertyIds,
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.message || 'Failed to create caretaker');
                  setCaretakerMsg('Caretaker saved.');
                  setCaretakerForm({ fullName: '', phone: '', email: '', propertyIds: [] });
                  fetchCaretakers();
                } catch (err) {
                  setCaretakerMsg(err.message || 'Failed to create caretaker');
                }
              }}
            >
              <div>
                <label className="helper">Full Name</label>
                <input className="input" value={caretakerForm.fullName} onChange={(e) => setCaretakerForm({ ...caretakerForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="helper">Phone</label>
                <input className="input" value={caretakerForm.phone} onChange={(e) => setCaretakerForm({ ...caretakerForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="helper">Email</label>
                <input className="input" value={caretakerForm.email} onChange={(e) => setCaretakerForm({ ...caretakerForm, email: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="helper">Assign Properties</label>
                <div className="flex flex-wrap gap-2">
                  {propertyOptions.map((p) => {
                    const checked = caretakerForm.propertyIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? caretakerForm.propertyIds.filter((id) => id !== p.id)
                              : [...caretakerForm.propertyIds, p.id];
                            setCaretakerForm({ ...caretakerForm, propertyIds: next });
                          }}
                        />
                        {p.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
                <div className="helper" style={{ color: '#64748b' }}>{caretakerMsg}</div>
                <button type="submit" className="btn btn-primary">Save Caretaker</button>
              </div>
            </form>
          </div>

          <div className="card-glass">
            <h3 className="section-title" style={{ marginBottom: 8 }}>Caretakers</h3>
            {caretakers.length ? (
              <div className="table-wrap">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Phone</Th>
                      <Th>Email</Th>
                      <Th>Properties</Th>
                      <Th>Status</Th>
                      <Th>Login</Th>
                      <Th>Created</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {caretakers.map((c) => (
                      <tr key={c.id}>
                        <Td>{c.fullName}</Td>
                        <Td>{c.phone}</Td>
                        <Td>{c.email || '-'}</Td>
                        <Td>{c.properties?.length ? c.properties.join(', ') : '-'}</Td>
                        <Td><StatusPill status={c.status} /></Td>
                        <Td>
                          {c.authUserId ? (
                            <span className="badge badge-muted">Linked</span>
                          ) : (
                            <button
                              className="btn btn-small"
                              type="button"
                              onClick={async () => {
                                setCaretakerLogin({ ...caretakerLogin, id: c.id });
                              }}
                            >
                              Create Login
                            </button>
                          )}
                        </Td>
                        <Td>{formatDate(c.createdAt)}</Td>
                        <Td>
                          <button
                            className="btn btn-small"
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('Delete this caretaker?')) return;
                              try {
                                const res = await apiFetch(`/landlord/caretakers/${c.id}`, { method: 'DELETE' });
                                const json = await res.json();
                                if (!res.ok) throw new Error(json.message || 'Failed to delete caretaker');
                                fetchCaretakers();
                              } catch (err) {
                                alert(err.message || 'Failed to delete caretaker');
                              }
                            }}
                          >
                            Delete
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No caretakers yet." />
            )}
          </div>

          {!caretakerLogin.id ? null : (
            <div className="card-glass" style={{ marginTop: 12 }}>
              <h3 className="section-title" style={{ marginBottom: 8 }}>Create Caretaker Login</h3>
              <form
                className="form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!caretakerLogin.id || !caretakerLogin.email.trim() || !caretakerLogin.password.trim()) {
                    setCaretakerLoginMsg('Email and password required.');
                    return;
                  }
                  try {
                    setCaretakerLoginMsg('Creating...');
                    const res = await apiFetch(`/landlord/caretakers/${caretakerLogin.id}/auth`, {
                      method: 'POST',
                      body: JSON.stringify({ email: caretakerLogin.email.trim(), password: caretakerLogin.password }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.message || 'Failed to create login');
                    setCaretakerLoginMsg('Login created.');
                    setCaretakerLogin({ id: '', email: '', password: '' });
                    fetchCaretakers();
                  } catch (err) {
                    setCaretakerLoginMsg(err.message || 'Failed to create login');
                  }
                }}
              >
                <div>
                  <label className="helper">Email</label>
                  <input className="input" value={caretakerLogin.email} onChange={(e) => setCaretakerLogin({ ...caretakerLogin, email: e.target.value })} />
                </div>
                <div>
                  <label className="helper">Password</label>
                  <input type="password" className="input" value={caretakerLogin.password} onChange={(e) => setCaretakerLogin({ ...caretakerLogin, password: e.target.value })} />
                </div>
                <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
                  <div className="helper">{caretakerLoginMsg}</div>
                  <button type="submit" className="btn btn-primary">Create Login</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Announcements</h2>
          <p className="helper">Post notices to tenants or to specific properties.</p>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
                setAnnouncementMsg('Title and message are required.');
                return;
              }
              try {
                setAnnouncementMsg('Saving...');
                const res = await apiFetch('/landlord/announcements', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: announcementForm.title.trim(),
                    message: announcementForm.message.trim(),
                    propertyId: announcementForm.propertyId ? Number(announcementForm.propertyId) : null,
                  }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Failed to create announcement');
                setAnnouncementMsg('Announcement posted.');
                setAnnouncementForm({ title: '', message: '', propertyId: '' });
                fetchAnnouncements();
              } catch (err) {
                setAnnouncementMsg(err.message || 'Failed to create announcement');
              }
            }}
          >
            <div>
              <label className="helper">Title</label>
              <input className="input" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
            </div>
            <div>
              <label className="helper">Target Property (optional)</label>
              <select className="input" value={announcementForm.propertyId} onChange={(e) => setAnnouncementForm({ ...announcementForm, propertyId: e.target.value })}>
                <option value="">All tenants</option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="helper">Message</label>
              <textarea className="input" rows={3} value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} />
            </div>
            <div className="helper" style={{ color: '#64748b' }}>{announcementMsg}</div>
            <div>
              <button type="submit" className="btn btn-primary">Post</button>
            </div>
          </form>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            {announcements.length ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Message</Th>
                    <Th>Property</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr key={a.id}>
                      <Td>{a.title}</Td>
                      <Td>{a.message}</Td>
                      <Td>{a.property_id || 'All'}</Td>
                      <Td>{formatDateTime(a.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No announcements yet." />
            )}
          </div>
        </div>
      )}

      {tab === 'listings' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Public Listings</h2>
          <p className="helper">Publish vacant units for applicants.</p>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!listingForm.unitId || !listingForm.title.trim() || !listingForm.rentAmount) {
                setListingMsg('Unit, title, and rent are required.');
                return;
              }
              try {
                setListingMsg('Saving...');
                const res = await apiFetch('/landlord/public-listings', {
                  method: 'POST',
                  body: JSON.stringify({
                    unitId: Number(listingForm.unitId),
                    title: listingForm.title.trim(),
                    description: listingForm.description.trim(),
                    rentAmount: Number(listingForm.rentAmount),
                  }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Failed to create listing');
                setListingMsg('Listing created.');
                setListingForm({ unitId: '', title: '', description: '', rentAmount: '' });
                fetchListings();
              } catch (err) {
                setListingMsg(err.message || 'Failed to create listing');
              }
            }}
          >
            <div>
              <label className="helper">Unit</label>
              <select className="input" value={listingForm.unitId} onChange={(e) => setListingForm({ ...listingForm, unitId: e.target.value })}>
                <option value="">Select unit</option>
                {unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_code} (Property {u.property_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="helper">Title</label>
              <input className="input" value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} />
            </div>
            <div>
              <label className="helper">Rent Amount</label>
              <input className="input" value={listingForm.rentAmount} onChange={(e) => setListingForm({ ...listingForm, rentAmount: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="helper">Description</label>
              <textarea className="input" rows={2} value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} />
            </div>
            <div className="helper" style={{ color: '#64748b' }}>{listingMsg}</div>
            <div>
              <button type="submit" className="btn btn-primary">Publish</button>
            </div>
          </form>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            {listings.length ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Unit</Th>
                    <Th>Rent</Th>
                    <Th>Listed</Th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id}>
                      <Td>{l.title}</Td>
                      <Td>{l.unit_id}</Td>
                      <Td>{formatCurrency(l.rent_amount)}</Td>
                      <Td>{formatDateTime(l.listed_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No active listings." />
            )}
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Applications</h2>
          <p className="helper">View incoming rental applications from public listings.</p>
          {applications.length ? (
            <div className="table-wrap">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <Th>Applicant</Th>
                    <Th>Phone</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        <div className="stack">
                          <span className="font-medium text-slate-800">{a.full_name}</span>
                          <span className="helper">Property {a.property_id} - Unit {a.unit_id || '-'}</span>
                        </div>
                      </Td>
                      <Td>{a.phone}</Td>
                      <Td>{a.email || '-'}</Td>
                      <Td><StatusPill status={a.status} /></Td>
                      <Td>{formatDateTime(a.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No applications yet." />
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="card-glass" style={{ marginTop: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Documents</h2>
          <p className="helper">Store agreements, IDs, and related files for tenancies.</p>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!documentForm.tenancyId || !documentForm.type.trim() || !documentForm.fileUrl.trim()) {
                setDocumentMsg('Tenancy, type, and file URL are required.');
                return;
              }
              try {
                setDocumentMsg('Saving...');
                const res = await apiFetch('/landlord/documents', {
                  method: 'POST',
                  body: JSON.stringify({
                    tenancyId: Number(documentForm.tenancyId),
                    tenantId: documentForm.tenantId ? Number(documentForm.tenantId) : null,
                    type: documentForm.type.trim(),
                    fileUrl: documentForm.fileUrl.trim(),
                  }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Failed to save document');
                setDocumentMsg('Document saved.');
                setDocumentForm({ tenancyId: '', tenantId: '', type: '', fileUrl: '' });
                fetchDocuments();
              } catch (err) {
                setDocumentMsg(err.message || 'Failed to save document');
              }
            }}
          >
            <div>
              <label className="helper">Tenancy ID</label>
              <input className="input" value={documentForm.tenancyId} onChange={(e) => setDocumentForm({ ...documentForm, tenancyId: e.target.value })} />
            </div>
            <div>
              <label className="helper">Tenant ID (optional)</label>
              <input className="input" value={documentForm.tenantId} onChange={(e) => setDocumentForm({ ...documentForm, tenantId: e.target.value })} />
            </div>
            <div>
              <label className="helper">Type</label>
              <input className="input" value={documentForm.type} onChange={(e) => setDocumentForm({ ...documentForm, type: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="helper">File URL</label>
              <input className="input" value={documentForm.fileUrl} onChange={(e) => setDocumentForm({ ...documentForm, fileUrl: e.target.value })} />
            </div>
            <div className="helper" style={{ color: '#64748b' }}>{documentMsg}</div>
            <div>
              <button type="submit" className="btn btn-primary">Save Document</button>
            </div>
          </form>

          <div className="table-wrap" style={{ marginTop: 14 }}>
            {documents.length ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Tenancy</Th>
                    <Th>Tenant</Th>
                    <Th>Uploaded</Th>
                    <Th>Link</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <Td>{d.type}</Td>
                      <Td>{d.tenancy_id}</Td>
                      <Td>{d.tenant_id || '-'}</Td>
                      <Td>{formatDateTime(d.uploaded_at)}</Td>
                      <Td><a className="text-sky-600" href={d.file_url} target="_blank" rel="noreferrer">Open</a></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No documents uploaded." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="stack">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {description && <div className="text-xs text-slate-500">{description}</div>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="card-glass" style={{ marginTop: 12 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="py-4 flex flex-col items-center justify-center text-center text-sm text-slate-500">
      <div className="w-10 h-10 mb-2 rounded-full bg-sky-50 flex items-center justify-center">
        <span className="text-sky-500 text-lg">??</span>
      </div>
      <p>{message}</p>
    </div>
  );
}
function Th({ children, align = 'left' }) {
  return (
    <th className={align === 'right' ? 'text-right' : 'text-left'} style={{ padding: '10px 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: '#475569' }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }) {
  return (
    <td className={align === 'right' ? 'text-right' : 'text-left'} style={{ padding: '10px 8px', fontSize: 13, color: '#0f172a' }}>
      {children}
    </td>
  );
}

function StatusPill({ status }) {
  const normalized = (status || '').toLowerCase();
  let colors = 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalized === 'paid') colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  else if (normalized === 'overdue') colors = 'bg-red-50 text-red-700 border-red-100';
  else if (normalized === 'partial') colors = 'bg-amber-50 text-amber-700 border-amber-100';
  else if (normalized === 'open' || normalized === 'pending') colors = 'bg-sky-50 text-sky-700 border-sky-100';

  return (
    <span className={['inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', colors].join(' ')}>
      {status}
    </span>
  );
}

function PriorityPill({ priority }) {
  const normalized = (priority || '').toLowerCase();
  let colors = 'bg-slate-50 text-slate-700 border-slate-200';
  if (normalized === 'high') colors = 'bg-red-50 text-red-700 border-red-100';
  else if (normalized === 'medium') colors = 'bg-amber-50 text-amber-700 border-amber-100';
  else if (normalized === 'low') colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';

  return (
    <span className={['inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', colors].join(' ')}>
      {priority || 'N/A'}
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
  return `${year}-${month}`;
}

export default LandlordDashboard;









