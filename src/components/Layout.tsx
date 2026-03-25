import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Menu, X, MessageSquare, Shield, LogOut, Plus, Bot, Image as ImageIcon, Video } from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return <Outlet />;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Top Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 bg-white z-10">
        <button onClick={() => setIsDrawerOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {location.pathname === '/admin' ? 'Admin Panel' : 'Indian GK'}
        </h1>
        <Link to="/" onClick={() => setIsDrawerOpen(false)} className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Plus className="w-6 h-6" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="absolute inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer Sidebar */}
      <aside className={`absolute top-0 left-0 bottom-0 w-72 bg-gray-900 text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-gray-900" />
            </div>
            <span className="font-semibold text-lg">Indian GK AI</span>
          </div>
          <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link
            to="/"
            onClick={() => setIsDrawerOpen(false)}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${location.pathname === '/' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
          >
            <Plus className="w-5 h-5" />
            New Chat
          </Link>
          
          {chats.length > 0 && (
            <div className="pt-4 pb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Recent Chats
            </div>
          )}
          {chats.map(chat => (
            <Link
              key={chat.id}
              to={`/c/${chat.id}`}
              onClick={() => setIsDrawerOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${location.pathname === `/c/${chat.id}` ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              {chat.mode === 'image' ? <ImageIcon className="w-4 h-4 flex-shrink-0" /> : chat.mode === 'video' ? <Video className="w-4 h-4 flex-shrink-0" /> : <MessageSquare className="w-4 h-4 flex-shrink-0" />}
              <span className="truncate text-sm">{chat.title || 'New Chat'}</span>
            </Link>
          ))}

          {role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Admin
              </div>
              <Link
                to="/admin"
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${location.pathname === '/admin' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                <Shield className="w-5 h-5" />
                Admin Panel
              </Link>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            {user.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-sm font-medium">{user.email?.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
};
