import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  MessageCircle, 
  ShieldAlert, 
  Plus, 
  X, 
  User,
  Calendar,
  Heart
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';

// --- Firebase Configuration (선생님의 설정값 적용) ---
const firebaseConfig = {
  apiKey: "AIzaSyBkoOOhogGoTJgKTjZ_7qm2Ce5foU4JXrA",
  authDomain: "class-sos.firebaseapp.com",
  projectId: "class-sos",
  storageBucket: "class-sos.firebasestorage.app",
  messagingSenderId: "698934806884",
  appId: "1:698934806884:web:eea8eecf76d8e6c4fed271",
  measurementId: "G-1D75WZG055"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'class-sos-prod'; // 고유 앱 ID

// 기본 루틴 목록
const DEFAULT_ROUTINES = [
  { id: 'r1', text: '마음 온도 체크 (아침)', time: 'morning' },
  { id: 'r2', text: '책상 위 3분 정리 (아침)', time: 'morning' },
  { id: 'r3', text: '10분 몰입 훈련 (수업 중)', time: 'class' },
  { id: 'r4', text: '대체 언어 1문장 연습 (수업 중)', time: 'class' },
  { id: 'r5', text: '사물함/바닥 3분 정리 (하교 전)', time: 'afternoon' },
  { id: 'r6', text: '오늘의 회복 행동 확인 (하교 전)', time: 'afternoon' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [routines, setRoutines] = useState({});
  const [studentRecords, setStudentRecords] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ studentName: '', category: '관찰', content: '', promise: '' });

  const todayStr = new Date().toISOString().split('T')[0];

  // Auth 초기화
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 데이터 실시간 동기화
  useEffect(() => {
    if (!user) return;

    const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_routines', todayStr);
    const unsubRoutine = onSnapshot(routineRef, (docSnap) => {
      if (docSnap.exists()) setRoutines(docSnap.data().checkedItems || {});
    });

    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'student_records');
    const unsubRecords = onSnapshot(query(recordsRef), (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => b.createdAt - a.createdAt);
      setStudentRecords(records);
    });

    return () => { unsubRoutine(); unsubRecords(); };
  }, [user, todayStr]);

  const handleToggleRoutine = async (id) => {
    if (!user) return;
    const newRoutines = { ...routines, [id]: !routines[id] };
    const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_routines', todayStr);
    await setDoc(routineRef, { checkedItems: newRoutines, updatedAt: Date.now() }, { merge: true });
  };

  const handleSubmitRecord = async (e) => {
    e.preventDefault();
    if (!user || !formData.studentName.trim()) return;
    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'student_records');
    await addDoc(recordsRef, { ...formData, date: todayStr, promiseCompleted: false, createdAt: Date.now() });
    setFormData({ studentName: '', category: '관찰', content: '', promise: '' });
    setShowAddForm(false);
  };

  const handleTogglePromise = async (id, currentStatus) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'student_records', id);
    await updateDoc(docRef, { promiseCompleted: !currentStatus });
  };

  const progressPercent = Math.round((DEFAULT_ROUTINES.filter(r => routines[r.id]).length / DEFAULT_ROUTINES.length) * 100) || 0;

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10">
      <header className="bg-indigo-600 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black flex items-center justify-center md:justify-start gap-2">
              <Heart className="text-pink-400 fill-current" /> Classroom SOS
            </h1>
            <p className="text-indigo-100 opacity-90 mt-1">따뜻한 관계와 단단한 기준이 공존하는 학급</p>
          </div>
          <div className="flex items-center gap-3 bg-indigo-700 p-1 rounded-xl">
            { [1, 2, 3, 4].map(w => (
              <button 
                key={w} onClick={() => setCurrentWeek(w)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentWeek === w ? 'bg-white text-indigo-700 shadow' : 'text-indigo-200 hover:text-white'}`}
              >
                {w}주차
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 데일리 체크리스트 */}
        <section className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-500" /> 오늘 루틴
            </h2>
            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{progressPercent}% 완료</span>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-3 mb-8 overflow-hidden">
            <div className="bg-indigo-500 h-full transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }}></div>
          </div>

          <div className="space-y-3">
            {DEFAULT_ROUTINES.map(r => (
              <div 
                key={r.id} onClick={() => handleToggleRoutine(r.id)}
                className={`group flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${routines[r.id] ? 'bg-slate-50 border-transparent text-slate-400' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}
              >
                {routines[r.id] ? <CheckSquare className="text-indigo-400" size={24} /> : <Square className="text-slate-300 group-hover:text-indigo-400" size={24} />}
                <span className={`font-semibold text-base ${routines[r.id] ? 'line-through' : 'text-slate-700'}`}>{r.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 관찰 및 상담 기록 */}
        <section className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <User className="text-emerald-500" /> 학생 관찰 & 상담
            </h2>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              {showAddForm ? <X size={18} /> : <Plus size={18} />} 기록하기
            </button>
          </div>

          {showAddForm && (
            <div className="bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input 
                  type="text" placeholder="학생 이름" 
                  className="p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-400 outline-none"
                  value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})}
                />
                <select 
                  className="p-3 rounded-xl border border-slate-200 bg-white outline-none"
                  value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="관찰">행동 관찰</option>
                  <option value="상담">5분 상담</option>
                  <option value="사안">갈등 사안</option>
                </select>
              </div>
              <textarea 
                placeholder="상황이나 상담 내용을 입력하세요..."
                className="w-full p-3 rounded-xl border border-slate-200 h-24 mb-3 resize-none outline-none focus:ring-2 focus:ring-emerald-400"
                value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
              />
              <input 
                type="text" placeholder="이번 주 지킬 약속 한 가지"
                className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 placeholder:text-emerald-300 outline-none mb-4"
                value={formData.promise} onChange={e => setFormData({...formData, promise: e.target.value})}
              />
              <button 
                onClick={handleSubmitRecord}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black hover:bg-emerald-700 transition-colors shadow-md"
              >
                기록 저장
              </button>
            </div>
          )}

          <div className="space-y-4">
            {studentRecords.length === 0 ? (
              <div className="py-20 text-center text-slate-300 font-medium">아직 기록된 내용이 없습니다.</div>
            ) : (
              studentRecords.map(record => (
                <div key={record.id} className="p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-800 text-lg">{record.studentName}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${record.category === '상담' ? 'bg-blue-100 text-blue-600' : record.category === '사안' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                        {record.category}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{record.date}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">{record.content}</p>
                  {record.promise && (
                    <div 
                      onClick={() => handleTogglePromise(record.id, record.promiseCompleted)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${record.promiseCompleted ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 border border-amber-100 text-amber-900'}`}
                    >
                      {record.promiseCompleted ? <CheckSquare size={18} /> : <Square size={18} className="text-amber-500" />}
                      <span className={`text-sm font-bold ${record.promiseCompleted ? 'line-through' : ''}`}>약속: {record.promise}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* 퀵 매뉴얼 */}
        <section className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">응급 매뉴얼</h3>
          <button onClick={() => setActiveModal('words')} className="w-full p-4 bg-blue-600 text-white rounded-2xl text-left shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-3">
            <MessageCircle size={24} />
            <span className="font-bold">말하기 사전</span>
          </button>
          <button onClick={() => setActiveModal('questions')} className="w-full p-4 bg-rose-500 text-white rounded-2xl text-left shadow-md hover:bg-rose-600 transition-all active:scale-95 flex items-center gap-3">
            <AlertTriangle size={24} />
            <span className="font-bold">회복 질문</span>
          </button>
          <button onClick={() => setActiveModal('rules')} className="w-full p-4 bg-slate-800 text-white rounded-2xl text-left shadow-md hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-3">
            <ShieldAlert size={24} />
            <span className="font-bold">3대 규칙</span>
          </button>
        </section>
      </main>

      {/* 모달 팝업 */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`p-6 text-white flex justify-between items-center ${activeModal === 'words' ? 'bg-blue-600' : activeModal === 'questions' ? 'bg-rose-500' : 'bg-slate-800'}`}>
              <h3 className="text-xl font-black">
                {activeModal === 'words' ? '대체 언어 연습' : activeModal === 'questions' ? '회복적 질문' : '학급 3대 규칙'}
              </h3>
              <button onClick={() => setActiveModal(null)}><X size={24} /></button>
            </div>
            <div className="p-6">
              {activeModal === 'words' ? (
                <div className="space-y-4">
                  {[ {b:'아 짜증나', g:'나는 그 말이 불편해'}, {b:'싫은데?', g:'지금은 하고 싶지 않아'}, {b:'너 때문이잖아', g:'나는 이 상황이 속상해'} ].map((item, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl">
                      <div className="text-rose-400 text-xs line-through font-bold mb-1">{item.b}</div>
                      <div className="text-blue-700 font-black text-lg">" {item.g} "</div>
                    </div>
                  ))}
                </div>
              ) : activeModal === 'questions' ? (
                <div className="space-y-3">
                  {['무슨 일이 있었니?', '네 행동으로 누가 영향을 받았니?', '회복하려면 무엇을 해야 하니?', '다음에는 어떻게 바꿀 거니?'].map((q, i) => (
                    <div key={i} className="p-4 bg-rose-50 text-rose-900 font-bold rounded-2xl flex gap-3">
                      <span className="opacity-30">{i+1}</span> {q}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {[ {t:'말', c:'비하, 조롱, 혐오 표현 금지'}, {t:'물건', c:'허락 없이 남의 물건 쓰지 않기'}, {t:'배움', c:'수업 시작 3분 안에 준비'} ].map((r, i) => (
                    <div key={i} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0">
                      <div className="bg-slate-800 text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black">{r.t}</div>
                      <div className="font-bold text-slate-700 pt-2">{r.c}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}