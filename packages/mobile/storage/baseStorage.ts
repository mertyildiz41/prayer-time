import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Failed to get item from storage', error);
      return null;
    }
  },
  async set(key: string, value: string | boolean | number): Promise<void> {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (error) {
      console.error('Failed to set item in storage', error);
    }
  },
  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete item from storage', error);
    }
  },
};