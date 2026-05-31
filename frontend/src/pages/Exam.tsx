import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Clock, XCircle } from 'lucide-react';
import { API_URL } from '../config';


interface Question {
  id: number;
  type: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}

export default function Exam() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subjectId = searchParams.get('subject') || 'social';
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectName, setSubjectName] = useState<string>('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes

  useEffect(() => {
    fetchSubjectName();
    fetchQuestions();
  }, [subjectId]);

  const fetchSubjectName = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subjects`);
      const data = await res.json();
      if (data.success) {
        const subject = data.subjects.find((s: any) => s.id === subjectId);
        if (subject) setSubjectName(subject.name);
        else setSubjectName(subjectId);
      }
    } catch (e) {
      setSubjectName(subjectId);
    }
  };

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      // Backend expects /api/questions?subject=...
      const res = await fetch(`${API_URL}/api/questions?subject=${subjectId}`);
      const data = await res.json();
      if (data.success && data.questions) {
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (timeLeft > 0 && !isSubmitted && !isLoading) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && !isSubmitted) {
      handleSubmit();
    }
  }, [timeLeft, isSubmitted, isLoading]);

  const handleSelect = (choiceIdx: number) => {
    if (isSubmitted || answers[currentIdx] !== undefined) return;
    setAnswers(prev => ({ ...prev, [currentIdx]: choiceIdx }));
  };

  const handleSubmit = () => {
    // 사용자가 푼 전체 문제에서 틀린 문제만 필터링하여 오답 정보 객체로 가공
    const wrongQuestions = questions.map((q, idx) => {
      const selectedChoiceIdx = answers[idx];
      const isCorrect = selectedChoiceIdx === q.answer;
      return { q, idx, selectedChoiceIdx, isCorrect };
    })
    .filter(item => item.selectedChoiceIdx !== undefined && !item.isCorrect)
    .map((item, reviewIdx) => {
      const { q, selectedChoiceIdx } = item;
      return {
        id: reviewIdx + 1,
        question: q.question,
        myAnswer: q.choices[selectedChoiceIdx] !== undefined ? q.choices[selectedChoiceIdx] : '선택 안 함',
        correctAnswer: q.choices[q.answer] || '답안 없음',
        concept: q.type || '개념 분석',
        explanation: q.explanation || '이 문제에 대한 추가 해설이 없습니다.'
      };
    });

    // 로컬 스토리지에 오답 정보 저장
    localStorage.setItem('wrong_questions', JSON.stringify(wrongQuestions));
    setIsSubmitted(true);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const question = questions[currentIdx];
  const hasAnswered = answers[currentIdx] !== undefined;
  const isCorrect = hasAnswered && question && answers[currentIdx] === question.answer;

  if (isLoading) {
    return <div className="text-center py-20">문제를 불러오는 중입니다...</div>;
  }

  if (!questions || questions.length === 0) {
    return <div className="text-center py-20 text-gray-500">등록된 문제가 없습니다.</div>;
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-20 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4">학습 완료!</h2>
        <p className="text-gray-600 mb-8">수고하셨습니다. 전체 결과를 확인해 볼까요?</p>
        <button 
          onClick={() => navigate('/review')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-all hover:shadow-lg"
        >
          오답 노트 및 전체 분석 보기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <div className="text-sm text-gray-500 font-medium">과목</div>
          <div className="font-bold text-lg">{subjectName || subjectId}</div>
        </div>
        <div className="flex items-center gap-2 text-rose-500 font-mono font-bold text-xl bg-rose-50 px-4 py-2 rounded-lg">
          <Clock className="w-5 h-5" />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {questions.map((_, idx) => (
          <div 
            key={idx} 
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${idx === currentIdx ? 'bg-blue-500' : answers[idx] !== undefined ? 'bg-blue-200' : 'bg-gray-200'}`} 
          />
        ))}
      </div>

      {/* Question Card */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col animate-in slide-in-from-right-4">
        <div className="flex items-start gap-4 mb-8">
          <div className="bg-blue-100 text-blue-700 font-bold w-10 h-10 rounded-full flex items-center justify-center shrink-0">
            Q{currentIdx + 1}
          </div>
          <h3 className="text-xl font-medium leading-relaxed pt-1">
            {question.question}
          </h3>
        </div>

        <div className="space-y-3 flex-1">
          {question.choices.map((choice, idx) => {
            const isSelected = answers[currentIdx] === idx;
            const isChoiceCorrect = idx === question.answer;
            
            let choiceStyle = 'border-gray-100 hover:border-blue-200 hover:bg-gray-50 text-gray-700 cursor-pointer';
            if (hasAnswered) {
              if (isChoiceCorrect) {
                choiceStyle = 'border-green-500 bg-green-50 text-green-700 font-medium shadow-sm cursor-default';
              } else if (isSelected) {
                choiceStyle = 'border-red-500 bg-red-50 text-red-700 font-medium shadow-sm cursor-default';
              } else {
                choiceStyle = 'border-gray-100 bg-gray-50 text-gray-400 opacity-50 cursor-default';
              }
            }

            return (
              <div 
                key={idx}
                onClick={() => handleSelect(idx)}
                className={`p-4 rounded-xl border-2 transition-all ${choiceStyle}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${hasAnswered && isChoiceCorrect ? 'border-green-500' : hasAnswered && isSelected && !isChoiceCorrect ? 'border-red-500' : 'border-gray-300'}`}>
                    {hasAnswered && isChoiceCorrect && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {hasAnswered && isSelected && !isChoiceCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <span>{choice}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Immediate Feedback */}
        {hasAnswered && (
          <div className={`mt-6 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {isCorrect ? <><CheckCircle2 className="w-5 h-5"/> 정답입니다!</> : <><XCircle className="w-5 h-5"/> 틀렸습니다!</>}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              <span className="font-bold">해설:</span> {question.explanation}
            </p>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="text-gray-500 hover:text-gray-800 disabled:opacity-30 font-medium px-4 py-2"
          >
            이전 문제
          </button>
          <div className="flex gap-4 w-full md:w-auto">
          {currentIdx === questions.length - 1 ? (
            <button 
              onClick={handleSubmit}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              제출하고 결과 보기 <CheckCircle2 className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={() => setCurrentIdx(prev => prev + 1)}
              className="bg-gray-900 hover:bg-black text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center gap-2 animate-pulse"
            >
              다음 문제 <ChevronRight className="w-4 h-4" />
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
