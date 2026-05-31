import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Exam from './pages/Exam';
import Review from './pages/Review';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link to="/" className="text-xl font-bold text-blue-600">
              AI 내신 코치
            </Link>
            <Link 
              to="/admin" 
              className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors"
              onClick={(e) => {
                const code = window.prompt('관리자 비밀번호를 입력하세요.');
                if (code !== '7564') {
                  e.preventDefault();
                  if (code !== null) alert('비밀번호가 일치하지 않습니다.');
                }
              }}
            >
              관리자
            </Link>
          </div>
        </header>
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
