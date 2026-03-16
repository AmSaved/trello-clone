import React, { useState } from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import Card from './Card';

const List = ({ list, boardId }) => {
    const [showAddCard, setShowAddCard] = useState(false);
    const [newCardTitle, setNewCardTitle] = useState('');

    const handleAddCard = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://localhost:5000/api/lists/${list._id}/cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title: newCardTitle })
            });
            const newCard = await response.json();
            list.cards.push(newCard);
            setNewCardTitle('');
            setShowAddCard(false);
        } catch (error) {
            console.error('Error adding card:', error);
        }
    };

    return (
        <div className="list">
            <div className="list-header">
                <h4>{list.title}</h4>
                <span className="card-count">{list.cards?.length || 0}</span>
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