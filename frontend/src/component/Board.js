import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import io from 'socket.io-client';
import List from './List';

const Board = ({ board: initialBoard }) => {
    const [board, setBoard] = useState(initialBoard);
    const [showAddList, setShowAddList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const newSocket = io('http://localhost:5000', {
            auth: { token }
        });

        newSocket.on('connect', () => {
            console.log('Connected to socket');
            newSocket.emit('join-board', board._id);
        });

        newSocket.on('card-updated', (updatedCard) => {
            // Update card in real-time
            setBoard(prevBoard => {
                const newLists = [...prevBoard.lists];
                newLists.forEach(list => {
                    list.cards = list.cards.map(card => 
                        card._id === updatedCard._id ? updatedCard : card
                    );
                });
                return { ...prevBoard, lists: newLists };
            });
        });

        setSocket(newSocket);

        return () => {
            newSocket.emit('leave-board', board._id);
            newSocket.close();
        };
    }, [board._id]);

    const fetchBoard = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/boards/${board._id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setBoard(data);
        } catch (error) {
            console.error('Error fetching board:', error);
        }
    };

    const handleAddList = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://localhost:5000/api/boards/${board._id}/lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title: newListTitle })
            });
            const newList = await response.json();
            setBoard(prev => ({
                ...prev,
                lists: [...prev.lists, newList]
            }));
            setNewListTitle('');
            setShowAddList(false);
        } catch (error) {
            console.error('Error adding list:', error);
        }
    };

    const onDragEnd = async (result) => {
        const { destination, source, draggableId, type } = result;

        if (!destination) return;

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) return;

        if (type === 'card') {
            const sourceList = board.lists.find(l => l._id === source.droppableId);
            const destList = board.lists.find(l => l._id === destination.droppableId);
            const card = sourceList.cards[source.index];

            // Update local state
            const newLists = [...board.lists];
            sourceList.cards.splice(source.index, 1);
            destList.cards.splice(destination.index, 0, card);
            setBoard({ ...board, lists: newLists });

            // Update backend
            try {
                await fetch(`http://localhost:5000/api/cards/${card._id}/move`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        sourceListId: source.droppableId,
                        destinationListId: destination.droppableId,
                        newPosition: destination.index
                    })
                });
            } catch (error) {
                console.error('Error moving card:', error);
                fetchBoard(); // Revert on error
            }
        }
    };

    return (
        <div className="board" style={{ backgroundColor: board.backgroundColor }}>
            <div className="board-header">
                <h3>{board.title}</h3>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="lists-container">
                    {board.lists?.map((list, index) => (
                        <List key={list._id} list={list} boardId={board._id} />
                    ))}

                    {showAddList ? (
                        <form onSubmit={handleAddList} className="add-list-form">
                            <input
                                type="text"
                                value={newListTitle}
                                onChange={(e) => setNewListTitle(e.target.value)}
                                placeholder="Enter list title..."
                                autoFocus
                            />
                            <div className="form-actions">
                                <button type="submit">Add List</button>
                                <button type="button" onClick={() => setShowAddList(false)}>✕</button>
                            </div>
                        </form>
                    ) : (
                        <button className="add-list-btn" onClick={() => setShowAddList(true)}>
                            + Add another list
                        </button>
                    )}
                </div>
            </DragDropContext>
        </div>
    );
};

export default Board;