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
  Heart,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';

// --- Firebase Configuration ---
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
const appId = 'class-sos-prod'; 

// --- Constants ---
const DEFAULT_ROUTINES = [
  { id: 'r1', text: '마음 온도 체크 (아침)' },
  { id: 'r2', text: '책상 위 3분 정리 (아침)' },
  { id: 'r3', text: '10분 몰입 훈련 (수업 중)' },
  { id: 'r4', text: '대체 언어 1문장 연습 (수업 중)' },
  { id: 'r5', text: '사물함/바닥 3분 정리 (하교 전)' },
  { id: 'r6', text: '오늘의 회복 행동 확인 (하교 전)' },
];

const WEEK_GOALS = {
  1: { title: "규칙과 루틴 회복", desc: "학급 3대 규칙 확립, 3분 정리 루틴, 대체 언어 연습 시작" },
  2: { title: "감정과 회복 대화", desc: "마음 온도 체크, 짧은 회복 질문 훈련, 10분 몰입" },
  3: { title: "관계 재연결", desc: "안전한 주제의 신뢰 서클, 비밀 도움 미션(마니또 준비)" },
  4: { title: "책임 행동 강화", desc: "뉴스포츠 협동 프로젝트, 우리 반 학급 약속 재정비" }
};

const DEFAULT_WORDS = [
  { b: '아 짜증나', g: '나는 그 말이 불편해', isDefault: true },
  { b: '싫은데?', g: '지금은 하고 싶지 않아', isDefault: true },
  { b: '너 때문이잖아', g: '나는 이 상황이 속상해', isDefault: true }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [routines, setRoutines] = useState({});
  const [studentRecords, setStudentRecords] = useState([]);
  const [customWords, setCustomWords] = useState([]); // 커스텀 사전 상태
  
  const [activeModal, setActiveModal] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false); // 루틴 해제 확인
  
  const [formData, setFormData] = useState({ studentName: '', category: '관찰', content: '', promise: '' });
  const [newWord, setNewWord] = useState({ b: '', g: '' }); // 새 단어 폼

  const todayStr = new Date().toISOString().split('T')[0];

  // Auth 초기화
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Firebase Auth Error:", error); }
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

    // 1. 루틴 동기화
    const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_routines', todayStr);
    const unsubRoutine = onSnapshot(routineRef, (docSnap) => {
      if (docSnap.exists()) setRoutines(docSnap.data().checkedItems || {});
    });

    // 2. 학생 기록 동기화
    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'student_records');
    const unsubRecords = onSnapshot(query(recordsRef), (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => b.createdAt - a.createdAt);
      setStudentRecords(records);
    });

    // 3. 커스텀 단어장 동기화
    const wordsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'words');
    const unsubWords = onSnapshot(wordsRef, (docSnap) => {
      if (docSnap.exists()) setCustomWords(docSnap.data().list || []);
    });

    return () => { unsubRoutine(); unsubRecords(); unsubWords(); };
  }, [user, todayStr]);

  // --- Handlers ---
  const handleToggleRoutine = async (id) => {
    if (!user) return;
    const newRoutines = { ...routines, [id]: !routines[id] };
    const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_routines', todayStr);
    await setDoc(routineRef, { checkedItems: newRoutines, updatedAt: Date.now() }, { merge: true });
  };

  const handleClearRoutines = async () => {
    if (!user) return;
    const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_routines', todayStr);
    await setDoc(routineRef, { checkedItems: {}, updatedAt: Date.now() }, { merge: true });
    setConfirmClear(false);
  };

  const handleSubmitRecord = async (e) => {
    e.preventDefault();
    if (!user || !formData.studentName.trim()) return;
    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'student_records');
    // 주차 정보(week) 함께 저장
    await addDoc(recordsRef, { ...formData, date: todayStr, week: currentWeek, promiseCompleted: false, createdAt: Date.now() });
    setFormData({ studentName: '', category: '관찰', content: '', promise: '' });
    setShowAddForm(false);
  };

  const handleTogglePromise = async (id, currentStatus) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'student_records', id);
    await updateDoc(docRef, { promiseCompleted: !currentStatus });
  };

  const handleAddWord = async () => {
    if (!user || !newWord.b.trim() || !newWord.g.trim()) return;
    const updatedWords = [...customWords, { b: newWord.b, g: newWord.g, id: Date.now() }];
    const wordsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'words');
    await setDoc(wordsRef, { list: updatedWords }, { merge: true });
    setNewWord({ b: '', g: '' });
  };

  const handleDeleteWord = async (wordId) => {
    if (!user) return;
    const updatedWords = customWords.filter(w => w.id !== wordId);
    const wordsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'words');
    await setDoc(wordsRef, { list: updatedWords }, { merge: true });
  };

  // --- Calculations ---
  const progressPercent = Math.round((DEFAULT_ROUTINES.filter(r => routines[r.id]).length / DEFAULT_ROUTINES.length) * 100) || 0;
  
  // 현재 선택된 주차에 해당하는 학생 기록만 필터링 (과거 기록 호환성을 위해 week가 없으면 1주차로 간주)
  const filteredRecords = studentRecords.filter(r => r.week === currentWeek || (!r.week && currentWeek === 1));

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10">
      
      {/* Header */}
      <header className="bg-indigo-600 text-white p-6 shadow-md z-10 relative">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black flex items-center justify-center md:justify-start gap-2">
              <Heart className="text-pink-400 fill-current" /> Classroom SOS
            </h1>
            <p className="text-indigo-100 opacity-90 mt-1">따뜻한 관계와 단단한 기준이 공존하는 학급</p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-700 p-1.5 rounded-xl overflow-x-auto">
            { [1, 2, 3, 4].map(w => (
              <button 
                key={w} onClick={() => setCurrentWeek(w)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${currentWeek === w ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-200 hover:text-white hover:bg-indigo-600/50'}`}
              >
                {w}주차
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Week Goal Banner (신규 기능 1) */}
      <div className="bg-indigo-50 border-b border-indigo-100 py-3 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3">
          <span className="bg-indigo-200 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-md shadow-sm whitespace-nowrap">
            {currentWeek}주차 핵심 목표
          </span>
          <span className="font-bold text-indigo-900 text-base">
            {WEEK_GOALS[currentWeek].title}
          </span>
          <span className="text-indigo-400 hidden sm:inline">|</span>
          <span className="text-sm text-indigo-700/80 font-medium text-center sm:text-left">
            {WEEK_GOALS[currentWeek].desc}
          </span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
        {/* 데일리 체크리스트 */}
        <section className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-500" /> 오늘 루틴
            </h2>
            
            <div className="flex items-center gap-3">
              {/* 루틴 일괄 해제 버튼 (신규 기능 3) */}
              {confirmClear ? (
                <div className="flex items-center gap-2 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 animate-in fade-in">
                  <button onClick={handleClearRoutines} className="text-xs font-bold text-rose-600 hover:text-rose-700">해제확인</button>
                  <button onClick={() => setConfirmClear(false)} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="text-xs font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors">
                  <RefreshCw size={14} /> 일괄 해제
                </button>
              )}
              <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{progressPercent}% 완료</span>
            </div>
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

        {/* 관찰 및 상담 기록 (신규 기능 2 반영) */}
        <section className="lg:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-[calc(100vh-250px)] lg:h-[700px]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <User className="text-emerald-500" /> 학생 관찰 & 상담
              </h2>
              <span className="text-xs text-slate-400 mt-1 font-medium">{currentWeek}주차 기록을 보고 있습니다.</span>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 flex-shrink-0"
            >
              {showAddForm ? <X size={18} /> : <Plus size={18} />} 기록하기
            </button>
          </div>

          {showAddForm && (
            <div className="bg-emerald-50/50 p-5 rounded-2xl mb-6 border border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-300 flex-shrink-0">
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
                {currentWeek}주차 기록으로 저장
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {filteredRecords.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                <User size={48} className="opacity-20 mb-3" />
                <span className="font-medium">{currentWeek}주차에 작성된 기록이 없습니다.</span>
              </div>
            ) : (
              filteredRecords.map(record => (
                <div key={record.id} className="p-5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors relative group">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-800 text-lg">{record.studentName}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${record.category === '상담' ? 'bg-blue-100 text-blue-600' : record.category === '사안' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                        {record.category}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{record.date}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{record.content}</p>
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
          <button onClick={() => setActiveModal('words')} className="w-full p-4 bg-blue-600 text-white rounded-2xl text-left shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-3 group">
            <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold">말하기 사전</span>
          </button>
          <button onClick={() => setActiveModal('questions')} className="w-full p-4 bg-rose-500 text-white rounded-2xl text-left shadow-md hover:bg-rose-600 transition-all active:scale-95 flex items-center gap-3 group">
            <AlertTriangle size={24} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold">회복 질문</span>
          </button>
          <button onClick={() => setActiveModal('rules')} className="w-full p-4 bg-slate-800 text-white rounded-2xl text-left shadow-md hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-3 group">
            <ShieldAlert size={24} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold">3대 규칙</span>
          </button>
        </section>
      </main>

      {/* 모달 팝업 */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className={`p-6 text-white flex justify-between items-center flex-shrink-0 ${activeModal === 'words' ? 'bg-blue-600' : activeModal === 'questions' ? 'bg-rose-500' : 'bg-slate-800'}`}>
              <h3 className="text-xl font-black">
                {activeModal === 'words' ? '학급 말하기 사전' : activeModal === 'questions' ? '회복적 질문' : '학급 3대 규칙'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="hover:opacity-70 transition-opacity"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {/* 말하기 사전 (신규 기능 4 반영) */}
              {activeModal === 'words' ? (
                <div className="space-y-5">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-2 shadow-inner">
                    <p className="text-xs font-bold text-blue-800 mb-1">새 단어 등록하기</p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="금지어 (예: 꺼져)" className="flex-1 p-2 rounded-xl border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-400" value={newWord.b} onChange={e => setNewWord({...newWord, b: e.target.value})} />
                      <input type="text" placeholder="순화어 (예: 혼자 있고싶어)" className="flex-1 p-2 rounded-xl border border-blue-200 text-sm outline-none focus:ring-2 focus:ring-blue-400" value={newWord.g} onChange={e => setNewWord({...newWord, g: e.target.value})} />
                    </div>
                    <button onClick={handleAddWord} className="w-full bg-blue-600 text-white p-2 rounded-xl font-bold hover:bg-blue-700 text-sm mt-1 transition-colors">단어장에 추가</button>
                  </div>

                  <div className="space-y-3">
                    {[...DEFAULT_WORDS, ...customWords].map((item, i) => (
                      <div key={item.id || i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                        <div>
                          <div className="text-rose-400 text-xs line-through font-bold mb-1">{item.b}</div>
                          <div className="text-blue-700 font-black text-lg">" {item.g} "</div>
                        </div>
                        {!item.isDefault && (
                          <button onClick={() => handleDeleteWord(item.id)} className="text-slate-300 hover:text-rose-500 p-2 transition-colors" title="삭제">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : activeModal === 'questions' ? (
                <div className="space-y-3">
                  {['무슨 일이 있었니?', '네 행동으로 누가 영향을 받았니?', '회복하려면 무엇을 해야 하니?', '다음에는 어떻게 바꿀 거니?'].map((q, i) => (
                    <div key={i} className="p-4 bg-rose-50 text-rose-900 font-bold rounded-2xl flex gap-3 border border-rose-100 shadow-sm">
                      <span className="opacity-40">{i+1}</span> {q}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {[ {t:'말', c:'비하, 조롱, 혐오 표현 금지'}, {t:'물건', c:'허락 없이 남의 물건 쓰지 않기'}, {t:'배움', c:'수업 시작 3분 안에 준비'} ].map((r, i) => (
                    <div key={i} className="flex gap-4 border-b border-slate-100 pb-4 last:border-0">
                      <div className="bg-slate-800 text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black shadow-md">{r.t}</div>
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
