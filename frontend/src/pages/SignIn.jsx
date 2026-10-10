import React, { useState } from 'react';
import { API_BASE_URL } from '../config/api';

export default function SignIn({ onSignInSuccess, onSwitchToSignUp, onBackToHome }) {
  const [showPassword, setShowPassword] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInErrorMessage, setSignInErrorMessage] = useState('');

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    setSignInErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: signInEmail,
          password: signInPassword,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. Is the backend running?');
      }

      const data = await response.json();

      if (!response.ok) {
        // FastAPI returns errors under 'detail'
        throw new Error(data.detail || data.message || 'Failed to sign in');
      }

      // Pass the complete user profile data back up on success to trigger state & localStorage session saving
      onSignInSuccess(data);
    } catch (error) {
      console.error('Sign in error:', error);
      setSignInErrorMessage(error.message);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#08101a] text-[#e1e2ed] font-sans overflow-x-hidden flex flex-col items-center justify-center p-6">
      <header className="fixed top-0 left-0 w-full z-40 bg-[#08101a]/80 backdrop-blur-xl flex justify-between items-center px-8 h-16 border-b border-[#8d90a0]/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToHome}>
          <h1 className="font-black text-2xl tracking-tighter text-[#2563eb]">Sway</h1>
        </div>
        <button 
          onClick={onBackToHome}
          className="text-sm font-semibold text-[#c3c6d7] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Home
        </button>
      </header>

      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#2563eb]/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#0566d9]/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-[440px] bg-[#0d1825]/90 backdrop-blur-xl rounded-xl shadow-2xl p-10 relative z-10 flex flex-col gap-6 border border-[#2563eb]/20 mt-12">
        <div className="flex flex-col items-center gap-2 text-center mb-2">
          <div className="w-16 h-16 rounded-full bg-[#282a32] flex items-center justify-center shadow-lg relative mb-2 group">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#2563eb] to-[#3b82f6] opacity-20 blur-md group-hover:opacity-40 transition-opacity duration-500"></div>
            <span className="material-symbols-outlined text-[#2563eb] text-[32px]">lock</span>
          </div>
          <h1 className="text-2xl font-bold text-[#e1e2ed] tracking-tight">Welcome Back</h1>
          <p className="text-sm text-[#c3c6d7]">Enter your credentials to access Sway.</p>
        </div>

        {signInErrorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg text-center">
            {signInErrorMessage}
          </div>
        )}

        <form onSubmit={handleSignInSubmit} className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-[#c3c6d7] ml-1" htmlFor="email">
              Email or Username
            </label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c3c6d7]/50 group-focus-within:text-[#2563eb] transition-colors text-[20px]">
                mail
              </span>
              <input
                className="w-full h-12 bg-[#08101a] rounded-lg pl-11 pr-4 text-sm text-[#e1e2ed] outline-none border border-[#8d90a0]/20 focus:border-[#2563eb] focus:bg-[#0d1825] transition-all duration-300 placeholder:text-[#c3c6d7]/30"
                id="email"
                placeholder="user@example.com"
                type="text"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-[#c3c6d7] ml-1" htmlFor="password">
              Password
            </label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c3c6d7]/50 group-focus-within:text-[#2563eb] transition-colors text-[20px]">
                lock
              </span>
              <input
                className="w-full h-12 bg-[#08101a] rounded-lg pl-11 pr-12 text-sm text-[#e1e2ed] outline-none border border-[#8d90a0]/20 focus:border-[#2563eb] focus:bg-[#0d1825] transition-all duration-300 placeholder:text-[#c3c6d7]/30"
                id="password"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#c3c6d7]/50 hover:text-[#e1e2ed] transition-colors cursor-pointer"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          <button
            className="w-full h-12 mt-2 bg-[#2563eb] rounded-lg font-semibold text-sm text-white hover:bg-[#2563eb]/90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(37,99,235,0.3)] relative overflow-hidden group flex items-center justify-center cursor-pointer"
            type="submit"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
            Sign In
          </button>
        </form>

        <div className="mt-2 text-center">
          <span className="text-sm text-[#c3c6d7]">Don't have an account? </span>
          <button 
            onClick={onSwitchToSignUp}
            className="text-sm text-[#2563eb] hover:underline font-medium transition-colors bg-transparent border-none cursor-pointer"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}