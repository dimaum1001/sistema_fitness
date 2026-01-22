import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };
  return (
    <nav className="bg-blue-600 text-white py-3 mb-4">
      <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="font-semibold">Sistema Fitness Total</Link>
        <button
          onClick={handleLogout}
          className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium"
        >
          Sair
        </button>
      </div>
    </nav>
  );
}
