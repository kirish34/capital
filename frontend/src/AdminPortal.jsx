import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';
import { supabase } from './lib/supabaseClient.js';

function AdminPortal() {
  const [activeTab, setActiveTab] = useState('landlords');
  const [userName, setUserName] = useState('Admin');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email;
      const fullName = data?.user?.user_metadata?.full_name;
      const derived = fullName || (email ? email.split('@')[0] : 'Admin');
      setUserName(derived);
    });
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="hero hero-banner">
        <p className="helper" style={{ fontWeight: 700, marginBottom: 4 }}>Capital Assets by SkyYalla Limited</p>
        <h1 className="hero-title">System Admin Panel</h1>
        <p className="hero-subtitle">{greeting}, {userName}.</p>
        <p className="helper" style={{ marginTop: 4 }}>{dateStr} • {timeStr}</p>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'landlords' ? 'active' : ''}`} onClick={() => setActiveTab('landlords')}>
          Landlords
        </button>
        <button className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`} onClick={() => setActiveTab('properties')}>
          Properties
        </button>
        <button className={`tab-btn ${activeTab === 'paybills' ? 'active' : ''}`} onClick={() => setActiveTab('paybills')}>
          Paybills
        </button>
      </div>

      {activeTab === 'landlords' && <LandlordsTab />}
      {activeTab === 'properties' && <PropertiesTab />}
      {activeTab === 'paybills' && <PaybillsTab />}
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
      if (!res.ok) throw new Error(json.message || 'Failed to create landlord');
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
      setCreateMessage(err.message || 'Failed to create landlord');
    } finally {
      setCreating(false);
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
      setEditMessage(err.message || 'Failed to update landlord');
    }
  }

  async function handleDeleteLandlord() {
    if (!editId) {
      setEditMessage('Select a landlord to delete.');
      return;
    }
    if (!window.confirm('Delete this landlord?')) return;
    try {
      setEditMessage('Deleting...');
      const res = await apiFetch(`/admin/landlords/${editId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to delete landlord');
      setEditMessage('Deleted.');
      setEditId('');
      await loadData();
    } catch (err) {
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
      setLoginMessage(err.message || 'Failed to create login');
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <div className="stack">
      {error && <div className="card-glass" style={{ color: '#b91c1c' }}>{error}</div>}

      <section className="card-glass">
        <h2 className="section-title">Register New Landlord</h2>
        <form onSubmit={handleCreateLandlord} className="form-grid">
          <div>
            <label className="helper">Type</label>
            <select className="input" value={landlordType} onChange={(e) => setLandlordType(e.target.value)}>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>

          {landlordType === 'individual' ? (
            <>
              <div>
                <label className="helper">Full Name (required)</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="helper">Phone (required)</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 07xx xxx xxx" />
              </div>
              <div>
                <label className="helper">Email (required)</label>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. landlord@example.com" />
              </div>
              <div>
                <label className="helper">National ID</label>
                <input className="input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. 12345678" />
              </div>
              <div>
                <label className="helper">KRA PIN</label>
                <input className="input" value={kraPin} onChange={(e) => setKraPin(e.target.value)} placeholder="e.g. A123456789B" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="helper">Company Name (required)</label>
                <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. JD Apartments Ltd" />
              </div>
              <div>
                <label className="helper">Company Contact Name (required)</label>
                <input className="input" value={companyContactName} onChange={(e) => setCompanyContactName(e.target.value)} placeholder="e.g. Jane Manager" />
              </div>
              <div>
                <label className="helper">Company Contact Phone (required)</label>
                <input className="input" value={companyContactPhone} onChange={(e) => setCompanyContactPhone(e.target.value)} placeholder="e.g. 07xx xxx xxx" />
              </div>
              <div>
                <label className="helper">Company Email (required)</label>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. accounts@company.com" />
              </div>
              <div>
                <label className="helper">Registration / Certificate</label>
                <input className="input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. Reg No / Cert No" />
              </div>
              <div>
                <label className="helper">KRA PIN</label>
                <input className="input" value={kraPin} onChange={(e) => setKraPin(e.target.value)} placeholder="e.g. A123456789B" />
              </div>
            </>
          )}

          <div>
            <label className="helper">Contract URL (optional)</label>
            <input className="input" value={contractUrl} onChange={(e) => setContractUrl(e.target.value)} placeholder="Link to signed agreement PDF" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Contract Notes</label>
            <textarea rows={2} className="input" value={contractNotes} onChange={(e) => setContractNotes(e.target.value)} placeholder="Key clauses, renewal date, etc." />
          </div>

          <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
            <div className="helper">{createMessage}</div>
            <button type="submit" disabled={creating} className="btn btn-primary">
              {creating ? 'Saving...' : 'Save Landlord'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-glass">
        <h2 className="section-title">Create Landlord Login</h2>
        <form onSubmit={handleCreateLogin} className="form-grid">
          <div>
            <label className="helper">Landlord</label>
            <select className="input" value={loginLandlordId} onChange={(e) => setLoginLandlordId(e.target.value)}>
              <option value="">Select landlord...</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id} disabled={!!l.authUserId}>
                  {l.name} {l.authUserId ? '(login linked)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="helper">Email</label>
            <input className="input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="login@example.com" />
          </div>
          <div>
            <label className="helper">Password</label>
            <input type="password" className="input" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Temp password" />
          </div>
          <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
            <div className="helper">{loginMessage}</div>
            <button type="submit" disabled={loginBusy} className="btn btn-primary">
              {loginBusy ? 'Creating...' : 'Create Login'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-glass">
        <h2 className="section-title">Edit / Delete Landlord</h2>
        <form onSubmit={handleUpdateLandlord} className="form-grid">
          <div>
            <label className="helper">Landlord</label>
            <select className="input" value={editId} onChange={(e) => handleChooseEdit(e.target.value)}>
              <option value="">Select landlord...</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="helper">Type</label>
            <select className="input" value={editFields.landlordType} onChange={(e) => setEditFields({ ...editFields, landlordType: e.target.value })}>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>
          {editFields.landlordType === 'individual' ? (
            <>
              <div>
                <label className="helper">Full Name</label>
                <input className="input" value={editFields.fullName} onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })} />
              </div>
              <div>
                <label className="helper">Phone</label>
                <input className="input" value={editFields.phone} onChange={(e) => setEditFields({ ...editFields, phone: e.target.value })} />
              </div>
              <div>
                <label className="helper">Email</label>
                <input className="input" value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} />
              </div>
              <div>
                <label className="helper">ID / Registration</label>
                <input className="input" value={editFields.idNumber} onChange={(e) => setEditFields({ ...editFields, idNumber: e.target.value })} />
              </div>
              <div>
                <label className="helper">KRA PIN</label>
                <input className="input" value={editFields.kraPin} onChange={(e) => setEditFields({ ...editFields, kraPin: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="helper">Company</label>
                <input className="input" value={editFields.companyName} onChange={(e) => setEditFields({ ...editFields, companyName: e.target.value })} />
              </div>
              <div>
                <label className="helper">Company Contact</label>
                <input className="input" value={editFields.companyContactName} onChange={(e) => setEditFields({ ...editFields, companyContactName: e.target.value })} />
              </div>
              <div>
                <label className="helper">Contact Phone</label>
                <input className="input" value={editFields.companyContactPhone} onChange={(e) => setEditFields({ ...editFields, companyContactPhone: e.target.value })} />
              </div>
              <div>
                <label className="helper">Company Email</label>
                <input className="input" value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} />
              </div>
              <div>
                <label className="helper">Registration / Cert</label>
                <input className="input" value={editFields.idNumber} onChange={(e) => setEditFields({ ...editFields, idNumber: e.target.value })} />
              </div>
              <div>
                <label className="helper">KRA PIN</label>
                <input className="input" value={editFields.kraPin} onChange={(e) => setEditFields({ ...editFields, kraPin: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label className="helper">Contract URL</label>
            <input className="input" value={editFields.contractUrl} onChange={(e) => setEditFields({ ...editFields, contractUrl: e.target.value })} />
          </div>
          <div>
            <label className="helper">Contract Notes</label>
            <textarea rows={2} className="input" value={editFields.contractNotes} onChange={(e) => setEditFields({ ...editFields, contractNotes: e.target.value })} />
          </div>
          <div className="flex gap-2" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
            <button type="button" onClick={handleDeleteLandlord} className="btn btn-ghost" style={{ color: '#b91c1c', borderColor: '#fecdd3', background: '#fff' }}>
              Delete Landlord
            </button>
            <div className="helper">{editMessage}</div>
          </div>
        </form>
      </section>

      <section className="card-glass">
        <h2 className="section-title">Landlords</h2>
        {assignError && <div className="helper" style={{ color: '#b91c1c' }}>{assignError}</div>}
        {loading ? (
          <div className="helper">Loading landlords...</div>
        ) : landlords.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
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
                  <tr key={l.id}>
                    <Td>{l.id}</Td>
                    <Td>
                      <div className="stack">
                        <span className="text-slate-800">{l.name}</span>
                        {l.contractUrl && (
                          <a href={l.contractUrl} target="_blank" rel="noreferrer" className="helper" style={{ color: '#1d4ed8' }}>
                            Contract
                          </a>
                        )}
                        {l.contractNotes && <span className="helper">{l.contractNotes}</span>}
                      </div>
                    </Td>
                    <Td>
                      <div className="stack">
                        <span>{l.phone}</span>
                        <span className="helper">{l.email}</span>
                        {l.companyContactName && (
                          <span className="helper">
                            Contact: {l.companyContactName} {l.companyContactPhone ? `(${l.companyContactPhone})` : ''}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="capitalize text-[12px]">{l.landlordType || 'individual'}</Td>
                    <Td>{l.companyName || '-'}</Td>
                    <Td>
                      <div className="stack">
                        <span className="helper">ID: {l.idNumber || '-'}</span>
                        <span className="helper">KRA: {l.kraPin || '-'}</span>
                      </div>
                    </Td>
                    <Td>
                      {l.paybill ? (
                        <div className="stack">
                          <span className="font-mono">{l.paybill.shortcode}</span>
                          <span className="helper">
                            {l.paybill.name} ({l.paybill.account_type})
                          </span>
                        </div>
                      ) : (
                        <span className="helper">None</span>
                      )}
                    </Td>
                    <Td>
                      {paybills.length ? (
                        <div className="stack">
                          <select className="input" defaultValue={l.paybill?.id || ''} onChange={(e) => handleAssignPaybill(l.id, e.target.value)}>
                            <option value="">Select...</option>
                            {paybills.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.shortcode} - {p.name}
                              </option>
                            ))}
                          </select>
                          {assigningId === l.id && <span className="helper">Saving...</span>}
                        </div>
                      ) : (
                        <span className="helper">No active paybills yet</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="helper">No landlords registered yet.</div>
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
      if (!res.ok) throw new Error(json.message || 'Failed to create paybill');
      setCreateMessage('Paybill registered successfully.');
      setShortcode('');
      setName('');
      setAccountType('wallet_per_tenancy');
      loadPaybills();
    } catch (err) {
      setCreateMessage(err.message || 'Failed to create paybill');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stack">
      {error && <div className="card-glass" style={{ color: '#b91c1c' }}>{error}</div>}

      <section className="card-glass">
        <h2 className="section-title">Register New Paybill</h2>
        <form onSubmit={handleCreatePaybill} className="form-grid">
          <div>
            <label className="helper">Shortcode</label>
            <input className="input" value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="e.g. 412345" />
          </div>
          <div>
            <label className="helper">Display Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent Wallet Main" />
          </div>
          <div>
            <label className="helper">Account Type</label>
            <select className="input" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="wallet_per_tenancy">Wallet per tenancy</option>
              <option value="wallet_per_unit">Wallet per unit</option>
              <option value="wallet_per_landlord">Wallet per landlord</option>
            </select>
          </div>
          <div className="flex items-center justify-between" style={{ gridColumn: '1 / -1' }}>
            <div className="helper">{createMessage}</div>
            <button type="submit" disabled={creating} className="btn btn-primary">
              {creating ? 'Saving...' : 'Save Paybill'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-glass">
        <h2 className="section-title">Paybill Numbers</h2>
        {loading ? (
          <div className="helper">Loading paybills...</div>
        ) : paybills.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
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
                  <tr key={p.id}>
                    <Td>{p.id}</Td>
                    <Td className="font-mono">{p.shortcode}</Td>
                    <Td>{p.name}</Td>
                    <Td>{p.account_type}</Td>
                    <Td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-muted'}`}>{p.is_active ? 'active' : 'inactive'}</span>
                    </Td>
                    <Td>{formatDate(p.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="helper">No paybills configured yet.</div>
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
  const [filterLandlordId, setFilterLandlordId] = useState('');

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

  const filteredProps = filterLandlordId
    ? properties.filter((p) => p.landlordId === Number(filterLandlordId))
    : properties;

  return (
    <div className="stack">
      {error && <div className="card-glass" style={{ color: '#b91c1c' }}>{error}</div>}

      <section className="card-glass">
        <h2 className="section-title">Add Property</h2>
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
            <label className="helper">Number of Units (optional)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
          <div>
            <label className="helper">Unit Name Prefix (applied to each unit, auto-numbered)</label>
            <input
              className="input"
              value={unitPrefix}
              onChange={(e) => setUnitPrefix(e.target.value)}
              placeholder="e.g. R"
            />
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
            <button type="submit" className="btn btn-primary">
              Save Property
            </button>
          </div>
        </form>
      </section>

      <section className="card-glass">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Properties</h2>
          <div className="flex gap-2 items-center">
            <span className="helper">Filter by landlord:</span>
            <select className="input" value={filterLandlordId} onChange={(e) => setFilterLandlordId(e.target.value)}>
              <option value="">All</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="helper">Loading properties...</div>
        ) : filteredProps.length ? (
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
            {filteredProps.map((p) => (
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
                <Td>
                  <span className="badge badge-muted">{p.status || 'active'}</span>
                </Td>
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

function Th({ children }) {
  return <th>{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={className}>{children}</td>;
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default AdminPortal;
