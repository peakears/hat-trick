import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "../../data";

/** Persistent KeyValueStore backed by AsyncStorage (works in Expo Go and in a built APK). */
export class AsyncStorageStore implements KeyValueStore {
  get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  set(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  }

  delete(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  }

  async keys(): Promise<string[]> {
    return [...(await AsyncStorage.getAllKeys())];
  }
}
