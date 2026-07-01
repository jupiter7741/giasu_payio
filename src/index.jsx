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

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Dữ liệu thật từ Firebase
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportStudentFilter, setReportStudentFilter] = useState('all');

  // Trạng thái Modals
  const [showStudentModal, setShowStudentModal] = useState({ show: false, editData: null });
  const [newStudent, setNewStudent] = useState({ name: '', feePerSession: 0 });

  const [showScheduleModal, setShowScheduleModal] = useState({ show: false, student: null, editScheduleId: null });
  const [scheduleForm, setScheduleForm] = useState({ startDate: selectedDate, endDate: '', time: '17:00', days: [] });

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

  // --- HÀM TƯƠNG TÁC DATABASE --- //

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name) return;
    
    if (showStudentModal.editData) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'students', showStudentModal.editData.id), {
        name: newStudent.name,
        feePerSession: Number(newStudent.feePerSession)
      });
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'students'), {
        name: newStudent.name,
        feePerSession: Number(newStudent.feePerSession),
        schedules: [], 
        createdAt: serverTimestamp()
      });
    }
    setShowStudentModal({ show: false, editData: null });
    setNewStudent({ name: '', feePerSession: 0 });
  };

  const openEditStudent = (student) => {
    setNewStudent({ name: student.name, feePerSession: student.feePerSession });
    setShowStudentModal({ show: true, editData: student });
  };

  // --- QUẢN LÝ ĐỢT HỌC (SCHEDULES) --- //
  const handleSaveSchedule = async () => {
    if (scheduleForm.days.length === 0 || !showScheduleModal.student) return;
    
    const studentRef = doc(db, 'artifacts', appId, 'users', user.uid, 'students', showScheduleModal.student.id);
    const currentSchedules = showScheduleModal.student.schedules || [];
    
    let newSchedules;
    if (showScheduleModal.editScheduleId) {
         newSchedules = currentSchedules.map(sch => 
             sch.id === showScheduleModal.editScheduleId ? {
                 ...sch,
                 startDate: scheduleForm.startDate,
                 endDate: scheduleForm.endDate || null,
                 time: scheduleForm.time,
                 days: scheduleForm.days
             } : sch
         );
    } else {
         const newSchedule = {
             id: Date.now().toString(),
             startDate: scheduleForm.startDate,
             endDate: scheduleForm.endDate || null,
             time: scheduleForm.time,
             days: scheduleForm.days,
             createdAt: new Date().toISOString()
         };
         newSchedules = [...currentSchedules, newSchedule];
    }

    await updateDoc(studentRef, {
      schedules: newSchedules
    });

    setShowScheduleModal({ show: false, student: null, editScheduleId: null });
    setScheduleForm({ startDate: selectedDate, endDate: '', time: '17:00', days: [] });
  };

  const openScheduleModal = (student, scheduleToEdit = null) => {
    if (scheduleToEdit) {
        setScheduleForm({
            startDate: scheduleToEdit.startDate,
            endDate: scheduleToEdit.endDate || '',
            time: scheduleToEdit.time,
            days: scheduleToEdit.days || []
        });
        setShowScheduleModal({ show: true, student: student, editScheduleId: scheduleToEdit.id });
    } else {
        setScheduleForm({ startDate: selectedDate, endDate: '', time: '17:00', days: [] });
        setShowScheduleModal({ show: true, student: student, editScheduleId: null });
    }
  };

  const toggleDay = (day) => {
    setScheduleForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  // --- XUẤT LỊCH RA GOOGLE CALENDAR QUA URL --- //
  const exportToCalendar = (student, schedule) => {
    const [year, month, date] = schedule.startDate.split('-');
    const [hour, minute] = schedule.time.split(':');
    let d = new Date(year, month - 1, date, hour, minute, 0);
    
    const dayMapToNum = { 'CN': 0, 'T2': 1, 'T3': 2, 'T4': 3, 'T5': 4, 'T6': 5, 'T7': 6 };
    const selectedNums = schedule.days.map(day => dayMapToNum[day]);
    
    // Tìm ngày đầu tiên khớp với các thứ đã chọn để làm ngày bắt đầu sự kiện
    let currentDay = d.getDay();
    let daysToAdd = 0;
    while (!selectedNums.includes((currentDay + daysToAdd) % 7)) {
        daysToAdd++;
        if (daysToAdd > 7) break; // Tránh loop vô hạn
    }
    d.setDate(d.getDate() + daysToAdd);
    
    // Hàm format thời gian theo chuẩn YYYYMMDDTHHMMSS
    const formatGCalDate = (dateObj) => {
      return dateObj.getFullYear().toString() + 
             (dateObj.getMonth() + 1).toString().padStart(2, '0') + 
             dateObj.getDate().toString().padStart(2, '0') + 'T' + 
             dateObj.getHours().toString().padStart(2, '0') + 
             dateObj.getMinutes().toString().padStart(2, '0') + '00';
    };
    
    const dtstart = formatGCalDate(d);
    
    // Mặc định mỗi ca 1.5 tiếng (90 phút)
    const endD = new Date(d.getTime() + 90 * 60000); 
    const dtend = formatGCalDate(endD);
    
    const byDayMap = { 'CN': 'SU', 'T2': 'MO', 'T3': 'TU', 'T4': 'WE', 'T5': 'TH', 'T6': 'FR', 'T7': 'SA' };
    const byDays = schedule.days.map(day => byDayMap[day]).join(',');
    
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
    if (schedule.endDate) {
        const [eYear, eMonth, eDate] = schedule.endDate.split('-');
        // Google URL RRULE UNTIL thường chuộng UTC (kết thúc bằng Z). Để chắc chắn quét hết ngày, cho giờ là 23:59:59Z
        rrule += `;UNTIL=${eYear}${eMonth}${eDate}T235959Z`;
    }
    
    const details = `Lịch giảng 💙 của Payio`;
    
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', `Dạy học - ${student.name}`);
    url.searchParams.append('dates', `${dtstart}/${dtend}`);
    url.searchParams.append('details', details);
    url.searchParams.append('recur', rrule);
    
    window.open(url.toString(), '_blank');
  };

  // Các hàm chấm công / thanh toán
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
  
  const handleQuickAddSession = async (student) => {
    if(!user) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), {
      studentId: student.id,
      date: selectedDate,
      fee: Number(student.feePerSession),
      notes: 'Chấm công nhanh theo lịch',
      createdAt: serverTimestamp()
    });
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
    if(window.confirm("Bạn có chắc muốn xóa buổi dạy này?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', id));
  };

  const handleDeletePayment = async (id) => {
    if(window.confirm("Bạn có chắc muốn xóa khoản thanh toán này?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'payments', id));
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
  
  const studentsOnDate = useMemo(() => {
    if (!selectedDate || students.length === 0) return [];
    const jsDay = new Date(selectedDate).getDay();
    const dayMap = {0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7'};
    const dayString = dayMap[jsDay];
    
    return students.filter(student => {
       if (!student.schedules || student.schedules.length === 0) return false;
       return student.schedules.some(sch => {
           const isAfterStart = selectedDate >= sch.startDate;
           const isBeforeEnd = !sch.endDate || selectedDate <= sch.endDate;
           const hasDay = sch.days.includes(dayString);
           return isAfterStart && isBeforeEnd && hasDay;
       });
    });
  }, [students, selectedDate]);

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
    if (!dateString) return '';
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[new Date(dateString).getDay()];
  };
  const formatDateVN = (dateString) => dateString.split('-').reverse().join('/');

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

      {/* Sidebar */}
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
        {/* Header Mobile */}
        <header className="md:hidden p-4 bg-white border-b border-gray-100 flex justify-between items-center z-10 shadow-sm">
             <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-blue-600 text-lg flex items-center gap-1">
                  <span className="text-blue-500">💙</span> CỦA PAYIO
                </h1>
             </div>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 bg-gray-50 rounded-lg"><Menu size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
           
           {/* TAB: CHẤM CÔNG */}
           {activeTab === 'sessions' && (
              <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Chấm công giảng dạy</h2>
                    <button onClick={() => setShowSessionModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition">
                      <CheckSquare size={18} /> Chấm công thủ công (Học bù)
                    </button>
                 </div>
                 
                 <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="text-blue-600" size={20} />
                          <span className="font-bold text-gray-800">Lịch dạy ngày:</span>
                          <span className="text-emerald-600 font-bold">{getDayName(selectedDate)}</span>
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
                    
                    {studentsOnDate.length > 0 ? (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                         {studentsOnDate.map(student => {
                           const isChecked = sessions.some(s => s.studentId === student.id && s.date === selectedDate);
                           const jsDay = new Date(selectedDate).getDay();
                           const dayMap = {0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7'};
                           const activeSch = student.schedules?.find(sch => selectedDate >= sch.startDate && (!sch.endDate || selectedDate <= sch.endDate) && sch.days.includes(dayMap[jsDay]));
               
                           return (
                             <div key={student.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                               <div>
                                 <h4 className="font-bold text-gray-800">{student.name}</h4>
                                 <p className="text-xs text-gray-500 mt-0.5">{activeSch?.time} • {formatVND(student.feePerSession)}</p>
                               </div>
                               {isChecked ? (
                                 <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                                   <CheckCircle size={16} /> Đã chấm
                                 </div>
                               ) : (
                                 <button onClick={() => handleQuickAddSession(student)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition shadow-sm">
                                   <CheckSquare size={16} /> Chấm công
                                 </button>
                               )}
                             </div>
                           );
                         })}
                       </div>
                    ) : (
                       <p className="text-gray-500 italic text-sm mt-1">Không có lịch dạy định kỳ nào được lên lịch cho ngày này.</p>
                    )}
                 </div>

                 <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
                    <div className="p-5 border-b border-gray-100">
                      <h3 className="font-bold text-gray-800">Lịch sử chấm công</h3>
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
                                <td className="p-4">{s.date.split('-').reverse().join('/')}</td>
                                <td className="p-4 text-center font-bold text-blue-600">{students.find(st => st.id === s.studentId)?.name}</td>
                                <td className="p-4 text-center text-gray-500">{s.notes || '-'}</td>
                                <td className="p-4 text-center text-gray-800">{formatVND(s.fee)}</td>
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
                    <button onClick={() => {setNewStudent({name:'', feePerSession:0}); setShowStudentModal({show: true, editData: null});}} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition">
                      <Plus size={18} /> Thêm học sinh
                    </button>
                 </div>
                 
                 {studentStats.length === 0 ? (
                    <div className="text-center p-12 text-gray-400 bg-white border border-dashed rounded-xl">Chưa có học sinh nào. Hãy thêm học sinh!</div>
                 ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                      {studentStats.map(s => {
                         const today = new Date().toISOString().split('T')[0];
                         const sortedSchedules = [...(s.schedules || [])].sort((a,b) => {
                            const getStatus = (sch) => {
                               if (sch.endDate && sch.endDate < today) return 2; // Quá khứ
                               if (sch.startDate > today) return 1; // Tương lai
                               return 0; // Hiện tại (đang diễn ra)
                            };
                            const statusA = getStatus(a);
                            const statusB = getStatus(b);
                            
                            if (statusA !== statusB) return statusA - statusB; 
                            return b.startDate.localeCompare(a.startDate); // Cùng trạng thái thì xếp theo ngày tạo mới nhất lên trên
                         });

                         return (
                           <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 min-h-[200px]">
                              <div className="flex-1 flex flex-col">
                                 <div className="mb-4 flex justify-between items-start">
                                    <div>
                                      <h3 className="text-xl font-bold text-gray-900">{s.name}</h3>
                                      <p className="text-sm text-gray-400 mt-1">{formatVND(s.feePerSession)} / buổi</p>
                                    </div>
                                    <button onClick={() => openEditStudent(s)} className="text-gray-400 hover:text-blue-600 transition" title="Đổi tên/học phí"><Edit2 size={18}/></button>
                                 </div>
                                 <div className="mt-auto space-y-2.5 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-400">Đã dạy:</span> <span className="font-bold text-gray-900">{s.totalSessions} buổi</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Thành tiền:</span> <span className="font-bold text-blue-600">{formatVND(s.totalEarned)}</span></div>
                                    <div className="flex justify-between pt-2.5 border-t border-gray-100"><span className="text-gray-400">Còn nợ:</span> <span className={`font-bold ${s.debt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatVND(s.debt)}</span></div>
                                 </div>
                              </div>
                              
                              <div className="hidden md:block w-px bg-gray-100"></div>
                              
                              <div className="flex-1 flex flex-col justify-center text-center overflow-hidden">
                                 <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 shrink-0">ĐỢT HỌC HIỆN TẠI</h4>
                                 
                                 {sortedSchedules.length > 0 ? (
                                   <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[140px] mb-4 pr-1 scrollbar-thin">
                                      {sortedSchedules.map(sch => {
                                         const isPast = sch.endDate && sch.endDate < today;
                                         return (
                                            <div key={sch.id} className={`border rounded-xl p-3 text-left shrink-0 transition ${isPast ? 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100' : 'bg-blue-50/50 border-blue-100 hover:bg-blue-50'}`}>
                                               <div className="flex items-center justify-between mb-2">
                                                  <div>
                                                     <span className={`text-[11px] font-bold ${isPast ? 'text-gray-500' : 'text-blue-600'}`}>{formatDateVN(sch.startDate)} - {sch.endDate ? formatDateVN(sch.endDate) : 'Nay'}</span>
                                                     <span className="text-[11px] font-bold text-gray-500 ml-1.5">{sch.time}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5 ml-1">
                                                     <button onClick={() => openScheduleModal(s, sch)} className="text-blue-500 hover:text-blue-700 bg-white p-1 rounded-md border border-blue-100 shadow-sm" title="Sửa đợt học"><Edit2 size={12}/></button>
                                                     <button onClick={() => exportToCalendar(s, sch)} className="text-emerald-500 hover:text-emerald-700 bg-white p-1 rounded-md border border-emerald-100 shadow-sm" title="Lưu lịch GG Calendar"><CalendarIcon size={12}/></button>
                                                  </div>
                                               </div>
                                               <div className="flex gap-1 flex-wrap mt-1.5">
                                                  {DAYS_OF_WEEK.map(d => (
                                                     sch.days.includes(d) && <span key={d} className="px-1.5 py-0.5 bg-white border border-gray-200 text-gray-600 rounded text-[10px] font-bold shadow-sm">{d}</span>
                                                  ))}
                                               </div>
                                            </div>
                                         )
                                      })}
                                   </div>
                                 ) : (
                                   <div className="border border-dashed border-gray-200 bg-gray-50/50 rounded-xl py-6 px-4 text-sm text-gray-400 italic mb-4">
                                     Chưa thiết lập đợt học.
                                   </div>
                                 )}
                                 
                                 <button onClick={() => openScheduleModal(s)} className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition mt-auto shrink-0 border border-blue-100 border-dashed">
                                   <Plus size={14} /> Nhập đợt mới
                                 </button>
                              </div>
                           </div>
                         );
                      })}
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
                                <td className="p-5 text-gray-600">{p.date.split('-').reverse().join('/')}</td>
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

      {/* --- MODALS --- */}
      
      {/* Modal Thêm/Sửa Học Sinh */}
      {showStudentModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg relative">
            <button onClick={() => setShowStudentModal({show:false, editData:null})} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="text-xl font-bold mb-6">{showStudentModal.editData ? 'Sửa thông tin học sinh' : 'Thêm học sinh mới'}</h3>
            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên học sinh</label>
                <input required type="text" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Học phí / Buổi (VNĐ)</label>
                <input required type="number" value={newStudent.feePerSession} onChange={e => setNewStudent({...newStudent, feePerSession: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none" />
              </div>
              <div className="mt-6">
                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">{showStudentModal.editData ? 'Lưu thay đổi' : 'Lưu học sinh'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thiết lập đợt học */}
      {showScheduleModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg relative">
            <button onClick={() => setShowScheduleModal({show:false, student:null, editScheduleId: null})} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="text-xl font-bold mb-6">{showScheduleModal.editScheduleId ? 'Sửa đợt học: ' : 'Thiết lập đợt học: '} {showScheduleModal.student?.name}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                 <input type="date" value={scheduleForm.startDate} onChange={(e) => setScheduleForm({...scheduleForm, startDate: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none text-gray-700" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                 <input type="date" value={scheduleForm.endDate} onChange={(e) => setScheduleForm({...scheduleForm, endDate: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none text-gray-700" placeholder="dd/mm/yyyy" />
               </div>
            </div>
            
            <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu</label>
                 <input type="time" value={scheduleForm.time} onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none text-gray-700" />
            </div>
            
            <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Học vào các ngày trong tuần</label>
                 <div className="flex gap-2">
                    {DAYS_OF_WEEK.map(d => (
                       <button 
                          key={d} 
                          type="button" 
                          onClick={() => toggleDay(d)} 
                          className={`flex-1 h-10 rounded-lg border font-medium text-sm transition ${scheduleForm.days.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {d}
                        </button>
                    ))}
                 </div>
                 {scheduleForm.days.length === 0 && <p className="text-[#EF4444] text-xs mt-2">Vui lòng chọn ít nhất 1 ngày.</p>}
            </div>
            
            <hr className="border-gray-100 mb-4" />
            <button 
               disabled={scheduleForm.days.length === 0} 
               onClick={handleSaveSchedule} 
               className={`w-full py-3 rounded-lg font-medium text-white transition ${scheduleForm.days.length === 0 ? 'bg-[#9CA3AF] cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-sm'}`}
            >
               Lưu đợt học
            </button>
          </div>
        </div>
      )}

      {/* Modal Chấm Công */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg relative">
            <button onClick={() => setShowSessionModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="text-xl font-bold mb-6">Chấm công thủ công</h3>
            <form onSubmit={handleAddSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Học sinh</label>
                <select required value={newSession.studentId} onChange={e => {
                  const student = students.find(s => s.id === e.target.value);
                  setNewSession({...newSession, studentId: e.target.value, fee: student ? student.feePerSession : 0});
                }} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none bg-white">
                  <option value="">-- Chọn học sinh --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày dạy</label>
                <input required type="date" value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiền công (Có thể sửa đổi)</label>
                <input required type="number" value={newSession.fee} onChange={e => setNewSession({...newSession, fee: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (Tùy chọn)</label>
                <input type="text" value={newSession.notes} onChange={e => setNewSession({...newSession, notes: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none" />
              </div>
              <div className="mt-6">
                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">Lưu chấm công</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thanh Toán */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="text-xl font-bold mb-6">Nhập tiền đã nhận</h3>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Học sinh thanh toán</label>
                <select required value={newPayment.studentId} onChange={e => setNewPayment({...newPayment, studentId: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none bg-white">
                  <option value="">-- Chọn học sinh --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày nhận</label>
                <input required type="date" value={newPayment.date} onChange={e => setNewPayment({...newPayment, date: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
                <input required type="number" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none" />
              </div>
              <div className="mt-6">
                <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition">Lưu thanh toán</button>
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