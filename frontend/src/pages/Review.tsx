import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, MessageCircle, Send, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { API_URL } from '../config';

interface ReviewItem {
  id: number;
  question: string;
  myAnswer: string;
  correctAnswer: string;
  concept: string;
  explanation: string;
}

const DUMMY_REVIEW_DATA: ReviewItem[] = [
  { 
    id: 1, 
    question: '다음 중 기능론적 관점에 대한 설명으로 옳은 것은?', 
    myAnswer: '대립과 갈등을 기본 속성으로 본다.', 
    correctAnswer: '사회 불평등은 불가피하다.',
    concept: '기능론',
    explanation: '기능론은 사회를 유기체로 보며, 사회 불평등은 개인의 능력과 기여도에 따른 정당한 보상의 결과로 불가피하다고 봅니다. 반면 갈등론이 대립과 갈등을 기본 속성으로 봅니다.'
  }
];

export default function Review() {
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [chatMessage, setChatMessage] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);

  // 로컬 스토리지 또는 더미 데이터에서 오답 데이터 로드
  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ReviewItem[];
        if (parsed.length > 0) {
          setReviewData(parsed);
          initChat(parsed[0]);
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

  const initChat = (item: ReviewItem) => {
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

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isPending) return;

    const currentMsg = chatMessage;
    const newChat = [...chatHistory, { role: 'user' as const, text: currentMsg }];
    setChatHistory(newChat);
    setChatMessage('');
    setIsPending(true);

    const activeQuestion = reviewData[activeIdx];

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="text-indigo-600 w-8 h-8" />
          나의 오답 노트
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wrong Questions List */}
        <div className="lg:col-span-2 space-y-6">
          {reviewData.map((item, idx) => {
            const isActive = idx === activeIdx;
            return (
              <div 
                key={item.id} 
                onClick={() => handleSelectQuestion(idx)}
                className={`p-6 rounded-2xl shadow-sm border transition-all duration-300 relative overflow-hidden cursor-pointer ${
                  isActive 
                    ? 'bg-white border-indigo-400 ring-2 ring-indigo-100 shadow-md scale-[1.01]' 
                    : 'bg-white border-red-100 hover:border-indigo-200'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 h-full w-1.5 bg-indigo-500" />
                )}
                <div className="absolute top-0 right-0 bg-red-50 text-red-600 px-4 py-1 rounded-bl-xl font-bold text-sm">
                  오답 #{idx + 1}
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {item.concept}
                  </span>
                  {isActive && (
                    <span className="text-xs font-semibold text-indigo-500 flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" /> 코칭 진행 중
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-medium mb-6 pt-1 text-gray-900">{item.question}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <div className="text-red-700 text-xs font-bold mb-1">나의 답안</div>
                    <div className="text-gray-800 line-through decoration-red-300">{item.myAnswer}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <div className="text-green-700 text-xs font-bold mb-1">정답</div>
                    <div className="text-gray-800 font-medium">{item.correctAnswer}</div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
                    <AlertTriangle className="w-4 h-4" /> AI 핵심 해설
                  </div>
                  <p className="text-blue-900 text-sm leading-relaxed">{item.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Tutor Chat */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[600px] sticky top-24">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl">
            <h3 className="font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> 1:1 오답 밀착 코칭
            </h3>
            <p className="text-indigo-100 text-xs mt-1">질문하고 싶은 카드를 누른 후 물어보세요!</p>
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
              <div className="flex justify-start items-center gap-2 text-gray-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>AI 코치가 깊이 생각하는 중입니다...</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input 
                type="text" 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                disabled={isPending}
                placeholder={isPending ? "답변을 기다리고 있어요..." : "왜 틀렸는지 자유롭게 물어보세요..."} 
                className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim() || isPending}
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
