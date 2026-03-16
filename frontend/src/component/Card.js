import React, { useState } from 'react';

const Card = ({ card }) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <>
            <div className="card" onClick={() => setShowDetails(true)}>
                <div className="card-title">{card.title}</div>
                {card.description && (
                    <div className="card-description-preview">
                        {card.description.substring(0, 50)}...
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
            </div>

            {showDetails && (
                <div className="modal" onClick={() => setShowDetails(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{card.title}</h3>
                        <div className="card-details">
                            <div className="detail-section">
                                <h4>Description</h4>
                                <p>{card.description || 'No description'}</p>
                            </div>
                            
                            {card.dueDate && (
                                <div className="detail-section">
                                    <h4>Due Date</h4>
                                    <p>{new Date(card.dueDate).toLocaleDateString()}</p>
                                </div>
                            )}

                            {card.comments?.length > 0 && (
                                <div className="detail-section">
                                    <h4>Comments</h4>
                                    {card.comments.map((comment, i) => (
                                        <div key={i} className="comment">
                                            <strong>{comment.user?.name}:</strong>
                                            <p>{comment.text}</p>
                                            <small>{new Date(comment.createdAt).toLocaleString()}</small>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowDetails(false)}>Close</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Card;