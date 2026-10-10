import React, { useState } from 'react';
import { API_BASE_URL } from '../config/api';

export default function SignUp({ onSignUpSuccess, onBackToHome }) {
  const [role, setRole] = useState('listener'); // 'listener' or 'artist'[cite: 8]
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [genre, setGenre] = useState('');
  const [inviteKey, setInviteKey] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check if passwords match before proceeding[cite: 8]
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (role === 'artist' && !inviteKey.trim()) {
      setError('Artist invite key is required.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('role', role);

    if (imageFile) {
      formData.append('file', imageFile);
    }

    let endpoint = `${API_BASE_URL}/api/signup/listener`;

    if (role === 'artist') {
      formData.append('genre', genre);
      formData.append('invite_key', inviteKey.trim());
      endpoint = `${API_BASE_URL}/api/signup/artist`;
    }

    try {
      // Send FormData in a single request (Do not manually set Content-Type header)
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSignUpSuccess();
      } else {
        // Safely parse FastAPI error details to prevent [object Object] rendering
        let errorMessage = 'Failed to register account.';
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMessage = data.detail.map(err => err.msg).join(', ');
          } else if (typeof data.detail === 'object') {
            errorMessage = JSON.stringify(data.detail);
          }
        }
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Signup network error:', err);
      setError('An error occurred connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#11131b] text-[#e1e2ed] flex items-center justify-center px-4 py-12">
      <div className="bg-[#1d1f27] border border-[#434655]/30 p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Create Account</h2>
          <button onClick={onBackToHome} className="text-[#c3c6d7] text-sm hover:text-white cursor-pointer">Back</button>
        </div>

        {/* Role Selection Toggle */}
        <div className="grid grid-cols-2 gap-2 bg-[#11131b] p-1.5 rounded-2xl border border-[#434655]/30">
          <button
            type="button"
            onClick={() => setRole('listener')}
            className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              role === 'listener' 
                ? 'bg-[#2563eb] text-white shadow-md' 
                : 'text-[#c3c6d7] hover:text-white'
            }`}
          >
            Listener
          </button>
          <button
            type="button"
            onClick={() => setRole('artist')}
            className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              role === 'artist' 
                ? 'bg-[#2563eb] text-white shadow-md' 
                : 'text-[#c3c6d7] hover:text-white'
            }`}
          >
            Artist
          </button>
        </div>

        {error && <p className="text-red-400 text-xs bg-red-950/40 p-3 rounded-lg border border-red-500/20">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">
              {role === 'artist' ? 'Artist Name' : 'Username'}
            </label>
            <input 
              type="text" 
              required 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#11131b] border border-[#434655]/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#b4c5ff]"
              placeholder={role === 'artist' ? 'e.g. Prism Audio' : 'e.g. Jane Doe'}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#11131b] border border-[#434655]/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#b4c5ff]"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#11131b] border border-[#434655]/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#b4c5ff]"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">Confirm Password</label>
            <input 
              type="password" 
              required 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#11131b] border border-[#434655]/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#b4c5ff]"
              placeholder="••••••••"
            />
          </div>

          {/* Conditional Field for Artists Only */}
          {role === 'artist' && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">Genre</label>
                <input 
                  type="text" 
                  required={role === 'artist'}
                  value={genre} 
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-[#11131b] border border-[#434655]/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#b4c5ff]"
                  placeholder="e.g. Ambient Glitch"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">
                  Artist Invite Key
                </label>
                <input 
                  type="text" 
                  required={role === 'artist'}
                  value={inviteKey} 
                  onChange={(e) => setInviteKey(e.target.value)}
                  className="w-full bg-[#11131b] border border-[#434655]/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#b4c5ff]"
                  placeholder="Enter your invite key"
                />
              </div>
            </>
          )}

          {/* Profile Image Input (Available for both Listeners and Artists) */}
          <div>
            <label className="block text-xs font-bold text-[#c3c6d7] uppercase tracking-wider mb-1">Profile Image</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              className="w-full text-xs text-[#c3c6d7] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#b4c5ff] file:text-[#002a78] hover:file:bg-[#b4c5ff]/80 cursor-pointer"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#2563eb] text-white py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-lg mt-2"
          >
            {loading ? 'Processing...' : role === 'artist' ? 'Create Artist Account' : 'Create Listener Account'}
          </button>
        </form>
      </div>
    </div>
  );
}