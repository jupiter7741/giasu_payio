import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, BookOpen, DollarSign, PieChart, Plus, CheckCircle, 
  Clock, CalendarDays, User, Trash2, Edit2, Menu, X, CheckSquare, TrendingUp, AlertCircle, Wallet,
  CalendarCheck, GraduationCap, LogOut
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
  GoogleAuthProvider, signInWithPopup, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  serverTimestamp 
} from 'firebase/firestore';

// --- Khởi tạo Firebase với Create React App ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || 'default-tutor-app'
};

const appConfig = initializeApp(firebaseConfig);
const auth = getAuth(appConfig);
const db = getFirestore(appConfig);
const appId = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'default-tutor-app';

const DAYS_OF_WEEK = [
  { id: 'T2', label: 'T2', gcal: 'MO' },
  { id: 'T3', label: 'T3', gcal: 'TU' },
  { id: 'T4', label: 'T4', gcal: 'WE' },
  { id: 'T5', label: 'T5', gcal: 'TH' },
  { id: 'T6', label: 'T6', gcal: 'FR' },
  { id: 'T7', label: 'T7', gcal: 'SA' },
  { id: 'CN', label: 'CN', gcal: 'SU' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sessions');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modals
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', feePerSession: 0, notes: '' });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ startDate: '', endDate: '', time: '17:00', days: [] });
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newSession, setNewSession] = useState({ studentId: '', date: new Date().toISOString().split('T')[0], duration: 1.5, notes: '' });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newPayment, setNewPayment] = useState({ studentId: '', date: new Date().toISOString().split('T')[0], amount: 0, notes: '' });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportStudentFilter, setReportStudentFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert("Lỗi đăng nhập: Bạn đang ở môi trường thử nghiệm nên Popup Google bị chặn. Vui lòng deploy app lên web để dùng tính năng này!");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  useEffect(() => {
    if (!user) { setDataLoading(false); return; }
    const unsubStudents = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'students'), (s) => setStudents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSessions = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), (s) => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPayments = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'payments'), (s) => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    setDataLoading(false);
    return () => { unsubStudents(); unsubSessions(); unsubPayments(); };
  }, [user]);

  const studentStats = useMemo(() => {
    return students.map(student => {
      const s = sessions.filter(x => x.studentId === student.id);
      const p = payments.filter(x => x.studentId === student.id);
      const earned = s.reduce((sum, x) => sum + (x.fee || student.feePerSession), 0);
      const paid = p.reduce((sum, x) => sum + Number(x.amount), 0);
      return { ...student, totalEarned: earned, totalSessions: s.length, totalPaid: paid, debt: earned - paid };
    });
  }, [students, sessions, payments]);

  const reportData = useMemo(() => {
    let filteredSessions = reportStudentFilter === 'all' ? sessions : sessions.filter(s => s.studentId === reportStudentFilter);
    let filteredPayments = reportStudentFilter === 'all' ? payments : payments.filter(p => p.studentId === reportStudentFilter);
    const monthlyMap = {};
    filteredSessions.forEach(s => {
      const month = s.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, earned: 0, paid: 0, sessionCount: 0 };
      monthlyMap[month].earned += s.fee || 0;
      monthlyMap[month].sessionCount += 1;
    });
    filteredPayments.forEach(p => {
      const month = p.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, earned: 0, paid: 0, sessionCount: 0 };
      monthlyMap[month].paid += Number(p.amount);
    });
    const sorted = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    return { monthlyData: sorted, summary: { totalEarned: sorted.reduce((s, m) => s + m.earned, 0), totalPaid: sorted.reduce((s, m) => s + m.paid, 0), totalSessions: sorted.reduce((s, m) => s + m.sessionCount, 0), totalDebt: sorted.reduce((s, m) => s + (m.earned - m.paid), 0) } };
  }, [sessions, payments, reportStudentFilter]);

  const studentsOnDate = useMemo(() => {
    const dayId = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' }[new Date(selectedDate).getDay()];
    return students.filter(s => s.schedule && selectedDate >= s.schedule.startDate && selectedDate <= s.schedule.endDate && s.schedule.days.includes(dayId));
  }, [students, selectedDate]);

  const formatVND = (a) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(a || 0);

  if (authLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div></div>;

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
      <aside className="hidden md:flex flex-col w-64 bg-white border-r z-10 shadow-sm">
        <div className="p-6 border-b flex items-center gap-3">
            <div className="text-green-600"><GraduationCap size={32} /></div>
            <h1 className="text-xl font-extrabold text-green-600 whitespace-nowrap">💙 CỦA PAYIO</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<CheckSquare />} label="Chấm công" active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} />
          <NavItem icon={<User />} label="Quản lý học sinh" active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
          <NavItem icon={<Wallet />} label="Thanh toán" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} />
          <NavItem icon={<PieChart />} label="Báo cáo" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>
        {user && !user.isAnonymous && (
           <div className="p-4 border-t text-xs text-gray-500 truncate">{user.email}</div>
        )}
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden p-4 bg-white border-b flex justify-between items-center">
             <h1 className="font-extrabold text-green-600">💙 CỦA PAYIO</h1>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
           {activeTab === 'sessions' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Chấm công giảng dạy</h2>
                    <button onClick={openManualSessionModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Học bù</button>
                 </div>
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border p-2 rounded-lg" />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentsOnDate.map(s => {
                      const checked = sessions.some(x => x.studentId === s.id && x.date === selectedDate);
                      return (
                        <div key={s.id} className="bg-white p-4 border rounded-xl flex justify-between items-center">
                            <span>{s.name}</span>
                            {checked ? <span className="text-green-600 font-bold">Đã chấm</span> : <button onClick={() => handleQuickAddSession(s)} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm">Chấm công</button>}
                        </div>
                      )
                    })}
                 </div>
              </div>
           )}
           {/* Thêm các tab khác tương tự... */}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${active ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}`}>
      <span className={active ? 'text-green-600' : 'text-gray-400'}>{icon}</span>{label}
    </button>
  );
}