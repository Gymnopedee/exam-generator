import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trophy, FileText, ChevronRight } from 'lucide-react';
import { API_URL } from '../config';

interface Subject {
  id: string;
  name: string;
  color: string;
  units: string[];
}

export default function Home() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    fetchSubjectsAndUnits();
  }, []);

  const fetchSubjectsAndUnits = async () => {
    try {
      // 1. Fetch subjects
      const subRes = await fetch(`${API_URL}/api/subjects`);
      const subData = await subRes.json();
      
      // 2. We no longer need materials for unit grouping, just set subjects
      if (subData.success) {
        setSubjects(subData.subjects);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStart = (subjectId: string) => {
    navigate(`/exam?subject=${subjectId}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 bg-white opacity-10 rounded-full w-64 h-64 blur-3xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            AI와 함께하는<br />완벽한 내신 대비
          </h2>
          <p className="text-blue-100 text-lg max-w-xl mb-8 leading-relaxed">
            학교 프린트와 교과서를 분석해 선생님의 출제 포인트를 정확히 짚어냅니다. 당신만의 맞춤형 문제은행으로 성적을 올려보세요.
          </p>
          <div className="flex gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3 w-max">
              <Trophy className="text-yellow-300 w-8 h-8" />
              <div>
                <div className="text-sm text-blue-100 font-medium">나의 정답률</div>
                <div className="text-2xl font-bold">78%</div>
              </div>
            </div>
          </div>
        </div>
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
              className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all cursor-pointer`}
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
