import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   LEARNSY-DEV-ICON.JSX  ·  Icon terminal cho Dev Island
   File riêng theo yêu cầu — import vào main.js TRƯỚC learnsy-dev-island.jsx

   Thêm vào main.js:
     import './components/learnsy-dev-icon.jsx'

   API: window.DevIslandIcon — <Icon size={20} color="#4ade80"/>
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

function DevIslandIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.2" stroke={color} strokeWidth="1.8"/>
      <path d="M6.6 9.6l3 2.4-3 2.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="14.4" x2="17" y2="14.4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

window.DevIslandIcon = DevIslandIcon;
})();
