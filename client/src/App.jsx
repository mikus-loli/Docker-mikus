import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import StackDetail from './pages/StackDetail';
import NewStack from './pages/NewStack';
import Login from './pages/Login';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
    const token = useAuthStore((s) => s.token);
    if (!token) return <Navigate to="/login" replace />;
    return children;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="stack/new" element={<NewStack />} />
                <Route path="stack/:name" element={<StackDetail />} />
                <Route path="settings" element={<Settings />} />
            </Route>
        </Routes>
    );
}
