import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Exam from './pages/Exam';
import Review from './pages/Review';
import Admin from './pages/Admin';
import { API_URL } from './config';

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 라우트 경로가 전환될 때마다 로그인 상태 점검
    const token = localStorage.getItem('admin_token');
    setIsAdmin(!!token);
  }, [location]);

  const handleAdminClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 이미 로그인 상태라면 비밀번호 프롬프트를 건너뛰고 곧장 관리자 대시보드로 이동
    if (isAdmin) {
      navigate('/admin');
      return;
    }

    const code = window.prompt('관리자 비밀번호를 입력하세요.');
    if (code === null) return; // 취소 선택 시 종료
    
    const loadingToast = toast.loading('관리자 권한을 확인하고 있습니다...');
    
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: code })
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        localStorage.setItem('admin_token', data.token);
        setIsAdmin(true);
        toast.success('관리자 인증에 성공했습니다!', { id: loadingToast });
        navigate('/admin');
      } else {
        toast.error(data.error || '비밀번호가 올바르지 않습니다.', { id: loadingToast });
      }
    } catch (err) {
      toast.error('관리자 인증 중 오류가 발생했습니다. 서버 연결 상태를 확인해 주세요.', { id: loadingToast });
    }
  };

  const handleLogout = () => {
    if (window.confirm('관리자 모드에서 로그아웃 하시겠습니까?')) {
      localStorage.removeItem('admin_token');
      setIsAdmin(false);
      toast.success('로그아웃 되었습니다.');
      navigate('/');
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">
          AI 내신 코치
        </Link>
        <div className="flex items-center gap-4">
          <Link 
            to="/admin"
            onClick={handleAdminClick}
            className={`text-sm font-semibold transition-colors ${
              isAdmin ? 'text-blue-600 hover:text-blue-800' : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            {isAdmin ? '관리자 페이지' : '관리자'}
          </Link>
          {isAdmin && (
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-100 transition-colors"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <Header />
        <main className="max-w-4xl mx-auto p-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/exam" element={<Exam />} />
            <Route path="/review" element={<Review />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        {/* 토스트 알림을 띄우는 컨테이너 배치 */}
        <Toaster position="top-center" reverseOrder={false} />
      </div>
    </Router>
  );
}

export default App;
