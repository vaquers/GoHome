import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './TabBar.css';

import heartIcon from '../../../assets/icons/heart.svg';
import heartFillIcon from '../../../assets/icons/heart.fill.svg';
import giftIcon from '../../../assets/icons/gift.svg';
import giftFillIcon from '../../../assets/icons/gift.fill.svg';

const TABS = [
  {
    id: 'voting',
    label: 'Голосование',
    icon: heartIcon,
    iconActive: heartFillIcon,
    path: '/',
  },
  {
    id: 'raffle',
    label: 'Розыгрыш',
    icon: giftIcon,
    iconActive: giftFillIcon,
    path: '/raffle',
  },
] as const;

export const TabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeIndex = useMemo(() => {
    const idx = TABS.findIndex((t) => t.path === location.pathname);
    return idx >= 0 ? idx : 0;
  }, [location.pathname]);

  return (
    <div className="tabbar-wrapper">
      <nav className="tabbar-pill" aria-label="Main navigation">
        <div
          className="tabbar-active-indicator"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {TABS.map((tab, index) => {
          const isActive = index === activeIndex;
          const isEmoji = 'isEmoji' in tab && tab.isEmoji;
          return (
            <button
              key={tab.id}
              type="button"
              className={`tabbar-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(tab.path)}
              aria-current={isActive ? 'page' : undefined}
            >
              {isEmoji ? (
                <span className="tabbar-emoji">{isActive ? tab.iconActive : tab.icon}</span>
              ) : (
                <img
                  src={isActive ? tab.iconActive : tab.icon}
                  alt=""
                  className="tabbar-icon"
                />
              )}
              <span className="tabbar-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
