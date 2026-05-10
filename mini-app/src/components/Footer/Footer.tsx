import React from 'react';
import './Footer.css';

const buildCommit = typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev';
const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

export const Footer: React.FC = () => (
  <footer className="app-footer">
    <span>Developed by Vanya Trubchik &amp; Anton Mitkov 2026</span>
    <span
      className="build-tag"
      title={`Build: ${buildCommit} @ ${buildTime}`}
      style={{
        display: 'block',
        fontSize: 9,
        opacity: 0.3,
        marginTop: 2,
        fontFamily: 'monospace',
      }}
    >
      v{buildCommit}
    </span>
  </footer>
);
