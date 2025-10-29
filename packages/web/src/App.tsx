import React, { useEffect, useState } from 'react';
import { PrayerTimeCalculator, DailyPrayerTimes } from '@prayer-time/shared';
import { PrayerCard } from './components/PrayerCard';
import './App.css';

function App() {
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [location, setLocation] = useState({ latitude: 0, longitude: 0 });

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });

        // Calculate prayer times
        const times = PrayerTimeCalculator.calculatePrayerTimes(
          new Date(),
          {
            latitude,
            longitude,
            city: 'Your City',
            country: 'Your Country',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          'MuslimWorldLeague'
        );
        setPrayerTimes(times);
      });
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>⏰ Prayer Times</h1>
        <p>Get accurate prayer times for your location</p>
      </header>

      <main className="app-main">
        {prayerTimes ? (
          <PrayerCard prayerTimes={prayerTimes} />
        ) : (
          <div className="loading">Loading prayer times...</div>
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 Prayer Time App. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
