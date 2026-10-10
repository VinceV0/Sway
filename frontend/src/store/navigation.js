// A tiny global store that bypasses prop drilling entirely
let currentTab = 'home';
const listeners = new Set();

export const navStore = {
  getTab: () => currentTab,
  setTab: (tab) => {
    currentTab = tab;
    listeners.forEach((listener) => listener(currentTab));
  },
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};