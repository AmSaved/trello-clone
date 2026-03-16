import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Board from './components/Board';
import './App.css';

function AppContent() {
  const { user, login, register, logout, isAuthenticated, loading } = useAuth();
  const [boards, setBoards] = useState([]);
  const [showAuth, setShowAuth] = useState('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoard, setNewBoard] = useState({ 
    title: '', 
    backgroundColor: '#0079bf' 
  });
  const [selectedBoard, setSelectedBoard] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBoards();
    }
  }, [isAuthenticated]);

  const fetchBoards = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/boards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setBoards(data);
    } catch (error) {
      console.error('Error fetching boards:', error);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');

    let result;
    if (showAuth === 'login') {
      result = await login(formData.email, formData.password);
    } else {
      result = await register(formData.name, formData.email, formData.password);
    }

    if (!result.success) {
      setError(result.error);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoard.title.trim()) return;

    try {
      const response = await fetch('http://localhost:5000/api/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newBoard)
      });
      const board = await response.json();
      setBoards([...boards, board]);
      setShowCreateBoard(false);
      setNewBoard({ title: '', backgroundColor: '#0079bf' });
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>📋 Trello Clone</h1>
          <h2>{showAuth === 'login' ? 'Login' : 'Register'}</h2>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleAuthSubmit}>
            {showAuth === 'register' && (
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
            )}
            
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            
            <button type="submit">
              {showAuth === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
          
          <p className="auth-switch">
            {showAuth === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setShowAuth(showAuth === 'login' ? 'register' : 'login')}>
              {showAuth === 'login' ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (selectedBoard) {
    return (
      <div className="App">
        <header>
          <button className="back-btn" onClick={() => setSelectedBoard(null)}>
            ← Back to Boards
          </button>
          <h1>📋 {selectedBoard.title}</h1>
          <button onClick={logout} className="logout-btn">Logout</button>
        </header>
        <Board board={selectedBoard} />
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <h1>📋 Welcome, {user?.name}!</h1>
        <button onClick={logout} className="logout-btn">Logout</button>
      </header>

      <div className="boards-section">
        <div className="boards-header">
          <h2>Your Boards</h2>
          <button onClick={() => setShowCreateBoard(true)}>+ Create New Board</button>
        </div>

        {showCreateBoard && (
          <div className="modal">
            <div className="modal-content">
              <h3>Create New Board</h3>
              <form onSubmit={handleCreateBoard}>
                <input
                  type="text"
                  placeholder="Board Title"
                  value={newBoard.title}
                  onChange={(e) => setNewBoard({...newBoard, title: e.target.value})}
                  required
                />
                <div className="color-picker">
                  <label>Background Color:</label>
                  <input
                    type="color"
                    value={newBoard.backgroundColor}
                    onChange={(e) => setNewBoard({...newBoard, backgroundColor: e.target.value})}
                  />
                </div>
                <div className="modal-actions">
                  <button type="submit">Create</button>
                  <button type="button" onClick={() => setShowCreateBoard(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="boards-grid">
          {boards.map(board => (
            <div 
              key={board._id} 
              className="board-card"
              onClick={() => setSelectedBoard(board)}
              style={{ backgroundColor: board.backgroundColor }}
            >
              <h3>{board.title}</h3>
              <p>{board.lists?.length || 0} lists</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;