import { storage } from './baseStorage';

const READING_POSITION_KEY = 'quranReadingPosition';

type ReadingPosition = {
  surahNumber: number;
  scrollY: number;
  timestamp: number;
};

type ReadingPositions = {
  [surahNumber: number]: ReadingPosition;
};

export const quranStorage = {
  /**
   * Save the reading position for a specific surah
   */
  async saveReadingPosition(surahNumber: number, scrollY: number): Promise<void> {
    try {
      const rawValue = await storage.getString(READING_POSITION_KEY);
      let positions: ReadingPositions = {};
      
      if (rawValue) {
        try {
          positions = JSON.parse(rawValue);
        } catch {
          // If parsing fails, start with empty object
          positions = {};
        }
      }
      
      positions[surahNumber] = {
        surahNumber,
        scrollY: Math.max(0, scrollY), // Ensure non-negative
        timestamp: Date.now(),
      };
      
      await storage.set(READING_POSITION_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Failed to save Quran reading position.', error);
    }
  },

  /**
   * Get the saved reading position for a specific surah
   */
  async getReadingPosition(surahNumber: number): Promise<number | null> {
    try {
      const rawValue = await storage.getString(READING_POSITION_KEY);
      if (!rawValue) {
        return null;
      }

      const positions: ReadingPositions = JSON.parse(rawValue);
      const position = positions[surahNumber];
      
      if (position && typeof position.scrollY === 'number') {
        return Math.max(0, position.scrollY);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to read Quran reading position.', error);
      return null;
    }
  },

  /**
   * Clear the reading position for a specific surah
   */
  async clearReadingPosition(surahNumber: number): Promise<void> {
    try {
      const rawValue = await storage.getString(READING_POSITION_KEY);
      if (!rawValue) {
        return;
      }

      const positions: ReadingPositions = JSON.parse(rawValue);
      delete positions[surahNumber];
      
      await storage.set(READING_POSITION_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Failed to clear Quran reading position.', error);
    }
  },

  /**
   * Clear all reading positions
   */
  async clearAllReadingPositions(): Promise<void> {
    try {
      await storage.delete(READING_POSITION_KEY);
    } catch (error) {
      console.error('Failed to clear all Quran reading positions.', error);
    }
  },
};

