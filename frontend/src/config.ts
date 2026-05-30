// API 기본 URL을 환경변수에서 가져옴
// 로컬: .env의 VITE_API_URL (http://localhost:8080)
// 배포: .env.production의 VITE_API_URL (Railway URL)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
