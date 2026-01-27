import { useEffect, useState } from 'react';
import AdminPortal from './AdminPortal.jsx';
import LandlordDashboard from './LandlordDashboard.jsx';
import CaretakerDashboard from './CaretakerDashboard.jsx';
import TenantHome from './TenantHome.jsx';
import TenantBillsPage from './TenantBillsPage.jsx';
import TenantTicketsPage from './TenantTicketsPage.jsx';
import AuthLogin from './AuthLogin.jsx';
import PublicListings from './PublicListings.jsx';
import { supabase } from './lib/supabaseClient.js';
import './App.css';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (!session && !window.location.pathname.toLowerCase().startsWith('/public')) {
    return <AuthLogin onLoggedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />;
  }

  // crude route switcher without react-router
  const path = window.location.pathname.toLowerCase();
  const isPublic = path.startsWith('/public');

  const topbar = session ? (
    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
      <div className="text-sm text-slate-600">
        Signed in as <span className="font-medium text-slate-800">{session?.user?.email}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>Routes: /admin /landlord /caretaker /tenant /tenant/bills /tenant/issues</span>
        <button onClick={handleLogout} className="text-xs rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          Logout
        </button>
      </div>
    </div>
  ) : null;

  let page = <AdminPortal />;
  if (isPublic) {
    page = <PublicListings />;
  } else if (path.startsWith('/landlord')) {
    page = <LandlordDashboard />;
  } else if (path.startsWith('/caretaker')) {
    page = <CaretakerDashboard />;
  } else if (path.startsWith('/tenant/issues')) {
    page = <TenantTicketsPage />;
  } else if (path.startsWith('/tenant/bills')) {
    page = <TenantBillsPage />;
  } else if (path.startsWith('/tenant')) {
    page = <TenantHome />;
  } else {
    page = <AdminPortal />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {topbar}
      {page}
    </div>
  );
}

export default App;
