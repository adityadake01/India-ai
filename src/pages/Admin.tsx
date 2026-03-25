import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { ShieldAlert, Users, Search, Activity } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  lastLoginAt: any;
  createdAt: any;
}

interface QueryData {
  id: string;
  userId: string;
  userEmail: string;
  query: string;
  timestamp: any;
  mode?: string;
}

export const Admin: React.FC = () => {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== 'admin') return;

    const usersRef = collection(db, 'users');
    const queriesRef = collection(db, 'queries');

    const qUsers = query(usersRef, orderBy('lastLoginAt', 'desc'));
    const qQueries = query(queriesRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData: UserData[] = [];
      snapshot.forEach((doc) => {
        usersData.push(doc.data() as UserData);
      });
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubQueries = onSnapshot(qQueries, (snapshot) => {
      const queriesData: QueryData[] = [];
      snapshot.forEach((doc) => {
        queriesData.push({ id: doc.id, ...doc.data() } as QueryData);
      });
      setQueries(queriesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'queries');
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubQueries();
    };
  }, [role]);

  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500 p-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-800">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <header className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor user activity and search queries.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <p className="text-xs text-gray-500 font-medium">Total Users</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <p className="text-xs text-gray-500 font-medium">Recent Queries</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{queries.length}</p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {/* Recent Queries Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-800">Recent Queries</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Query</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">Loading queries...</td>
                    </tr>
                  ) : queries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No recent queries found.</td>
                    </tr>
                  ) : (
                    queries.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-900 truncate max-w-[100px]" title={q.userEmail}>{q.userEmail.split('@')[0]}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            q.mode === 'image' ? 'bg-blue-100 text-blue-800' : 
                            q.mode === 'video' ? 'bg-pink-100 text-pink-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {q.mode || 'text'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[150px] truncate" title={q.query}>{q.query}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {q.timestamp?.toDate ? format(q.timestamp.toDate(), 'MMM d, h:mm a') : 'Just now'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-800">Users</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">Loading users...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">No users found.</td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                                {u.displayName?.charAt(0) || u.email.charAt(0)}
                              </div>
                            )}
                            <div className="max-w-[120px]">
                              <p className="text-xs font-medium text-gray-900 truncate">{u.displayName}</p>
                              <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {u.lastLoginAt?.toDate ? format(u.lastLoginAt.toDate(), 'MMM d, h:mm a') : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
