import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function TenantTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [activeTenancyId, setActiveTenancyId] = useState(null);

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageError, setMessageError] = useState('');

  useEffect(() => {
    loadActiveTenancy();
    fetchTickets();
  }, []);

  async function loadActiveTenancy() {
    try {
      const res = await apiFetch(`/tenant/overview`);
      if (!res.ok) return;
      const json = await res.json();
      const t = json.tenancies?.[0];
      if (t) setActiveTenancyId(t.id);
    } catch (err) {
      console.error('Error fetching active tenancy', err);
    }
  }

  async function fetchTickets() {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`/tenant/tickets`);
      if (!res.ok) throw new Error('Failed to load issues');
      const json = await res.json();
      setTickets(json.tickets || []);
      if (json.tickets?.length) {
        setSelectedTicketId(json.tickets[0].id);
        fetchMessages(json.tickets[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(e) {
    e.preventDefault();
    if (!title.trim()) {
      setCreateMessage('Please enter a title for your issue.');
      return;
    }
    if (!activeTenancyId) {
      setCreateMessage('No active house found. Cannot raise issue.');
      return;
    }

    try {
      setCreating(true);
      setCreateMessage('');
      const res = await apiFetch(`/tenant/tickets`, {
        method: 'POST',
        body: JSON.stringify({
          tenancyId: activeTenancyId,
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create issue');
      }
      setCreateMessage('Issue submitted successfully.');
      setTitle('');
      setDescription('');
      setCategory('general');
      setPriority('medium');
      fetchTickets();
    } catch (err) {
      console.error(err);
      setCreateMessage(err.message || 'Failed to submit issue');
    } finally {
      setCreating(false);
    }
  }

  async function fetchMessages(ticketId) {
    if (!ticketId) return;
    try {
      setMessagesLoading(true);
      setMessageError('');
      const res = await apiFetch(`/tenant/tickets/${ticketId}/messages`);
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

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!selectedTicketId || !messageText.trim()) return;
    try {
      const res = await apiFetch(`/tenant/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: messageText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to send message');
      setMessageText('');
      fetchMessages(selectedTicketId);
    } catch (err) {
      console.error(err);
      setMessageError(err.message || 'Failed to send message');
    }
  }

  if (loading && !tickets.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading your issues...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <main className="flex-1 max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Issues & Maintenance</h1>
            <p className="text-sm text-slate-500">Raise issues with your house and track their status.</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded text-sm">{error}</div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Raise a New Issue</h2>
          <form onSubmit={handleCreateTicket} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="e.g. Water leaking in bathroom"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
              <textarea
                rows={3}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="Describe the issue in more detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="general">General</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electricity">Electricity</option>
                  <option value="security">Security</option>
                  <option value="noise">Noise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {createMessage && <div className="text-xs text-slate-500 mt-1">{createMessage}</div>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {creating ? 'Sending...' : 'Submit Issue'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">My Issues</h2>
          {tickets.length ? (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className={`border rounded-lg px-3 py-2 text-sm flex flex-col gap-1 cursor-pointer ${
                      selectedTicketId === t.id ? 'border-sky-300 bg-sky-50' : 'border-slate-100'
                    }`}
                    onClick={() => {
                      setSelectedTicketId(t.id);
                      fetchMessages(t.id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-800">{t.title}</div>
                      <div className="flex items-center gap-2">
                        <PriorityPill priority={t.priority} />
                        <StatusPill status={t.status} />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.propertyName && `${t.propertyName} • `}
                      {t.unitCode && `Unit ${t.unitCode}`} • Created {formatDate(t.createdAt)}
                    </div>
                    {t.description && <div className="text-xs text-slate-600 mt-1">{t.description}</div>}
                  </div>
                ))}
              </div>

              <div className="border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 min-h-[240px]">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800">Messages</div>
                  {messagesLoading && <div className="text-[11px] text-slate-500">Loading…</div>}
                </div>
                {messageError && <div className="text-[11px] text-red-600 mt-1">{messageError}</div>}
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {messages.length ? (
                    messages.map((m) => (
                      <div key={m.id} className="border border-slate-200 rounded-md px-2 py-1">
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>{m.sender_type}</span>
                          <span>{formatDate(m.created_at)}</span>
                        </div>
                        <div className="text-sm text-slate-800">{m.message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No messages yet.</div>
                  )}
                </div>
                <form onSubmit={handleSendMessage} className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!selectedTicketId}
                    className="inline-flex items-center rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">You have not raised any issues yet.</div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }) {
  const normalized = (status || '').toLowerCase();
  let colors = 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalized === 'open') {
    colors = 'bg-sky-50 text-sky-700 border-sky-100';
  } else if (normalized === 'in_progress') {
    colors = 'bg-amber-50 text-amber-700 border-amber-100';
  } else if (normalized === 'resolved' || normalized === 'closed') {
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

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default TenantTicketsPage;
