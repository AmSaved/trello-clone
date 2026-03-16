import React, { useState } from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import Card from './Card';

const List = ({ list, boardId, socket }) => {
    const [showAddCard, setShowAddCard] = useState(false);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [showListMenu, setShowListMenu] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(list.title);

    const handleAddCard = async (e) => {
        e.preventDefault();
        if (!newCardTitle.trim()) return;

        try {
            const response = await fetch(`http://localhost:5000/api/lists/${list._id}/cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title: newCardTitle })
            });
            
            if (response.ok) {
                const newCard = await response.json();
                list.cards.push(newCard);
                setNewCardTitle('');
                setShowAddCard(false);
            }
        } catch (error) {
            console.error('Error adding card:', error);
        }
    };

    const handleUpdateTitle = async () => {
        if (!editedTitle.trim() || editedTitle === list.title) {
            setIsEditingTitle(false);
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/lists/${list._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title: editedTitle })
            });

            if (response.ok) {
                list.title = editedTitle;
                setIsEditingTitle(false);
            }
        } catch (error) {
            console.error('Error updating list title:', error);
        }
    };

    const handleDeleteList = async () => {
        if (!window.confirm('Are you sure you want to delete this list and all its cards?')) return;

        try {
            const response = await fetch(`http://localhost:5000/api/lists/${list._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                // Emit socket event for real-time deletion
                socket?.emit('list-deleted', { listId: list._id, boardId });
            }
        } catch (error) {
            console.error('Error deleting list:', error);
        }
    };

    return (
        <div className="list">
            <div className="list-header">
                {isEditingTitle ? (
                    <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onBlur={handleUpdateTitle}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateTitle()}
                        autoFocus
                    />
                ) : (
                    <>
                        <h4 onClick={() => setIsEditingTitle(true)}>{list.title}</h4>
                        <div className="list-actions">
                            <span className="card-count">{list.cards?.length || 0}</span>
                            <button 
                                className="list-menu-btn"
                                onClick={() => setShowListMenu(!showListMenu)}
                            >
                                ⋮
                            </button>
                        </div>
                    </>
                )}
                
                {showListMenu && (
                    <div className="list-menu">
                        <button onClick={handleDeleteList}>Delete List</button>
                    </div>
                )}
            </div>

            <Droppable droppableId={list._id} type="card">
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`cards-container ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    >
                        {list.cards?.map((card, index) => (
                            <Draggable key={card._id} draggableId={card._id} index={index}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`card-wrapper ${snapshot.isDragging ? 'dragging' : ''}`}
                                    >
                                        <Card card={card} />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>

            {showAddCard ? (
                <form onSubmit={handleAddCard} className="add-card-form">
                    <input
                        type="text"
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        placeholder="Enter card title..."
                        autoFocus
                    />
                    <div className="form-actions">
                        <button type="submit">Add Card</button>
                        <button type="button" onClick={() => setShowAddCard(false)}>✕</button>
                    </div>
                </form>
            ) : (
                <button className="add-card-btn" onClick={() => setShowAddCard(true)}>
                    + Add a card
                </button>
            )}
        </div>
    );
};

export default List;