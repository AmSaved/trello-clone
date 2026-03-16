import React, { useState } from 'react';

const Card = ({ card }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCard, setEditedCard] = useState({
        title: card.title,
        description: card.description || ''
    });
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [newComment, setNewComment] = useState('');

    const handleUpdateCard = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/cards/${card._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(editedCard)
            });

            if (response.ok) {
                const updatedCard = await response.json();
                card.title = updatedCard.title;
                card.description = updatedCard.description;
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Error updating card:', error);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        try {
            const response = await fetch(`http://localhost:5000/api/cards/${card._id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ text: newComment })
            });

            if (response.ok) {
                const comment = await response.json();
                if (!card.comments) card.comments = [];
                card.comments.push(comment);
                setNewComment('');
                setShowCommentInput(false);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleDeleteCard = async () => {
        if (!window.confirm('Are you sure you want to delete this card?')) return;

        try {
            await fetch(`http://localhost:5000/api/cards/${card._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            setShowDetails(false);
        } catch (error) {
            console.error('Error deleting card:', error);
        }
    };

    return (
        <>
            <div className="card" onClick={() => setShowDetails(true)}>
                <div className="card-title">{card.title}</div>
                {card.description && (
                    <div className="card-description-preview">
                        {card.description.substring(0, 50)}
                        {card.description.length > 50 && '...'}
                    </div>
                )}
                {card.labels?.length > 0 && (
                    <div className="card-labels">
                        {card.labels.map((label, i) => (
                            <span
                                key={i}
                                className="label"
                                style={{ backgroundColor: label.color }}
                            >
                                {label.text}
                            </span>
                        ))}
                    </div>
                )}
                {card.dueDate && (
                    <div className="card-due-date">
                        📅 {new Date(card.dueDate).toLocaleDateString()}
                    </div>
                )}
                {card.comments?.length > 0 && (
                    <div className="card-comment-count">
                        💬 {card.comments.length}
                    </div>
                )}
            </div>

            {showDetails && (
                <div className="modal" onClick={() => setShowDetails(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                            <>
                                <input
                                    type="text"
                                    value={editedCard.title}
                                    onChange={(e) => setEditedCard({...editedCard, title: e.target.value})}
                                    placeholder="Card title"
                                    autoFocus
                                />
                                <textarea
                                    value={editedCard.description}
                                    onChange={(e) => setEditedCard({...editedCard, description: e.target.value})}
                                    placeholder="Description"
                                    rows="4"
                                />
                                <div className="modal-actions">
                                    <button onClick={handleUpdateCard}>Save</button>
                                    <button onClick={() => setIsEditing(false)}>Cancel</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3>{card.title}</h3>
                                <div className="card-details">
                                    <div className="detail-section">
                                        <h4>Description</h4>
                                        <p>{card.description || 'No description'}</p>
                                        <button onClick={() => setIsEditing(true)}>Edit</button>
                                    </div>
                                    
                                    {card.labels?.length > 0 && (
                                        <div className="detail-section">
                                            <h4>Labels</h4>
                                            <div className="card-labels">
                                                {card.labels.map((label, i) => (
                                                    <span
                                                        key={i}
                                                        className="label"
                                                        style={{ backgroundColor: label.color }}
                                                    >
                                                        {label.text}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {card.dueDate && (
                                        <div className="detail-section">
                                            <h4>Due Date</h4>
                                            <p>{new Date(card.dueDate).toLocaleDateString()}</p>
                                        </div>
                                    )}

                                    <div className="detail-section">
                                        <h4>Comments</h4>
                                        {card.comments?.map((comment, i) => (
                                            <div key={i} className="comment">
                                                <strong>{comment.user?.name || 'User'}:</strong>
                                                <p>{comment.text}</p>
                                                <small>{new Date(comment.createdAt).toLocaleString()}</small>
                                            </div>
                                        ))}
                                        
                                        {showCommentInput ? (
                                            <div className="add-comment">
                                                <textarea
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    placeholder="Write a comment..."
                                                    rows="2"
                                                />
                                                <div className="modal-actions">
                                                    <button onClick={handleAddComment}>Save</button>
                                                    <button onClick={() => setShowCommentInput(false)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowCommentInput(true)}>
                                                + Add Comment
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-actions">
                                    <button className="delete-btn" onClick={handleDeleteCard}>
                                        Delete Card
                                    </button>
                                    <button onClick={() => setShowDetails(false)}>Close</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default Card;