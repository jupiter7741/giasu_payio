import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, BookOpen, DollarSign, PieChart, Plus, CheckCircle, 
  User, Trash2, Edit2, Menu, X, CheckSquare, TrendingUp, AlertCircle, Wallet,
  GraduationCap, LogOut
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';

import './index.css'; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'default-tutor-app'
};

const appConfig = initializeApp(firebaseConfig);
const auth = getAuth(appConfig);
const db = getFirestore(appConfig);
const appId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default-tutor-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sessions');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Dữ liệu thật từ Firebase
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportStudentFilter, setReportStudentFilter] = useState('all');

  // Trạng thái Modals
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', feePerSession: 0 });

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newSession, setNewSession] = useState({ studentId: '', date: selectedDate, fee: 0, notes: '' });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newPayment, setNewPayment] = useState({ studentId: '', date: selectedDate, amount: 0 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Lắng nghe dữ liệu Real-time
  useEffect(() => {
    if (!user) return;
    const unsubStudents = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'students'), (s) => setStudents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSessions = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), (s) => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPayments = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'payments'), (s) => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubStudents(); unsubSessions(); unsubPayments(); };
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert("Lỗi đăng nhập: " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- CÁC HÀM TƯƠNG TÁC DATABASE --- //
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'students'), {
      ...newStudent,
      feePerSession: Number(newStudent.feePerSession),
      createdAt: serverTimestamp()
    });
    setShowStudentModal(false);
    setNewStudent({ name: '', feePerSession: 0 });
  };

  const handleAddSession = async (e) => {
    e.preventDefault();
    if (!newSession.studentId) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), {
      ...newSession,
      fee: Number(newSession.fee),
      createdAt: serverTimestamp()
    });
    setShowSessionModal(false);
    setNewSession({ studentId: '', date: selectedDate, fee: 0, notes: '' });
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.studentId || !newPayment.amount) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'payments'), {
      ...newPayment,
      amount: Number(newPayment.amount),
      createdAt: serverTimestamp()
    });
    setShowPaymentModal(false);
    setNewPayment({ studentId: '', date: selectedDate, amount: 0 });
  };

  const handleDeleteSession = async (id) => {
    if(window.confirm("Bạn có chắc muốn xóa buổi dạy này?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', id));
    }
  };

  const handleDeletePayment = async (id) => {
    if(window.confirm("Bạn có chắc muốn xóa khoản thanh toán này?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'payments', id));
    }
  };

  // --- XỬ LÝ SỐ LIỆU --- //
  const studentStats = useMemo(() => {
    return students.map(student => {
      const s = sessions.filter(x => x.studentId === student.id);
      const p = payments.filter(x => x.studentId === student.id);
      const earned = s.reduce((sum, x) => sum + Number(x.fee), 0);
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
      monthlyMap[month].earned += Number(s.fee);
      monthlyMap[month].sessionCount += 1;
    });
    filteredPayments.forEach(p => {
      const month = p.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, earned: 0, paid: 0, sessionCount: 0 };
      monthlyMap[month].paid += Number(p.amount);
    });
    const sorted = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    return { 
      monthlyData: sorted, 
      summary: { 
        totalEarned: sorted.reduce((s, m) => s + m.earned, 0), 
        totalPaid: sorted.reduce((s, m) => s + m.paid, 0), 
        totalSessions: sorted.reduce((s, m) => s + m.sessionCount, 0), 
        totalDebt: sorted.reduce((s, m) => s + (m.earned - m.paid), 0) 
      } 
    };
  }, [sessions, payments, reportStudentFilter]);

  const sessionsOnSelectedDate = sessions.filter(s => s.date === selectedDate);

  const formatVND = (a) => new Intl.NumberFormat('vi-VN').format(a || 0) + ' đ';
  const getDayName = (dateString) => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[new Date(dateString).getDay()];
  };

  if (authLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div></div>;

  // MÀN HÌNH ĐĂNG NHẬP
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8FAFC]">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full border border-gray-100">
           <div className="flex justify-center mb-4">
              <GraduationCap size={48} className="text-emerald-500" />
           </div>
           <h1 className="text-2xl font-extrabold text-blue-600 mb-6">💙 CỦA PAYIO</h1>
           <button onClick={handleGoogleLogin} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
             Đăng nhập với Google
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-gray-800">
      
      {/* Overlay Mobile */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar (KHÔNG ĐỔI) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 shadow-sm transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-6 flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-2">
              <div className="text-blue-500 relative">
                 <span className="absolute -top-1 -left-1 text-yellow-400 text-xs">✦</span>
                 <GraduationCap size={28} className="text-emerald-500" />
              </div>
              <h1 className="text-xl font-extrabold text-blue-600 uppercase tracking-tight flex items-center gap-1">
                <span className="text-blue-500">💙</span> CỦA PAYIO
              </h1>
            </div>
            <button className="md:hidden text-gray-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24} /></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<CheckSquare size={20} />} label="Chấm công" active={activeTab === 'sessions'} onClick={() => {setActiveTab('sessions'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<User size={20} />} label="Quản lý học sinh" active={activeTab === 'students'} onClick={() => {setActiveTab('students'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<Wallet size={20} />} label="Thanh toán" active={activeTab === 'payments'} onClick={() => {setActiveTab('payments'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<PieChart size={20} />} label="Báo cáo" active={activeTab === 'reports'} onClick={() => {setActiveTab('reports'); setIsMobileMenuOpen(false);}} />
        </nav>

        <div className="p-5 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <User size={20} />
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-gray-900 text-sm truncate">{user.displayName || "Giáo viên"}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-gray-300 hover:text-red-500 transition"><LogOut size={20} /></button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Mobile (KHÔNG ĐỔI) */}
        <header className="md:hidden p-4 bg-white border-b border-gray-100 flex justify-between items-center z-10 shadow-sm">
             <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-blue-600 text-lg flex items-center gap-1">
                  <span className="text-blue-500">💙</span> CỦA PAYIO
                </h1>
             </div>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 bg-gray-50 rounded-lg"><Menu size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
           
           {/* TAB: CHẤM CÔNG (Giữ nguyên giao diện, thêm tính năng map dữ liệu) */}
           {activeTab === 'sessions' && (
              <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Chấm công giảng dạy</h2>
                    <button onClick={() => setShowSessionModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition">
                      <CheckSquare size={18} /> Chấm công thủ công (Học bù)
                    </button>
                 </div>
                 
                 <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="text-blue-600" size={20} />
                        <span className="font-bold text-gray-800">Lịch dạy ngày:</span>
                        <span className="text-emerald-600 font-bold">{getDayName(selectedDate)}</span>
                      </div>
                      <p className="text-gray-500 italic text-sm mt-1">Chọn ngày để xem và chấm công các buổi học.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Chọn ngày:</span>
                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                        className="border border-gray-300 p-2.5 rounded-lg bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm w-36" 
                      />
                    </div>
                 </div>

                 <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
                    <div className="p-5 border-b border-gray-100">
                      <h3 className="font-bold text-gray-800">Lịch sử chấm công ({selectedDate})</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white text-gray-500 border-b border-gray-100">
                          <tr>
                            <th className="p-4 font-medium">Ngày dạy</th>
                            <th className="p-4 font-medium text-center">Học sinh</th>
                            <th className="p-4 font-medium text-center">Ghi chú</th>
                            <th className="p-4 font-medium text-center">Tiền công</th>
                            <th className="p-4 font-medium text-right pr-6">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sessionsOnSelectedDate.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="p-12 text-center text-gray-500">Chưa có lịch sử giảng dạy.</td>
                            </tr>
                          ) : (
                            sessionsOnSelectedDate.map(s => (
                              <tr key={s.id} className="hover:bg-gray-50">
                                <td className="p-4">{s.date}</td>
                                <td className="p-4 text-center font-bold">{students.find(st => st.id === s.studentId)?.name}</td>
                                <td className="p-4 text-center text-gray-500">{s.notes || '-'}</td>
                                <td className="p-4 text-center font-bold text-blue-600">{formatVND(s.fee)}</td>
                                <td className="p-4 text-right pr-6"><button onClick={() => handleDeleteSession(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} className="inline-block"/></button></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                 </div>
              </div>
           )}

           {/* TAB: QUẢN LÝ HỌC SINH */}
           {activeTab === 'students' && (
              <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Học sinh & Lịch giảng dạy</h2>
                    <button onClick={() => setShowStudentModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition">
                      <Plus size={18} /> Thêm học sinh
                    </button>
                 </div>
                 
                 {studentStats.length === 0 ? (
                    <div className="text-center p-12 text-gray-400 bg-white border border-dashed rounded-xl">Chưa có học sinh nào. Hãy thêm học sinh!</div>
                 ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                      {studentStats.map(s => (
                        <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 min-h-[200px]">
                           <div className="flex-1 flex flex-col">
                              <div className="mb-4">
                                 <h3 className="text-xl font-bold text-gray-900">{s.name}</h3>
                                 <p className="text-sm text-gray-400 mt-1">{formatVND(s.feePerSession)} / buổi</p>
                              </div>
                              <div className="mt-auto space-y-2.5 text-sm">
                                 <div className="flex justify-between"><span className="text-gray-400">Đã dạy:</span> <span className="font-bold text-gray-900">{s.totalSessions} buổi</span></div>
                                 <div className="flex justify-between"><span className="text-gray-400">Thành tiền:</span> <span className="font-bold text-blue-600">{formatVND(s.totalEarned)}</span></div>
                                 <div className="flex justify-between pt-2.5 border-t border-gray-100"><span className="text-gray-400">Còn nợ:</span> <span className={`font-bold ${s.debt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatVND(s.debt)}</span></div>
                              </div>
                           </div>
                           
                           <div className="hidden md:block w-px bg-gray-100"></div>
                           
                           <div className="flex-1 flex flex-col justify-center text-center">
                              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">ĐỢT HỌC HIỆN TẠI</h4>
                              <div className="border border-dashed border-gray-200 bg-gray-50/50 rounded-xl py-6 px-4 text-sm text-gray-400 italic mb-4">
                                Chưa thiết lập đợt học.
                              </div>
                              <button onClick={() => alert("Tính năng lập lịch sẽ cập nhật sau")} className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
                                <Edit2 size={14} /> Nhập / Đổi đợt học
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           )}

           {/* TAB: QUẢN LÝ THANH TOÁN */}
           {activeTab === 'payments' && (
              <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Quản lý Thanh toán</h2>
                    <button onClick={() => setShowPaymentModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition">
                      <DollarSign size={18} /> Nhập tiền đã nhận
                    </button>
                 </div>
                 
                 <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                          <tr>
                            <th className="p-5 font-medium w-1/4">Ngày nhận</th>
                            <th className="p-5 font-medium text-center w-1/4">Học sinh</th>
                            <th className="p-5 font-medium text-center w-1/4">Số tiền</th>
                            <th className="p-5 font-medium text-right pr-8 w-1/4">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {payments.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">Chưa có giao dịch.</td></tr>
                          ) : (
                            payments.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50/50 transition">
                                <td className="p-5 text-gray-600">{p.date}</td>
                                <td className="p-5 font-bold text-gray-900 text-center">{students.find(s => s.id === p.studentId)?.name || 'N/A'}</td>
                                <td className="p-5 text-center font-bold text-emerald-600">+{formatVND(p.amount)}</td>
                                <td className="p-5 text-right pr-8">
                                  <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={18} className="inline-block" /></button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                 </div>
              </div>
           )}

           {/* TAB: BÁO CÁO */}
           {activeTab === 'reports' && (
              <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Báo cáo & Thống kê</h2>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">Học sinh:</span>
                      <select value={reportStudentFilter} onChange={(e) => setReportStudentFilter(e.target.value)} className="border border-gray-200 py-2 px-3 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-gray-700 shadow-sm w-48">
                        <option value="all">-- Tất cả học sinh --</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                    <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm h-[120px] flex flex-col justify-between">
                       <div className="flex justify-between items-start">
                         <span className="text-gray-500 text-sm font-medium">Tổng buổi dạy</span>
                         <div className="bg-blue-50 p-2 rounded-xl text-blue-500"><BookOpen size={18} /></div>
                       </div>
                       <div className="text-2xl font-extrabold text-gray-900">{reportData.summary.totalSessions}</div>
                    </div>
                    <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm h-[120px] flex flex-col justify-between">
                       <div className="flex justify-between items-start">
                         <span className="text-gray-500 text-sm font-medium">Tổng thu nhập</span>
                         <div className="bg-emerald-50 p-2 rounded-xl text-emerald-500"><TrendingUp size={18} /></div>
                       </div>
                       <div className="text-2xl font-extrabold text-gray-900">{formatVND(reportData.summary.totalEarned)}</div>
                    </div>
                    <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm h-[120px] flex flex-col justify-between">
                       <div className="flex justify-between items-start">
                         <span className="text-gray-500 text-sm font-medium">Đã thanh toán</span>
                         <div className="bg-teal-50 p-2 rounded-xl text-teal-500"><CheckCircle size={18} /></div>
                       </div>
                       <div className="text-2xl font-extrabold text-gray-900">{formatVND(reportData.summary.totalPaid)}</div>
                    </div>
                    <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm h-[120px] flex flex-col justify-between">
                       <div className="flex justify-between items-start">
                         <span className="text-gray-500 text-sm font-medium">Tiền còn nợ</span>
                         <div className="bg-red-50 p-2 rounded-xl text-red-500"><AlertCircle size={18} /></div>
                       </div>
                       <div className="text-2xl font-extrabold text-gray-900">{formatVND(reportData.summary.totalDebt)}</div>
                    </div>
                 </div>

                 <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mt-6 h-[400px] flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-8 text-lg">Biểu đồ thu nhập theo tháng</h3>
                    <div className="flex-1 w-full -ml-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 13}} dy={15} />
                          <YAxis yAxisId="left" tickFormatter={(value) => `${value / 1000}k`} axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 13}} dx={-10} width={60} />
                          <RechartsTooltip formatter={(value) => formatVND(value)} cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Legend wrapperStyle={{ paddingTop: '30px' }} iconType="circle" iconSize={8} />
                          <Bar yAxisId="left" dataKey="earned" name="Tiền công" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                          <Bar yAxisId="left" dataKey="paid" name="Đã nhận" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
              </div>
           )}
        </div>
      </main>

      {/* --- MODALS PHỤ (Không làm vỡ layout chính) --- */}
      
      {/* Modal Thêm Học Sinh */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4">Thêm học sinh mới</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tên học sinh</label>
                <input required type="text" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Học phí / Buổi (VNĐ)</label>
                <input required type="number" value={newStudent.feePerSession} onChange={e => setNewStudent({...newStudent, feePerSession: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setShowStudentModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Lưu học sinh</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chấm Công */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4">Chấm công thủ công</h3>
            <form onSubmit={handleAddSession} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Học sinh</label>
                <select required value={newSession.studentId} onChange={e => {
                  const student = students.find(s => s.id === e.target.value);
                  setNewSession({...newSession, studentId: e.target.value, fee: student ? student.feePerSession : 0});
                }} className="w-full border p-2 rounded-lg">
                  <option value="">-- Chọn học sinh --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngày dạy</label>
                <input required type="date" value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tiền công (Có thể sửa đổi)</label>
                <input required type="number" value={newSession.fee} onChange={e => setNewSession({...newSession, fee: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ghi chú (Tùy chọn)</label>
                <input type="text" value={newSession.notes} onChange={e => setNewSession({...newSession, notes: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setShowSessionModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Lưu chấm công</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thanh Toán */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4">Nhập tiền đã nhận</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Học sinh thanh toán</label>
                <select required value={newPayment.studentId} onChange={e => setNewPayment({...newPayment, studentId: e.target.value})} className="w-full border p-2 rounded-lg">
                  <option value="">-- Chọn học sinh --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngày nhận</label>
                <input required type="date" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Số tiền (VNĐ)</label>
                <input required type="number" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="w-full border p-2 rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Lưu thanh toán</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        active 
          ? 'bg-emerald-50 text-emerald-700' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <span className={active ? 'text-emerald-600' : 'text-gray-400'}>{icon}</span>
      {label}
    </button>
  );
}

import { createRoot } from 'react-dom/client';
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}