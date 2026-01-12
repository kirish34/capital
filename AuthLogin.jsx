import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient.js';

function AuthLogin({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // login | signup
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Logged in');
        onLoggedIn?.(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Signup successful. Link this user to a role in backend.');
        onLoggedIn?.(data.user);
      }
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white shadow-sm border border-slate-100 rounded-xl p-6 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Rent System Login</h1>
        <p className="text-xs text-slate-500 mb-4">
          {mode === 'login' ? 'Sign in with your account.' : 'Create a new account then link to a role.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {message && <div className="text-xs text-slate-500">{message}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 mt-1"
          >
            {busy ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>
        <div className="mt-4 text-xs text-slate-500 text-center">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button className="text-sky-600 hover:underline" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="text-sky-600 hover:underline" onClick={() => setMode('login')}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthLogin;
