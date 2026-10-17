import { Route, Routes } from 'react-router-dom';
import SessionDetailPage from './pages/SessionDetailPage';
import SessionListPage from './pages/SessionListPage';

export default function App() {
  return (
    <Routes>
      <Route path='/' element={<SessionListPage />} />
      <Route path='/sessions/:sessionId' element={<SessionDetailPage />} />
    </Routes>
  );
}
