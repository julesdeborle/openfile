import React, { useState, useEffect } from 'react';

interface ChessAccount {
  username: string;
  linked_at: string;
  verified: boolean;
  player_data?: any;
}

interface AccountSettingsProps {
  user: any;
  token: string;
  onUpdateUser: (user: any) => void;
}

export function AccountSettings({ user, token, onUpdateUser }: AccountSettingsProps) {
  const [chessAccounts, setChessAccounts] = useState<{ [key: string]: ChessAccount }>({});
  const [linkingData, setLinkingData] = useState({ platform: 'chess.com', username: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setChessAccounts(user.chess_accounts || {});
  }, [user]);

  const linkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:8000/api/chess-accounts/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(linkingData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to link account');
      }

      setSuccess(`Successfully linked ${linkingData.platform} account!`);
      setLinkingData({ platform: 'chess.com', username: '' });
      
      // Refresh user data
      const userResponse = await fetch('http://localhost:8000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const updatedUser = await userResponse.json();
      onUpdateUser(updatedUser);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const unlinkAccount = async (platform: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/chess-accounts/unlink/${platform}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess(`Unlinked ${platform} account`);
        // Refresh user data
        const userResponse = await fetch('http://localhost:8000/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const updatedUser = await userResponse.json();
        onUpdateUser(updatedUser);
      }
    } catch (err) {
      setError('Failed to unlink account');
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      {/* Account Information Section */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/20">
        <h3 className="text-indigo-600 mb-4 text-xl font-semibold flex items-center gap-2">
          <span>👤</span> Account Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/70 p-4 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Username:</span>
            <span className="font-semibold text-gray-900">{user.username}</span>
          </div>
          <div className="bg-white/70 p-4 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Email:</span>
            <span className="font-semibold text-gray-900">{user.email}</span>
          </div>
          <div className="bg-white/70 p-4 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Member since:</span>
            <span className="font-semibold text-gray-900">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
          <div className="bg-white/70 p-4 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Email verified:</span>
            <span className="font-semibold text-gray-900">{user.email_verified ? '✅ Yes' : '❌ No'}</span>
          </div>
        </div>
      </div>

      {/* Chess Account Management Section */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/20">
        <h3 className="text-indigo-600 mb-2 text-xl font-semibold flex items-center gap-2">
          <span>🔗</span> Chess Account Management
        </h3>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          Link your Chess.com and Lichess accounts to analyze your games in the Analysis tab.
        </p>
        
        {Object.keys(chessAccounts).length > 0 ? (
          <div className="mb-8">
            <h4 className="text-gray-700 mb-4 text-base font-semibold">Linked Accounts</h4>
            {Object.entries(chessAccounts).map(([platform, account]) => (
              <div key={platform} className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-gradient-to-r from-green-50 to-white/80 border border-green-200 rounded-xl mb-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-xl">
                    {platform === 'chess.com' ? '♔' : '♛'}
                  </div>
                  <div className="flex flex-col gap-1">
                    <strong className="text-green-800 text-sm capitalize">{platform}</strong>
                    <span className="text-gray-700 font-semibold text-lg">{account.username}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      Linked {new Date(account.linked_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-800">
                    {account.verified ? '✅ Verified' : '⚠️ Unverified'}
                  </span>
                  <button 
                    onClick={() => unlinkAccount(platform)}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 text-sm flex items-center gap-2"
                  >
                    <span>🗑️</span> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-200 rounded-xl mb-8">
            <div className="text-5xl mb-4 opacity-70">🔗</div>
            <h4 className="text-indigo-600 mb-2 text-lg font-semibold">No Chess Accounts Linked</h4>
            <p className="text-gray-600">Link your chess accounts to unlock game analysis features!</p>
          </div>
        )}

        {/* Link Account Form */}
        <div className="border-t border-gray-200 pt-8">
          <h4 className="text-gray-700 mb-2 text-base font-semibold">Add New Chess Account</h4>
          <p className="text-gray-500 text-sm mb-4 leading-relaxed">
            Enter your exact username from Chess.com or Lichess.org. We'll verify it exists.
          </p>
          
          <form onSubmit={linkAccount} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">Platform</label>
                <select 
                  value={linkingData.platform}
                  onChange={(e) => setLinkingData(prev => ({ ...prev, platform: e.target.value }))}
                  className="px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-base font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                >
                  <option value="chess.com">♔ Chess.com</option>
                  <option value="lichess.org">♛ Lichess.org</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">Username</label>
                <input
                  type="text"
                  placeholder={`Your ${linkingData.platform} username`}
                  value={linkingData.username}
                  onChange={(e) => setLinkingData(prev => ({ ...prev, username: e.target.value }))}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading || !linkingData.username.trim()} 
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 whitespace-nowrap"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>🔗</span> Link Account
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-gradient-to-r from-red-50 to-white border border-red-300 text-red-800 px-4 py-3 rounded-lg font-medium flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div className="mt-4 bg-gradient-to-r from-green-50 to-white border border-green-300 text-green-800 px-4 py-3 rounded-lg font-medium">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{success}</span>
            </div>
            <div className="mt-2 text-sm text-green-700 bg-green-100 px-3 py-2 rounded-md">
              💡 You can now analyze your games in the <strong>Analysis</strong> tab!
            </div>
          </div>
        )}
      </div>

      {/* Account Actions Section */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-lg border border-white/20">
        <h3 className="text-indigo-600 mb-4 text-xl font-semibold flex items-center gap-2">
          <span>⚙️</span> Account Actions
        </h3>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white/50 border border-gray-200 rounded-lg hover:bg-white/80 transition-all duration-200">
            <div>
              <strong className="text-gray-700 block mb-1">Change Password</strong>
              <p className="text-gray-500 text-sm">Update your account password</p>
            </div>
            <button className="mt-4 md:mt-0 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold rounded-lg opacity-50 cursor-not-allowed">
              Coming Soon
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white/50 border border-gray-200 rounded-lg hover:bg-white/80 transition-all duration-200">
            <div>
              <strong className="text-gray-700 block mb-1">Export Data</strong>
              <p className="text-gray-500 text-sm">Download your account data</p>
            </div>
            <button className="mt-4 md:mt-0 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold rounded-lg opacity-50 cursor-not-allowed">
              Coming Soon
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border border-red-200 bg-red-50 rounded-lg">
            <div>
              <strong className="text-gray-700 block mb-1">Delete Account</strong>
              <p className="text-gray-500 text-sm">Permanently delete your account</p>
            </div>
            <button className="mt-4 md:mt-0 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg opacity-50 cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}