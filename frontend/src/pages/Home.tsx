import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trophy, FileText, ChevronRight, Calendar, TrendingUp, CheckCircle, BarChart3 } from 'lucide-react';
import { API_URL } from '../config';

interface Subject {
  id: string;
  name: string;
  color: string;
  units: string[];
}

interface ExamHistory {
  id: string;
  subjectId: string;
  subjectName: string;
  score: number;
  totalQuestions: number;
  correctRate: number;
  takenAt: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [histories, setHistories] = useState<ExamHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    fetchSubjectsAndUnits();
    fetchExamHistory();
  }, []);

  const fetchSubjectsAndUnits = async () => {
    try {
      const subRes = await fetch(`${API_URL}/api/subjects`);
      const subData = await subRes.json();
      if (subData.success) {
        setSubjects(subData.subjects);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExamHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch(`${API_URL}/api/history`);
      const data = await res.json();
      if (data.success) {
        setHistories(data.histories || []);
      }
    } catch (err) {
      console.error('Failed to fetch histories:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleStart = (subjectId: string) => {
    navigate(`/exam?subject=${subjectId}`);
  };

  // 최근 시험 평균 정답률 계산
  const averageCorrectRate = histories.length > 0
    ? Math.round(histories.reduce((acc, curr) => acc + curr.correctRate, 0) / histories.length)
    : 0;

  // 날짜 변환 헬퍼 함수
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 bg-white opacity-10 rounded-full w-64 h-64 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
              AI와 함께하는<br />완벽한 내신 대비
            </h2>
            <p className="text-blue-100 text-lg max-w-xl mb-4 leading-relaxed">
              학교 프린트와 교과서를 분석해 선생님의 출제 포인트를 정확히 짚어냅니다. 당신만의 맞춤형 문제은행으로 성적을 올려보세요.
            </p>
          </div>
          
          <div className="flex gap-4 shrink-0">
            <div className="bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-6 flex items-center gap-4 min-w-[200px]">
              <div className="bg-yellow-400/20 p-3 rounded-xl">
                <Trophy className="text-yellow-300 w-8 h-8" />
              </div>
              <div>
                <div className="text-xs text-blue-100 font-medium">평균 정답률</div>
                <div className="text-3xl font-extrabold">
                  {histories.length > 0 ? `${averageCorrectRate}%` : '대기 중'}
                </div>
                <div className="text-[10px] text-blue-200 mt-1">최근 {histories.length}회 응시 기준</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 성적 추이 & 분석 대시보드 */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="text-indigo-600 w-5 h-5" /> 나의 최근 학습 흐름 및 통계
        </h3>
        
        {isLoadingHistory ? (
          <div className="text-center py-10 text-gray-400">데이터를 불러오는 중입니다...</div>
        ) : histories.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">아직 응시한 시험 이력이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">과목을 골라 문제를 풀면, 여기에 영구히 학습 통계와 성장 추이가 기록됩니다!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 최근 정답률 히스토리 카드 */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">최근 시험 응시 이력</h4>
              <div className="divide-y divide-gray-100 max-h-[220px] overflow-y-auto pr-2 space-y-2.5">
                {histories.map((hist) => (
                  <div key={hist.id} className="flex items-center justify-between py-2.5 first:pt-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm">{hist.subjectName}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(hist.takenAt)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        총 {hist.totalQuestions}문항 중 <span className="font-semibold text-blue-600">{hist.score}문항</span> 정답
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl font-bold text-sm ${
                      hist.correctRate >= 80 ? 'bg-green-50 text-green-700' :
                      hist.correctRate >= 60 ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      {hist.correctRate}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 학습 종합 피드백 카드 */}
            <div className="bg-gradient-to-tr from-indigo-50 to-blue-50 p-5 rounded-2xl border border-blue-100 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-1.5 mb-2">
                  <CheckCircle className="w-4 h-4 text-indigo-500" /> AI의 성취 평가 피드백
                </h4>
                <p className="text-xs text-indigo-950 leading-relaxed">
                  {averageCorrectRate >= 80 ? (
                    '현재 매우 훌륭한 이해도를 보이고 있어요! 지금 기세를 유지하고 오답 노트를 활용해 마지막 빈틈까지 완벽히 방어해 보세요.'
                  ) : averageCorrectRate >= 60 ? (
                    '준수한 내신 이해도를 보여주고 있습니다. 아쉽게 틀린 문제 개념 위주로 1:1 오답 코치와 집중 상담을 진행하면 등급이 훌륭히 점프할 거예요!'
                  ) : (
                    '기초 개념 보강과 맞춤형 관리가 필요한 단계입니다. 오답 노트를 누르면 AI 코치와 대화하며 무엇이 부족했는지 알 수 있으니 지금 바로 시작해 봐요.'
                  )}
                </p>
              </div>
              <button 
                onClick={() => navigate('/review')}
                className="mt-4 w-full bg-white hover:bg-gray-50 text-indigo-700 text-xs font-bold py-2 rounded-xl border border-indigo-200 transition-colors shadow-sm"
              >
                오답 노트 학습하러 가기 &rarr;
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Subject Selection */}
      <section>
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="text-blue-600" /> 학습할 과목 선택
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subjects.map((sub) => (
            <div 
              key={sub.id} 
              className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md cursor-pointer flex flex-col`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${sub.color || 'bg-gray-500'} w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm`}>
                  <FileText />
                </div>
              </div>
              <h4 className="text-xl font-bold text-gray-800 mb-6">{sub.name}</h4>
              
              <div className="space-y-3 mt-auto">
                <button 
                  onClick={() => handleStart(sub.id)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                  전체 문제 풀기
                </button>
                <button 
                  onClick={() => navigate(`/review?subject=${sub.id}`)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium transition-colors border border-gray-200"
                >
                  <BookOpen className="w-4 h-4" />
                  오답 노트 열기
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
