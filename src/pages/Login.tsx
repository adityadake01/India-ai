import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bot } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white px-6 py-12 justify-between h-full">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-8">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Welcome to Indian GK
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Log in with your Google account to continue
        </p>
      </div>

      <div className="w-full space-y-4 pb-8">
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-gray-300 rounded-full shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>
      </div>
    </div>
  );
};
