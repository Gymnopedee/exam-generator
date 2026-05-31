import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
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
    
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: code })
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        // 성공 시 토큰을 안전하게 로컬스토리지에 저장 후 이동
        localStorage.setItem('admin_token', data.token);
        navigate('/admin');
      } else {
        alert(data.error || '비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      alert('관리자 인증 중 오류가 발생했습니다. 서버 연결 상태를 확인해 주세요.');
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
      </div>
    </Router>
  );
}

export default App;
