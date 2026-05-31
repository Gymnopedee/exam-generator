import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Exam from './pages/Exam';
import Review from './pages/Review';
import Admin from './pages/Admin';
import { API_URL } from './config';

function Header() {
  const navigate = useNavigate();

  const handleAdminClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const code = window.prompt('관리자 비밀번호를 입력하세요.');
    if (code === null) return; // 취소 선택 시 종료
    
    // 로그인 대기상태를 사용자에게 미학적으로 피드백하기 위해 로딩 토스트 띄우기
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
        toast.success('관리자 인증에 성공했습니다!', { id: loadingToast });
        navigate('/admin');
      } else {
        toast.error(data.error || '비밀번호가 올바르지 않습니다.', { id: loadingToast });
      }
    } catch (err) {
      toast.error('관리자 인증 중 오류가 발생했습니다. 서버 연결 상태를 확인해 주세요.', { id: loadingToast });
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">
          AI 내신 코치
        </Link>
        <a 
          href="/admin"
          onClick={handleAdminClick}
          className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors"
        >
          관리자
        </a>
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
