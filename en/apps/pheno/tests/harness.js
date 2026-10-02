import { IDBFactory } from 'fake-indexeddb';
import { openDb } from '../js/storage.js';

export const freshDb = () => openDb('t', new IDBFactory());
export const T0 = '2026-05-01T08:00:00.000Z';
export const day = (n) => new Date(new Date(T0).getTime() + n * 86400000).toISOString();
export const basePlant = (o = {}) => ({ name: 'Bazalka', variety: 'Genovese', category: 'herb', environment: 'indoor', startDate: T0, ...o });
