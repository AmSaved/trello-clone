import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import io from 'socket.io-client';
import List from './List';

const Board = ({ board: initialBoard }) => {
    const [board, setBoard] = useState(initialBoard);
    const [showAddList, setShowAddList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const newSocket = io('http://localhost:5000', {
            auth: { token }
        });

        newSocket.on('connect', () => {
            console.log('✅ Connected to socket');
            newSocket.emit('join-board', board._id);
        });

        newSocket.on('card-updated', (updatedCard) => {
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

        newSocket.on('card-created', (newCard) => {
            setBoard(prevBoard => {
                const newLists = [...prevBoard.lists];
                const listIndex = newLists.findIndex(l => l._id === newCard.list);
                if (listIndex !== -1) {
                    newLists[listIndex].cards.push(newCard);
                }
                return { ...prevBoard, lists: newLists };
            });
        });

        newSocket.on('list-created', (newList) => {
            setBoard(prev => ({
                ...prev,
                lists: [...prev.lists, newList]
            }));
        });

        setSocket(newSocket);

        return () => {
            newSocket.emit('leave-board', board._id);
            newSocket.close();
        };
    }, [board._id]);

    const fetchBoard = async () => {
        setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    const handleAddList = async (e) => {
        e.preventDefault();
        if (!newListTitle.trim()) return;

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
            
            if (!sourceList || !destList) return;
            
            const card = sourceList.cards[source.index];

            // Update local state
            const newLists = [...board.lists];
            const sourceListIndex = newLists.findIndex(l => l._id === source.droppableId);
            const destListIndex = newLists.findIndex(l => l._id === destination.droppableId);
            
            // Remove from source
            const [movedCard] = newLists[sourceListIndex].cards.splice(source.index, 1);
            // Add to destination
            newLists[destListIndex].cards.splice(destination.index, 0, movedCard);
            
            setBoard({ ...board, lists: newLists });

            // Update backend
            try {
                const response = await fetch(`http://localhost:5000/api/cards/${card._id}/move`, {
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
                
                if (!response.ok) {
                    throw new Error('Failed to move card');
                }
            } catch (error) {
                console.error('Error moving card:', error);
                fetchBoard(); // Revert on error
            }
        }
    };

    if (loading) {
        return <div className="loading">Loading board...</div>;
    }

    return (
        <div className="board" style={{ backgroundColor: board.backgroundColor || '#0079bf' }}>
            <div className="board-header">
                <h3>{board.title}</h3>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="all-lists" direction="horizontal" type="list">
                    {(provided) => (
                        <div 
                            className="lists-container"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {board.lists?.map((list, index) => (
                                <Draggable key={list._id} draggableId={list._id} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            style={{
                                                ...provided.draggableProps.style,
                                                marginRight: '10px'
                                            }}
                                        >
                                            <div {...provided.dragHandleProps}>
                                                <List 
                                                    key={list._id} 
                                                    list={list} 
                                                    boardId={board._id}
                                                    socket={socket}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}

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
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
};

export default Board;