import React, { useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthModal() {
  const { authModalMode, openAuthModal, closeAuthModal, signIn, signUp } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authModalMode) return null;

  const isLogin = authModalMode === 'login';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(identifier, password);
      } else {
        await signUp(username, email, password);
      }
      setIdentifier('');
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#2A2A34] bg-[#16161B] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="auth-modal-title" className="font-display text-xl font-bold text-white">
            {isLogin ? 'Sign In to DOG MODS' : 'Create Creator Account'}
          </h2>
          <button
            type="button"
            onClick={closeAuthModal}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-[#1F1F26] hover:text-white focus-visible:outline-2 focus-visible:outline-[#F16436]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-[#0E0E11] p-1 border border-[#24242D]">
          <button
            type="button"
            onClick={() => {
              setError('');
              openAuthModal('login');
            }}
            className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              isLogin ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              openAuthModal('register');
            }}
            className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              !isLogin ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLogin ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Username or Email
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. WolfBuilder"
                className="w-full min-h-11 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="BedrockCreator"
                  className="w-full min-h-11 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@example.com"
                  className="w-full min-h-11 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full min-h-11 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F16436] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF7849] disabled:opacity-60"
          >
            {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            <span>{submitting ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
