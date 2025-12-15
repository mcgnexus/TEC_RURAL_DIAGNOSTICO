'use client';

import { useState } from 'react';

const PasswordToggle = ({ isVisible, onToggle, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="password-toggle"
      style={{
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '4px',
        borderRadius: '4px',
        color: disabled ? 'var(--color-muted)' : 'var(--color-text)',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 0.2s ease'
      }}
      onMouseDown={e => e.preventDefault()} // Prevent focus on button click
    >
      {isVisible ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      )}
    </button>
  );
};

export default PasswordToggle;