import React, { useEffect, useState } from 'react';
import { apiFetch } from './lib/apiClient.js';

function PropertiesUnitsPage() {
  const [propertiesData, setPropertiesData] = useState(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      loadUnits(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  async function loadProperties() {
    try {
      setLoading(true);
      const res = await apiFetch(`/landlord/properties`);
      if (!res.ok) throw new Error('Failed to load properties');
      const data = await res.json();
      setPropertiesData(data);
      if (data.properties?.length) {
        setSelectedPropertyId(data.properties[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function loadUnits(propertyId) {
    try {
      setUnitsLoading(true);
      const res = await apiFetch(`/landlord/properties/${propertyId}/units`);
      if (!res.ok) throw new Error('Failed to load units');
      const data = await res.json();
      setUnits(data.units || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong fetching units');
    } finally {
      setUnitsLoading(false);
    }
  }

  if (loading && !propertiesData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading properties...</div>
      </div>
    );
  }

  const properties = propertiesData?.properties || [];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800">
          <div className="text-2xl font-bold text-sky-400">RentPay</div>
          <div className="text-xs text-slate-400 mt-1">Landlord Portal</div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 text-sm">
          <SidebarLink label="Dashboard" />
          <SidebarLink label="Properties & Units" active />
          <SidebarLink label="Tenants & Tenancies" />
          <SidebarLink label="Bills & Payments" />
          <SidebarLink label="Issues & Maintenance" />
          <SidebarLink label="Vacate & Applications" />
          <SidebarLink label="Settings" />
        </nav>
      </aside>

      <main className="flex-1 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Properties & Units</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your buildings and see which units are occupied or vacant.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Properties</h2>
            {properties.length ? (
              <ul className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {properties.map((p) => {
                  const active = p.id === selectedPropertyId;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setSelectedPropertyId(p.id)}
                        className={[
                          'w-full text-left px-3 py-2 rounded-lg border transition flex flex-col',
                          active
                            ? 'border-sky-500 bg-sky-50/70 text-sky-800'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.location && (
                          <span className="text-xs text-slate-500 mt-0.5">{p.location}</span>
                        )}
                        <span className="text-xs text-slate-500 mt-1">
                          {p.totalUnits} units • {p.occupied} occupied • {p.vacant} vacant
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">No properties added yet.</div>
            )}
          </section>

          <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Units {selectedPropertyId && `for property #${selectedPropertyId}`}
              </h2>
            </div>

            {unitsLoading ? (
              <div className="py-10 flex justify-center text-slate-500 text-sm">Loading units...</div>
            ) : units.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70">
                      <Th>Unit</Th>
                      <Th>Type</Th>
                      <Th align="right">Base Rent</Th>
                      <Th align="right">Waste Fee</Th>
                      <Th>Status</Th>
                      <Th>Tenant</Th>
                      <Th>Tenancy</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id} className="border-b border-slate-100 last:border-0">
                        <Td>{u.unit_code}</Td>
                        <Td>{u.type}</Td>
                        <Td align="right">{formatCurrency(u.base_rent)}</Td>
                        <Td align="right">{formatCurrency(u.waste_fee)}</Td>
                        <Td>
                          <StatusPill status={u.status} />
                        </Td>
                        <Td>
                          {u.tenancy?.tenant ? (
                            <div className="flex flex-col">
                              <span className="text-slate-800 text-xs sm:text-sm">
                                {u.tenancy.tenant.full_name}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {u.tenancy.tenant.phone}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No active tenant</span>
                          )}
                        </Td>
                        <Td>
                          {u.tenancy ? (
                            <span className="text-xs text-slate-600">
                              {u.tenancy.status} since {formatDate(u.tenancy.startDate)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10 flex justify-center text-slate-500 text-sm">
                No units found for this property.
              </div>
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

  if (normalized === 'occupied') {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (normalized === 'vacant') {
    colors = 'bg-red-50 text-red-700 border-red-100';
  } else if (normalized === 'maintenance') {
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

export default PropertiesUnitsPage;
