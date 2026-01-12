import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function PublicListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedListingId, setSelectedListingId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [appMessage, setAppMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/public/listings');
      if (!res.ok) throw new Error('Failed to load listings');
      const json = await res.json();
      setListings(json.listings || []);
      if ((json.listings || []).length) setSelectedListingId(json.listings[0].id);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e) {
    e.preventDefault();
    if (!selectedListingId || !fullName.trim() || !phone.trim()) {
      setAppMessage('Select a listing and fill in your name and phone.');
      return;
    }
    try {
      setSubmitting(true);
      setAppMessage('');
      const res = await apiFetch('/public/applications', {
        method: 'POST',
        body: JSON.stringify({
          listingId: Number(selectedListingId),
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          notes: notes.trim() || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to submit application');
      setAppMessage('Application submitted. We will contact you soon.');
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
    } catch (err) {
      console.error(err);
      setAppMessage(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading listings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <main className="flex-1 max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Available Houses</h1>
            <p className="text-sm text-slate-500">Browse open listings and apply to rent.</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded text-sm">{error}</div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          {listings.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {listings.map((l) => (
                <div
                  key={l.id}
                  className={`border rounded-lg p-3 text-sm ${selectedListingId === l.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}
                  onClick={() => setSelectedListingId(l.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-800">{l.title}</div>
                    <div className="text-xs text-slate-500">{new Date(l.listed_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{l.property?.name}</div>
                  <div className="text-xs text-slate-500">{l.unit?.unit_code ? `Unit ${l.unit.unit_code}` : ''}</div>
                  <div className="text-sm font-semibold text-slate-900 mt-2">KES {Number(l.rent_amount).toLocaleString()}</div>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3">{l.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No listings available.</div>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Apply for a House</h2>
          <form onSubmit={handleApply} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Listing</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={selectedListingId}
                onChange={(e) => setSelectedListingId(e.target.value)}
              >
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} ({l.property?.name || 'Property'})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Full Name</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Phone</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Email (optional)</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Notes</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            {appMessage && <div className="text-xs text-slate-500">{appMessage}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default PublicListings;
