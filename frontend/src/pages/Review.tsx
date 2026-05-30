import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, MessageCircle, Send, ArrowLeft } from 'lucide-react';

const DUMMY_REVIEW_DATA = [
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
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: '안녕하세요! 오답 분석 코치입니다. 방금 틀린 문제 중 "기능론"과 "갈등론"을 혼동하신 것 같아요. 어떤 부분이 헷갈리셨나요?' }
  ]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const newChat = [...chatHistory, { role: 'user' as const, text: chatMessage }];
    setChatHistory(newChat);
    setChatMessage('');

    // Simulate AI response
    setTimeout(() => {
      setChatHistory([
        ...newChat,
        { role: 'ai', text: '좋은 질문이에요! 기능론에서는 능력에 따라 보상이 달라지는 것을 "합리적"이라고 보지만, 갈등론은 그것이 불공평한 구조(계급 재생산) 때문이라고 봅니다.' }
      ]);
    }, 1000);
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
          {DUMMY_REVIEW_DATA.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-50 text-red-600 px-4 py-1 rounded-bl-xl font-bold text-sm">오답</div>
              <h3 className="text-lg font-medium mb-6 pt-2">{item.question}</h3>
              
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

              <div className="bg-blue-50 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
                  <AlertTriangle className="w-4 h-4" /> AI 핵심 해설: [{item.concept}]
                </div>
                <p className="text-blue-900 text-sm leading-relaxed">{item.explanation}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Tutor Chat */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[600px] sticky top-24">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl">
            <h3 className="font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> 1:1 학습 코치
            </h3>
            <p className="text-indigo-100 text-xs mt-1">왜 틀렸는지 언제든 질문하세요!</p>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatHistory.map((chat, idx) => (
              <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  chat.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  {chat.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input 
                type="text" 
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                placeholder="질문을 입력하세요..." 
                className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim()}
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
