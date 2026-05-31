import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, BookOpen, MessageCircle, Send, ArrowLeft, Loader2, Sparkles, CheckCircle2, Award, Eye, EyeOff } from 'lucide-react';
import { API_URL } from '../config';

interface ReviewItem {
  id: number | string;
  question: string;
  myAnswer: string;
  correctAnswer: string;
  concept: string;
  explanation: string;
  isCompleted?: boolean; // 학습 완료(스킵) 여부 추가
}

const DUMMY_REVIEW_DATA: ReviewItem[] = [
  { 
    id: 'dummy_1', 
    question: '다음 중 기능론적 관점에 대한 설명으로 옳은 것은?', 
    myAnswer: '대립과 갈등을 기본 속성으로 본다.', 
    correctAnswer: '사회 불평등은 불가피하다.',
    concept: '기능론',
    explanation: '기능론은 사회를 유기체로 보며, 사회 불평등은 개인의 능력과 기여도에 따른 정당한 보상의 결과로 불가피하다고 봅니다. 반면 갈등론이 대립과 갈등을 기본 속성으로 봅니다.',
    isCompleted: false
  }
];

export default function Review() {
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [chatMessage, setChatMessage] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  
  // 학습 완료된 문항 숨기기 필터 상태 (기본값: true - 완료된 것은 숨김)
  const [hideCompleted, setHideCompleted] = useState(true);

  // 로컬 스토리지 또는 더미 데이터에서 오답 데이터 로드
  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ReviewItem[];
        if (parsed.length > 0) {
          // 혹시 기존 데이터에 isCompleted가 없을 경우를 대비해 초기화
          const normalized = parsed.map(item => ({
            ...item,
            isCompleted: item.isCompleted || false
          }));
          setReviewData(normalized);
          
          // 처음 보여줄 문항 인덱스 설정 (완료되지 않은 첫 번째 문항 선호)
          const firstUncompletedIdx = normalized.findIndex(item => !item.isCompleted);
          const initialIdx = firstUncompletedIdx !== -1 ? firstUncompletedIdx : 0;
          setActiveIdx(initialIdx);
          initChat(normalized[initialIdx]);
          return;
        }
      } catch (e) {
        console.error('Failed to parse wrong questions:', e);
      }
    }
    // 기본 더미 데이터 로드
    setReviewData(DUMMY_REVIEW_DATA);
    initChat(DUMMY_REVIEW_DATA[0]);
  }, []);

  const initChat = (item: ReviewItem | undefined) => {
    if (!item) {
      setChatHistory([
        { role: 'ai', text: '축하합니다! 모든 틀린 문제를 정복하셨네요! 새로 자료를 등록해 또 다른 문제에 도전해 보세요.' }
      ]);
      return;
    }
    setChatHistory([
      { 
        role: 'ai', 
        text: `안녕하세요! AI 오답 코치입니다. 이번 시험에서 "${item.concept}" 개념의 문제를 틀리셨네요. 출제 해설을 읽어보시고, 어떤 부분에 대해 더 자세한 설명이 필요하신지 말씀해 주시면 명쾌하게 답해 드릴게요!` 
      }
    ]);
  };

  // 활성화된 오답 카드를 바꿀 때 챗봇 대화도 초기화
  const handleSelectQuestion = (index: number) => {
    setActiveIdx(index);
    initChat(reviewData[index]);
  };

  // 특정 문제를 [학습 완료 / 마스터] 상태로 토글 및 로컬 스토리지 저장
  const handleToggleComplete = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 전체 클릭 이벤트로 번지는 것 차단
    
    const updated = reviewData.map(item => {
      if (item.id === id) {
        const nextState = !item.isCompleted;
        if (nextState) {
          toast.success(`🎉 [${item.concept}] 개념을 마스터하셨습니다!`);
        } else {
          toast('학습 완료가 취소되었습니다.', { icon: '🔄' });
        }
        return { ...item, isCompleted: nextState };
      }
      return item;
    });

    setReviewData(updated);
    localStorage.setItem('wrong_questions', JSON.stringify(updated));

    // 만약 현재 공부 중이던 문제를 완료 처리했고, 완료 문항 숨기기가 켜져 있다면
    // 남은 미완료 문항 중 하나로 활성 카드를 자동 이동시켜 자연스러운 흐름 제공
    const activeItem = updated.find((_, idx) => idx === activeIdx);
    if (activeItem?.isCompleted && hideCompleted) {
      const nextUncompletedIdx = updated.findIndex((item, idx) => !item.isCompleted && idx !== activeIdx);
      if (nextUncompletedIdx !== -1) {
        setActiveIdx(nextUncompletedIdx);
        initChat(updated[nextUncompletedIdx]);
      } else {
        // 더 이상 완료되지 않은 문제가 없는 경우
        const firstIdx = updated.length > 0 ? 0 : 0;
        setActiveIdx(firstIdx);
        initChat(updated[firstIdx]);
      }
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isPending) return;

    const currentMsg = chatMessage;
    const newChat = [...chatHistory, { role: 'user' as const, text: currentMsg }];
    setChatHistory(newChat);
    setChatMessage('');
    setIsPending(true);

    const activeQuestion = reviewData[activeIdx];
    if (!activeQuestion) return;

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: activeQuestion.question,
          myAnswer: activeQuestion.myAnswer,
          correctAnswer: activeQuestion.correctAnswer,
          concept: activeQuestion.concept,
          explanation: activeQuestion.explanation,
          chatHistory: chatHistory,
          message: currentMsg
        })
      });

      const data = await res.json();
      if (data.success && data.reply) {
        setChatHistory([...newChat, { role: 'ai', text: data.reply }]);
      } else {
        setChatHistory([...newChat, { role: 'ai', text: '죄송해요. 답변을 불러오는 중에 예외가 발생했어요. 다시 이야기해 주세요.' }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory([...newChat, { role: 'ai', text: '네트워크 연결 상태가 불안정하여 대답을 드릴 수 없어요. 잠시 후에 다시 시도해 주세요.' }]);
    } finally {
      setIsPending(false);
    }
  };

  // 필터가 적용된 실제 렌더링용 목록 분리
  const displayedQuestions = hideCompleted 
    ? reviewData.filter(item => !item.isCompleted)
    : reviewData;

  // 현재 활성화된 질문 객체 구하기
  const activeQuestion = reviewData[activeIdx];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-indigo-600 w-8 h-8" />
            나의 오답 노트
          </h2>
        </div>

        {/* 필터 제어 영역 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHideCompleted(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
              hideCompleted 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {hideCompleted ? (
              <><EyeOff className="w-4 h-4" /> 완료된 문제 숨김 활성화</>
            ) : (
              <><Eye className="w-4 h-4" /> 완료된 문제 포함 보기</>
            )}
          </button>
          <span className="text-xs text-gray-400 font-medium font-mono">
            남은 문제: {reviewData.filter(item => !item.isCompleted).length} / 전체: {reviewData.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wrong Questions List */}
        <div className="lg:col-span-2 space-y-6">
          {displayedQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center shadow-inner space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Award className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h4 className="font-extrabold text-gray-800 text-lg">축하합니다! 완벽히 정복하셨습니다.</h4>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  {hideCompleted 
                    ? '현재 오답 목록의 모든 문제를 학습 완료하셨습니다. 상단 필터를 끄면 완료된 이력을 확인하실 수 있습니다.'
                    : '등록된 틀린 문제 데이터가 전혀 존재하지 않습니다.'
                  }
                </p>
              </div>
            </div>
          ) : (
            displayedQuestions.map((item) => {
              // 실제 원본 데이터에서의 인덱스 추적 (Active 상태 동기화용)
              const originalIndex = reviewData.findIndex(origin => origin.id === item.id);
              const isActive = originalIndex === activeIdx;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => handleSelectQuestion(originalIndex)}
                  className={`p-6 rounded-2xl shadow-sm border transition-all duration-300 relative overflow-hidden cursor-pointer ${
                    isActive 
                      ? 'bg-white border-indigo-400 ring-2 ring-indigo-100 shadow-md scale-[1.01]' 
                      : 'bg-white border-red-100 hover:border-indigo-200'
                  } ${item.isCompleted ? 'opacity-60 bg-gray-50/50' : ''}`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 h-full w-1.5 bg-indigo-500" />
                  )}
                  
                  {/* 오답 및 완료 뱃지 */}
                  <div className="absolute top-0 right-0 flex items-center">
                    {item.isCompleted ? (
                      <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-bl-xl font-extrabold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 마스터 완료
                      </div>
                    ) : (
                      <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-bl-xl font-bold text-xs">
                        오답
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mb-4 pr-16">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                        {item.concept}
                      </span>
                      {isActive && !item.isCompleted && (
                        <span className="text-xs font-semibold text-indigo-500 flex items-center gap-0.5 animate-pulse">
                          <Sparkles className="w-3 h-3" /> 1:1 코칭 활성
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-medium mb-6 pt-1 text-gray-900 leading-relaxed">{item.question}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <div className="text-red-700 text-xs font-bold mb-1">나의 오답</div>
                      <div className="text-gray-800 line-through decoration-red-300 text-sm">{item.myAnswer}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <div className="text-green-700 text-xs font-bold mb-1">정답 지문</div>
                      <div className="text-gray-800 font-medium text-sm">{item.correctAnswer}</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-5">
                    <div className="flex items-center gap-2 text-blue-700 font-bold mb-2 text-sm">
                      <AlertTriangle className="w-4 h-4" /> AI 핵심 강의록
                    </div>
                    <p className="text-blue-900 text-xs leading-relaxed">{item.explanation}</p>
                  </div>

                  {/* 마스터 학습완료 버튼 장착 */}
                  <div className="flex justify-end border-t border-gray-100 pt-4">
                    <button
                      onClick={(e) => handleToggleComplete(item.id, e)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        item.isCompleted
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                          : 'bg-green-600 hover:bg-green-700 hover:shadow text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {item.isCompleted ? '오답 목록으로 복원' : '개념 마스터 (학습 완료)'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* AI Tutor Chat */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[600px] sticky top-24">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl">
            <h3 className="font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> 1:1 오답 밀착 코칭
            </h3>
            <p className="text-indigo-100 text-xs mt-1">
              {activeQuestion?.isCompleted 
                ? '이미 마스터한 문항입니다. 코칭 대화가 정지되었습니다.' 
                : '질문하고 싶은 카드를 누른 후 물어보세요!'
              }
            </p>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatHistory.map((chat, idx) => (
              <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  chat.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  {chat.text}
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex justify-start items-center gap-2 text-gray-400 text-xs animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>AI 코치가 분석하는 중...</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input 
                type="text" 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                disabled={isPending || activeQuestion?.isCompleted}
                placeholder={
                  activeQuestion?.isCompleted 
                    ? "마스터한 문항은 대화할 수 없습니다."
                    : isPending 
                      ? "답변을 대기 중입니다..." 
                      : "틀린 이유에 대해 추가 질문하세요..."
                } 
                className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim() || isPending || activeQuestion?.isCompleted}
                className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
