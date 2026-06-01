import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UploadCloud, File, CheckCircle2, Loader2, Database, Settings, Plus, Trash2 } from 'lucide-react';
import { API_URL } from '../config';

interface Material {
  id: string;
  filename: string;
  subject: string;
  unit: string;
  createdAt: string;
  status: string;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [questionCount, setQuestionCount] = useState('10'); // 생성할 문제 수
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubName, setNewSubName] = useState('');
  const [subAddMsg, setSubAddMsg] = useState(''); // 과목 추가 결과 메시지
  
  // SSE 실시간 AI 문제 생성 진행 상태 추적용 state
  const [progress, setProgress] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        toast.error('관리자 권한이 없습니다. 메인 페이지로 이동합니다.');
        navigate('/');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/admin/verify`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) {
          toast.error('관리자 세션이 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.');
          localStorage.removeItem('admin_token');
          navigate('/');
        }
      } catch (err) {
        toast.error('서버 연결이 원활하지 않아 관리자 권한을 인증할 수 없습니다.');
        navigate('/');
      }
    };

    checkAuth().then(() => {
      fetchMaterials();
      fetchSubjects();
    });
  }, []);

  const fetchMaterials = async () => {
    try {
      const res = await fetch(`${API_URL}/api/materials`);
      const data = await res.json();
      if (data.success) setMaterials(data.materials);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subjects`);
      const data = await res.json();
      if (data.success) {
        setSubjects(data.subjects);
        // 드롭다운 value가 ID 기반이므로 ID로 초기값 설정
        if (data.subjects.length > 0 && !subject) {
          setSubject(data.subjects[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName) return;
    setSubAddMsg('');
    try {
      const res = await fetch(`${API_URL}/api/subjects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ name: newSubName, color: 'bg-blue-500' })
      });
      const data = await res.json();
      if (data.success) {
        const newSubject: Subject = { id: data.id, name: newSubName, color: 'bg-blue-500' };
        setSubjects(prev => [...prev, newSubject]);
        if (!subject) setSubject(data.id);
        setNewSubName('');
        toast.success('🎉 새로운 과목이 추가되었습니다!');
        setSubAddMsg('✅ 과목이 추가되었습니다.');
        setTimeout(() => setSubAddMsg(''), 3000);
      } else {
        toast.error('과목 추가 실패: ' + data.error);
        setSubAddMsg('❌ ' + data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('서버와의 통신에 에러가 발생했습니다.');
      setSubAddMsg('❌ 서버 오류로 추가할 수 없습니다.');
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('과목을 삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_URL}/api/subjects/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      toast.success('🗑️ 과목이 안전하게 삭제되었습니다.');
      fetchSubjects();
    } catch (err) {
      console.error(err);
      toast.error('과목 삭제 과정에서 에러가 발생했습니다.');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('이 학습 자료를 삭제하시겠습니까?\n(주의: 등록 자료 목록에서만 제거되며, 이미 생성된 문제은행에는 영향을 주지 않습니다.)')) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/materials/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('🗑️ 자료가 안전하게 삭제되었습니다.');
        fetchMaterials();
      } else {
        toast.error('자료 삭제 실패: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('자료 삭제 과정에서 에러가 발생했습니다.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !subject) return;

    setIsUploading(true);
    setUploadSuccess(false);
    setProgress(5);
    setProgressMsg('서버와 보안 터널을 연결하여 파일을 수신하는 중입니다...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', subject);
    formData.append('questionCount', questionCount); // 문제 수 전달

    try {
      // 1) 즉각적으로 Job ID를 발급받는 백엔드 요청 전송
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: formData,
      });
      const data = await res.json();
      
      if (!data.success || !data.jobId) {
        throw new Error(data.error || '백엔드 작업 생성에 실패했습니다.');
      }

      const jobId = data.jobId;
      console.log(`[SSE Progress] Created Job ${jobId}. Connecting EventSource...`);

      // 2) 실시간 SSE 진행도 스트림 연결
      const eventSource = new EventSource(`${API_URL}/api/upload/progress?jobId=${jobId}`);

      eventSource.onmessage = (event) => {
        try {
          const jobData = JSON.parse(event.data);
          
          if (jobData.status === 'connected') {
            console.log('[SSE] Channel connected successfully.');
            return;
          }

          // 실시간 진행도 및 메세지 갱신
          if (jobData.progress !== undefined) {
            setProgress(jobData.progress);
          }
          if (jobData.message) {
            setProgressMsg(jobData.message);
          }

          // 완료 시 자원 정리 및 상태 전환
          if (jobData.status === 'completed') {
            eventSource.close();
            setProgress(null);
            setIsUploading(false);
            setUploadSuccess(true);
            setFile(null);
            toast.success('✨ 자료 등록 및 AI 맞춤 문제은행 구축이 완료되었습니다!', { duration: 5000 });
            fetchMaterials();
          }

          // 실패 시 자원 정리 및 통보
          if (jobData.status === 'failed') {
            eventSource.close();
            setProgress(null);
            setIsUploading(false);
            toast.error(jobData.error || '문제 생성 도중 예외가 발생했습니다.');
          }

        } catch (parseErr) {
          console.error('[SSE Parse Error]:', parseErr);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[SSE Connection Error]:', err);
        eventSource.close();
        setProgress(null);
        setIsUploading(false);
        toast.error('실시간 진행 상태 채널이 중단되었습니다. 작업은 백그라운드에서 계속 진행될 수 있습니다.');
      };

    } catch (err: any) {
      setProgress(null);
      setIsUploading(false);
      toast.error(err.message || '파일 전송 과정에서 통신 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <Database className="text-blue-600 w-8 h-8" />
          관리자: 학습 자료 업로드 및 설정
        </h2>
      </div>

      {/* Subject Management */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500"/> 과목 관리
        </h3>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            {subjects.length === 0 ? <div className="text-gray-400 text-sm">등록된 과목이 없습니다.</div> : null}
            {subjects.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-medium text-gray-700">{s.name}</span>
                <button type="button" onClick={() => handleDeleteSubject(s.id)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
          
          <form onSubmit={handleAddSubject} className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3 h-max">
            <h4 className="font-bold text-blue-800 text-sm mb-2">새 과목 추가</h4>
            <input type="text" placeholder="과목 이름 (예: 수학)" value={newSubName} onChange={e=>setNewSubName(e.target.value)} className="w-full p-2 rounded border focus:outline-blue-500 text-sm" required/>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded flex justify-center items-center gap-1 font-medium transition-colors text-sm">
              <Plus className="w-4 h-4"/> 추가하기
            </button>
            {/* 추가 결과 메시지 */}
            {subAddMsg && <p className="text-sm text-center mt-1">{subAddMsg}</p>}
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-6">새 자료 등록 (문제 자동 생성)</h3>
          
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">과목 선택</label>
              <select 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {subjects.length === 0 && <option value="">과목을 먼저 추가해주세요</option>}
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              
              {/* 생성 문제 수 선택 */}
              <label className="block text-sm font-semibold text-gray-700 mb-2 mt-4">생성할 문제 수</label>
              <select
                value={questionCount}
                onChange={e => setQuestionCount(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="5">5문제 (빠름)</option>
                <option value="10">10문제 (기본)</option>
                <option value="20">20문제 (권장)</option>
                <option value="30">30문제 (많음)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">자료 파일 (PDF/TXT)</label>
              <label className={`block w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}>
                <input 
                  type="file" 
                  accept=".pdf,.txt" 
                  className="hidden" 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2 text-blue-700">
                    <File className="w-8 h-8" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <UploadCloud className="w-8 h-8" />
                    <span>클릭하여 파일을 선택하세요</span>
                  </div>
                )}
              </label>
            </div>

            {/* 실시간 SSE 진행 상태 피드백 UI 보드 */}
            {progress !== null && (
              <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-indigo-700 animate-pulse flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 브레인 가동 중...
                  </span>
                  <span className="text-indigo-900 font-mono text-sm">{progress}%</span>
                </div>
                
                {/* 물결치듯 차오르는 미려한 프로그레스 바 */}
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                
                {/* 실시간 단계 메시지 */}
                <p className="text-xs text-indigo-900 leading-relaxed font-medium transition-all duration-300">
                  {progressMsg}
                </p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isUploading || !file || subjects.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> 연산 과정 추적 중...</>
              ) : (
                <><UploadCloud className="w-5 h-5" /> 자료 업로드 및 문제 생성</>
              )}
            </button>

            {uploadSuccess && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-5 h-5" /> 성공적으로 업로드 및 문제가 생성되었습니다!
              </div>
            )}
          </form>
        </div>

        {/* Uploaded Materials List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <h3 className="text-xl font-bold mb-2">등록된 자료 목록 (중복 확인용)</h3>
          <p className="text-sm text-gray-500 mb-6">최근 업로드된 자료를 확인하여 중복을 방지하세요.</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {materials.filter(mat => mat.subject === subject && mat.status === 'completed').length === 0 ? (
              <div className="text-center text-gray-400 py-10">해당 과목에 등록된 자료가 없습니다.</div>
            ) : (
              materials
                .filter(mat => mat.subject === subject && mat.status === 'completed')
                .map((mat) => (
                <div key={mat.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col gap-2 relative group">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                      <span className="px-2 py-1 bg-gray-200 text-xs rounded text-gray-600">
                        {subjects.find(s => s.id === mat.subject)?.name || mat.subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{new Date(mat.createdAt).toLocaleDateString()}</span>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteMaterial(mat.id)}
                        className="text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 p-1.5 rounded-lg border border-red-200 transition-all flex items-center justify-center shadow-sm shrink-0"
                        title="자료 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 truncate pr-6">
                    <File className="w-4 h-4 shrink-0" /> {mat.filename}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
