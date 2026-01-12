import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function AdminPortal() {
  const [activeTab, setActiveTab] = useState('landlords'); // landlords | properties | paybills

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <main className="flex-1 max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">System Admin Panel</h1>
            <p className="text-sm text-slate-500">Manage landlords, paybill numbers, and platform configuration.</p>
          </div>
        </header>

        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-4 text-sm">
            <TabButton label="Landlords" active={activeTab === 'landlords'} onClick={() => setActiveTab('landlords')} />
            <TabButton label="Properties" active={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
            <TabButton label="Paybills" active={activeTab === 'paybills'} onClick={() => setActiveTab('paybills')} />
          </nav>
        </div>

        {activeTab === 'landlords' && <LandlordsTab />}
        {activeTab === 'properties' && <PropertiesTab />}
        {activeTab === 'paybills' && <PaybillsTab />}
      </main>
    </div>
  );
}

function LandlordsTab() {
  const [landlords, setLandlords] = useState([]);
  const [paybills, setPaybills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [landlordType, setLandlordType] = useState('individual');
  const [companyName, setCompanyName] = useState('');
  const [companyContactName, setCompanyContactName] = useState('');
  const [companyContactPhone, setCompanyContactPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [contractUrl, setContractUrl] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState('');

  const [assigningId, setAssigningId] = useState(null);
  const [assignError, setAssignError] = useState('');

  // edit/delete
  const [editId, setEditId] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editFields, setEditFields] = useState({
    fullName: '',
    landlordType: 'individual',
    companyName: '',
    companyContactName: '',
    companyContactPhone: '',
    idNumber: '',
    kraPin: '',
    contractUrl: '',
    contractNotes: '',
    phone: '',
    email: '',
  });

  // create login
  const [loginLandlordId, setLoginLandlordId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [landlordsRes, paybillsRes] = await Promise.all([apiFetch('/admin/landlords'), apiFetch('/admin/paybills?active=true')]);

      if (!landlordsRes.ok) throw new Error('Failed to load landlords');
      if (!paybillsRes.ok) throw new Error('Failed to load paybills');

      const landlordsJson = await landlordsRes.json();
      const paybillsJson = await paybillsRes.json();

      setLandlords(landlordsJson.landlords || []);
      setPaybills(paybillsJson.paybills || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load admin landlord data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLandlord(e) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setCreateMessage('Name, phone and email are required.');
      return;
    }

    try {
      setCreating(true);
      setCreateMessage('');
      const res = await apiFetch('/admin/landlords', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          landlordType,
          companyName: companyName.trim() || null,
          companyContactName: companyContactName.trim() || null,
          companyContactPhone: companyContactPhone.trim() || null,
          idNumber: idNumber.trim() || null,
          kraPin: kraPin.trim() || null,
          contractUrl: contractUrl.trim() || null,
          contractNotes: contractNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create landlord');
      }

      setCreateMessage('Landlord registered successfully.');
      setFullName('');
      setLandlordType('individual');
      setPhone('');
      setEmail('');
      setCompanyName('');
      setCompanyContactName('');
      setCompanyContactPhone('');
      setIdNumber('');
      setKraPin('');
      setContractUrl('');
      setContractNotes('');
      loadData();
    } catch (err) {
      console.error(err);
      setCreateMessage(err.message || 'Failed to create landlord');
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignPaybill(landlordId, paybillId) {
    if (!paybillId) return;
    try {
      setAssigningId(landlordId);
      setAssignError('');
      const res = await apiFetch(`/admin/landlords/${landlordId}/paybill`, {
        method: 'POST',
        body: JSON.stringify({ paybillId: Number(paybillId) }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to assign paybill');
      }
      await loadData();
    } catch (err) {
      console.error(err);
      setAssignError(err.message || 'Failed to assign paybill');
    } finally {
      setAssigningId(null);
    }
  }

  function handleChooseEdit(id) {
    setEditId(id);
    setEditMessage('');
    const selected = landlords.find((l) => l.id === Number(id));
    if (selected) {
      setEditFields({
        fullName: selected.name || '',
        landlordType: selected.landlordType || 'individual',
        companyName: selected.companyName || '',
        companyContactName: selected.companyContactName || '',
        companyContactPhone: selected.companyContactPhone || '',
        idNumber: selected.idNumber || '',
        kraPin: selected.kraPin || '',
        contractUrl: selected.contractUrl || '',
        contractNotes: selected.contractNotes || '',
        phone: selected.phone || '',
        email: selected.email || '',
      });
    }
  }

  async function handleUpdateLandlord(e) {
    e.preventDefault();
    if (!editId) {
      setEditMessage('Select a landlord to edit.');
      return;
    }
    try {
      setEditMessage('Saving...');
      const res = await apiFetch(`/admin/landlords/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editFields.fullName.trim() || null,
          phone: editFields.phone.trim() || null,
          email: editFields.email.trim() || null,
          landlordType: editFields.landlordType,
          companyName: editFields.companyName.trim() || null,
          companyContactName: editFields.companyContactName.trim() || null,
          companyContactPhone: editFields.companyContactPhone.trim() || null,
          idNumber: editFields.idNumber.trim() || null,
          kraPin: editFields.kraPin.trim() || null,
          contractUrl: editFields.contractUrl.trim() || null,
          contractNotes: editFields.contractNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update landlord');
      setEditMessage('Updated.');
      await loadData();
    } catch (err) {
      console.error(err);
      setEditMessage(err.message || 'Failed to update landlord');
    }
  }

  async function handleDeleteLandlord() {
    if (!editId) {
      setEditMessage('Select a landlord to delete.');
      return;
    }
    const confirmDelete = window.confirm('Delete this landlord? This cannot be undone.');
    if (!confirmDelete) return;
    try {
      setEditMessage('Deleting...');
      const res = await apiFetch(`/admin/landlords/${editId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to delete landlord');
      setEditMessage('Deleted.');
      setEditId('');
      await loadData();
    } catch (err) {
      console.error(err);
      setEditMessage(err.message || 'Failed to delete landlord');
    }
  }

  async function handleCreateLogin(e) {
    e.preventDefault();
    if (!loginLandlordId || !loginEmail.trim() || !loginPassword.trim()) {
      setLoginMessage('Select landlord and enter email/password.');
      return;
    }
    try {
      setLoginBusy(true);
      setLoginMessage('Creating login...');
      const res = await apiFetch(`/admin/landlords/${loginLandlordId}/auth`, {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create login');
      setLoginMessage('Login created and linked.');
      setLoginEmail('');
      setLoginPassword('');
      await loadData();
    } catch (err) {
      console.error(err);
      setLoginMessage(err.message || 'Failed to create login');
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Register New Landlord</h2>
        <form onSubmit={handleCreateLandlord} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Type</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={landlordType}
              onChange={(e) => setLandlordType(e.target.value)}
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Company Name (optional)</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. JD Apartments"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Company Contact Name</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={companyContactName}
              onChange={(e) => setCompanyContactName(e.target.value)}
              placeholder="e.g. Jane Manager"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Company Contact Phone</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={companyContactPhone}
              onChange={(e) => setCompanyContactPhone(e.target.value)}
              placeholder="e.g. 07xx xxx xxx"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Phone</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 07xx xxx xxx"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. landlord@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">National ID / Registration</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. 12345678"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">KRA PIN</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={kraPin}
              onChange={(e) => setKraPin(e.target.value)}
              placeholder="e.g. A123456789B"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Contract URL (optional)</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={contractUrl}
              onChange={(e) => setContractUrl(e.target.value)}
              placeholder="Link to signed agreement PDF"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Contract Notes</label>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={contractNotes}
              onChange={(e) => setContractNotes(e.target.value)}
              placeholder="Key clauses, renewal date, etc."
            />
          </div>

          <div className="md:col-span-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">{createMessage}</div>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {creating ? 'Saving...' : 'Save Landlord'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Edit / Delete Landlord</h2>
        <form onSubmit={handleUpdateLandlord} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Landlord</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={editId}
              onChange={(e) => handleChooseEdit(e.target.value)}
            >
              <option value="">Select landlord...</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Type</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={editFields.landlordType}
              onChange={(e) => setEditFields({ ...editFields, landlordType: e.target.value })}
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              value={editFields.fullName}
              onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Company</label>
            <input
              type="text"
              value={editFields.companyName}
              onChange={(e) => setEditFields({ ...editFields, companyName: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Company Contact</label>
            <input
              type="text"
              value={editFields.companyContactName}
              onChange={(e) => setEditFields({ ...editFields, companyContactName: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Contact Phone</label>
            <input
              type="text"
              value={editFields.companyContactPhone}
              onChange={(e) => setEditFields({ ...editFields, companyContactPhone: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Phone</label>
            <input
              type="text"
              value={editFields.phone}
              onChange={(e) => setEditFields({ ...editFields, phone: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={editFields.email}
              onChange={(e) => setEditFields({ ...editFields, email: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">ID / Registration</label>
            <input
              type="text"
              value={editFields.idNumber}
              onChange={(e) => setEditFields({ ...editFields, idNumber: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">KRA PIN</label>
            <input
              type="text"
              value={editFields.kraPin}
              onChange={(e) => setEditFields({ ...editFields, kraPin: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Contract URL</label>
            <input
              type="text"
              value={editFields.contractUrl}
              onChange={(e) => setEditFields({ ...editFields, contractUrl: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Contract Notes</label>
            <textarea
              rows={2}
              value={editFields.contractNotes}
              onChange={(e) => setEditFields({ ...editFields, contractNotes: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div className="md:col-span-3 flex flex-wrap gap-2 items-center justify-between">
            <div className="text-xs text-slate-500">{editMessage}</div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleDeleteLandlord}
                className="inline-flex items-center rounded-md bg-red-50 px-4 py-2 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-100"
              >
                Delete Landlord
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Create Landlord Login</h2>
        <form onSubmit={handleCreateLogin} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Landlord</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={loginLandlordId}
              onChange={(e) => setLoginLandlordId(e.target.value)}
            >
              <option value="">Select landlord...</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id} disabled={!!l.authUserId}>
                  {l.name} {l.authUserId ? '(login linked)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Email for login</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="login@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="Temp password"
            />
          </div>
          <div className="md:col-span-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">{loginMessage}</div>
            <button
              type="submit"
              disabled={loginBusy}
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {loginBusy ? 'Creating...' : 'Create Login'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Landlords</h2>
          {assignError && <div className="text-xs text-red-600">{assignError}</div>}
        </div>

        {loading ? (
          <div className="py-8 text-sm text-slate-500">Loading landlords...</div>
        ) : landlords.length ? (
          <div className="overflow-x-auto text-xs sm:text-sm">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70">
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Type</Th>
                  <Th>Company</Th>
                  <Th>ID/KRA</Th>
                  <Th>Paybill</Th>
                  <Th>Assign Paybill</Th>
                </tr>
              </thead>
              <tbody>
                {landlords.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0">
                    <Td>{l.id}</Td>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-slate-800">{l.name}</span>
                        {l.contractUrl && (
                          <a
                            href={l.contractUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-sky-600 hover:underline"
                          >
                            Contract
                          </a>
                        )}
                        {l.contractNotes && <span className="text-[11px] text-slate-500 line-clamp-2">{l.contractNotes}</span>}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col">
                        <span>{l.phone}</span>
                        <span className="text-[11px] text-slate-500">{l.email}</span>
                        {l.companyContactName && (
                          <span className="text-[11px] text-slate-500">
                            Contact: {l.companyContactName} {l.companyContactPhone ? `(${l.companyContactPhone})` : ''}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="capitalize text-[12px]">{l.landlordType || 'individual'}</Td>
                    <Td>{l.companyName || '-'}</Td>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-600">ID: {l.idNumber || '-'}</span>
                        <span className="text-[11px] text-slate-600">KRA: {l.kraPin || '-'}</span>
                      </div>
                    </Td>
                    <Td>
                      {l.paybill ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-slate-900">{l.paybill.shortcode}</span>
                          <span className="text-[11px] text-slate-500">
                            {l.paybill.name} ({l.paybill.account_type})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </Td>
                    <Td>
                      {paybills.length ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                            defaultValue={l.paybill?.id || ''}
                            onChange={(e) => handleAssignPaybill(l.id, e.target.value)}
                          >
                            <option value="">Select...</option>
                            {paybills.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.shortcode} - {p.name}
                              </option>
                            ))}
                          </select>
                          {assigningId === l.id && <span className="text-[11px] text-slate-500">Saving...</span>}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">No active paybills yet</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-sm text-slate-500">No landlords registered yet.</div>
        )}
      </section>
    </div>
  );
}

function PaybillsTab() {
  const [paybills, setPaybills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [shortcode, setShortcode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('wallet_per_tenancy');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState('');

  useEffect(() => {
    loadPaybills();
  }, []);

  async function loadPaybills() {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/admin/paybills');
      if (!res.ok) throw new Error('Failed to load paybills');
      const json = await res.json();
      setPaybills(json.paybills || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load paybills');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePaybill(e) {
    e.preventDefault();
    if (!shortcode.trim() || !name.trim()) {
      setCreateMessage('Shortcode and name are required.');
      return;
    }

    try {
      setCreating(true);
      setCreateMessage('');
      const res = await apiFetch('/admin/paybills', {
        method: 'POST',
        body: JSON.stringify({
          shortcode: shortcode.trim(),
          name: name.trim(),
          accountType,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create paybill');
      }

      setCreateMessage('Paybill registered successfully.');
      setShortcode('');
      setName('');
      setAccountType('wallet_per_tenancy');
      loadPaybills();
    } catch (err) {
      console.error(err);
      setCreateMessage(err.message || 'Failed to create paybill');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Register New Paybill</h2>
        <form onSubmit={handleCreatePaybill} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Shortcode</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={shortcode}
              onChange={(e) => setShortcode(e.target.value)}
              placeholder="e.g. 412345"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Display Name</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rent Wallet Main"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Account Type</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="wallet_per_tenancy">Wallet per tenancy</option>
              <option value="wallet_per_unit">Wallet per unit</option>
              <option value="wallet_per_landlord">Wallet per landlord</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">{createMessage}</div>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {creating ? 'Saving...' : 'Save Paybill'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Paybill Numbers</h2>
        {loading ? (
          <div className="py-8 text-sm text-slate-500">Loading paybills...</div>
        ) : paybills.length ? (
          <div className="overflow-x-auto text-xs sm:text-sm">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70">
                  <Th>ID</Th>
                  <Th>Shortcode</Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {paybills.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <Td>{p.id}</Td>
                    <Td className="font-mono">{p.shortcode}</Td>
                    <Td>{p.name}</Td>
                    <Td>{p.account_type}</Td>
                    <Td>
                      <StatusPill status={p.is_active ? 'active' : 'inactive'} />
                    </Td>
                    <Td>{formatDate(p.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-sm text-slate-500">No paybills configured yet.</div>
        )}
      </section>
    </div>
  );
}

function PropertiesTab() {
  const [properties, setProperties] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [landlordId, setLandlordId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [unitCount, setUnitCount] = useState('');
  const [unitPrefix, setUnitPrefix] = useState('R');
  const [mapUrl, setMapUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [propsRes, landlordsRes] = await Promise.all([apiFetch('/admin/properties'), apiFetch('/admin/landlords')]);
      if (!propsRes.ok) throw new Error('Failed to load properties');
      if (!landlordsRes.ok) throw new Error('Failed to load landlords');
      const propsJson = await propsRes.json();
      const landlordsJson = await landlordsRes.json();
      setProperties(propsJson.properties || []);
      setLandlords(landlordsJson.landlords || []);
    } catch (err) {
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProperty(e) {
    e.preventDefault();
    if (!landlordId || !name.trim()) {
      setMessage('Select landlord and enter property name.');
      return;
    }
    try {
      setMessage('Saving...');
      const res = await apiFetch('/admin/properties', {
        method: 'POST',
        body: JSON.stringify({
          landlordId: Number(landlordId),
          name: name.trim(),
          location: location.trim() || null,
          description: description.trim() || null,
          unitCount: unitCount ? Number(unitCount) : 0,
          unitPrefix: unitPrefix || 'R',
          mapUrl: mapUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create property');
      setMessage('Property saved.');
      setName('');
      setLocation('');
      setDescription('');
      setUnitCount('');
      setUnitPrefix('R');
      setMapUrl('');
      await loadData();
    } catch (err) {
      setMessage(err.message || 'Failed to create property');
    }
  }

  return (
    <div className="stack">
      {error && <div className="card-glass" style={{ color: '#b91c1c' }}>{error}</div>}

      <section className="card-glass">
        <h2 className="section-title">Register Property</h2>
        <form onSubmit={handleCreateProperty} className="form-grid">
          <div>
            <label className="helper">Landlord</label>
            <select className="input" value={landlordId} onChange={(e) => setLandlordId(e.target.value)}>
              <option value="">Select landlord...</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="helper">Property Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Skyline Court" />
          </div>
          <div>
            <label className="helper">Number of Units</label>
            <input className="input" type="number" min="0" value={unitCount} onChange={(e) => setUnitCount(e.target.value)} placeholder="e.g. 5" />
          </div>
          <div>
            <label className="helper">Unit Name Prefix (auto-numbered)</label>
            <input className="input" value={unitPrefix} onChange={(e) => setUnitPrefix(e.target.value)} placeholder="e.g. R" />
          </div>
          <div>
            <label className="helper">Location</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi, Kilimani" />
          </div>
          <div>
            <label className="helper">Google Maps Link</label>
            <input className="input" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.google.com/..." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Description</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
            <div className="helper">{message}</div>
            <button type="submit" className="btn btn-primary">Save Property</button>
          </div>
        </form>
      </section>

      <section className="card-glass">
        <h2 className="section-title">Properties</h2>
        {loading ? (
          <div className="helper">Loading properties...</div>
        ) : properties.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Landlord</Th>
                  <Th>Location</Th>
                  <Th>Units</Th>
                  <Th>Map</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.id}</Td>
                    <Td>{p.name}</Td>
                    <Td>{p.landlordName || p.landlordId}</Td>
                    <Td>{p.location || '-'}</Td>
                    <Td>
                      <div className="stack">
                        <span className="font-medium text-slate-800">{p.unitsCount || 0} units</span>
                        {p.unitsPreview?.length ? (
                          <span className="helper">Sample: {p.unitsPreview.join(', ')}</span>
                        ) : (
                          <span className="helper">No units yet</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {p.mapUrl ? (
                        <a href={p.mapUrl} target="_blank" rel="noreferrer" className="helper" style={{ color: '#0ea5e9' }}>
                          Maps link
                        </a>
                      ) : (
                        <span className="helper">-</span>
                      )}
                    </Td>
                    <Td><StatusPill status={p.status || 'active'} /></Td>
                    <Td>{formatDate(p.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="helper">No properties yet.</div>
        )}
      </section>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'border-b-2 px-3 pb-2 text-sm font-medium',
        active ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
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
  if (normalized === 'active') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (normalized === 'inactive') {
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

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default AdminPortal;
