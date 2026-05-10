import React, { useEffect, useMemo, useState } from 'react';
import LightRays from '@/components/LightRays/LightRays';
import { getConfig, getRaffle, subscribeRaffle, type RafflePayload } from '@/api/misterApi';
import './RaffleScreen.css';

function lightenHex(hex: string): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 40);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 40);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const RaffleScreen: React.FC = () => {
  const [accentColor, setAccentColor] = useState('#A855F7');

  useEffect(() => {
    getConfig().then((cfg) => {
      if (cfg.event.accent_color) {
        setAccentColor(cfg.event.accent_color);
        const root = document.documentElement;
        root.style.setProperty('--accent', cfg.event.accent_color);
        root.style.setProperty('--accent-rgb', `${parseInt(cfg.event.accent_color.slice(1, 3), 16)}, ${parseInt(cfg.event.accent_color.slice(3, 5), 16)}, ${parseInt(cfg.event.accent_color.slice(5, 7), 16)}`);
      }
    }).catch(() => {});
  }, []);

  const lightRays = useMemo(
    () => (
      <LightRays
        raysOrigin="top-center"
        raysColor={lightenHex(accentColor)}
        raysSpeed={0.6}
        lightSpread={1.8}
        rayLength={3.0}
        followMouse={false}
        pulsating
        fadeDistance={2.5}
        saturation={0.9}
        noiseAmount={0.04}
        distortion={0.03}
      />
    ),
    [accentColor],
  );

  const [raffle, setRaffle] = useState<RafflePayload | null>(null);
  const [animating, setAnimating] = useState(false);
  const [displayRow, setDisplayRow] = useState<number | null>(null);
  const [displaySeat, setDisplaySeat] = useState<number | null>(null);

  useEffect(() => {
    getRaffle().then(setRaffle).catch(() => {});
    const unsub = subscribeRaffle((data) => {
      setRaffle(data);
      if (data.winner) {
        // Animate the reveal
        setAnimating(true);
        setDisplayRow(null);
        setDisplaySeat(null);
        // Slot machine effect
        let tick = 0;
        const maxTicks = 20;
        const interval = setInterval(() => {
          tick++;
          setDisplayRow(Math.floor(Math.random() * 26) + 1);
          setDisplaySeat(Math.floor(Math.random() * 26) + 1);
          if (tick >= maxTicks) {
            clearInterval(interval);
            setDisplayRow(data.winner!.row);
            setDisplaySeat(data.winner!.seat);
            setAnimating(false);
          }
        }, 80);
      }
    });
    return unsub;
  }, []);

  // Set initial display from raffle data
  useEffect(() => {
    if (raffle?.winner && !animating) {
      setDisplayRow(raffle.winner.row);
      setDisplaySeat(raffle.winner.seat);
    }
  }, [raffle]);

  const isActive = raffle?.active ?? false;

  return (
    <div className="voting-screen">
      <div className="voting-galaxy-bg">{lightRays}</div>

      <div className="raffle-main">
        {!isActive && (
          <div className="raffle-waiting">
            <p className="raffle-subtitle">Ожидайте начала розыгрыша</p>
          </div>
        )}

        {isActive && !displayRow && (
          <div className="raffle-waiting">
            <p className="raffle-subtitle">Ожидайте...</p>
          </div>
        )}

        {isActive && displayRow && (
          <div className="raffle-result">
            <div className={`raffle-winner-card${animating ? ' raffle-winner-card--spin' : ''}`}>
              <div className="raffle-winner-numbers">
                <div className="raffle-winner-block">
                  <span className="raffle-winner-caption">ряд</span>
                  <span className="raffle-winner-value">{displayRow}</span>
                </div>
                <div className="raffle-winner-divider" />
                <div className="raffle-winner-block">
                  <span className="raffle-winner-caption">место</span>
                  <span className="raffle-winner-value">{displaySeat}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
