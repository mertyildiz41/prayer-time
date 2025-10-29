import React from 'react';
import { DailyPrayerTimes } from '@prayer-time/shared';
import './PrayerCard.css';

interface PrayerCardProps {
  prayerTimes: DailyPrayerTimes;
}

export const PrayerCard: React.FC<PrayerCardProps> = ({ prayerTimes }) => {
  return (
    <div className="prayer-card">
      <h2>{prayerTimes.date}</h2>
      <div className="prayer-times">
        {prayerTimes.prayers.map((prayer) => (
          <div key={prayer.name} className="prayer-item">
            <span className="prayer-name">{prayer.name}</span>
            <span className="prayer-time">{prayer.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
