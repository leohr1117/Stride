import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TEST_KOPIE = path.join(WURZEL, 'tmp-playwright');
export const TEST_APP = path.join(TEST_KOPIE, 'app.db');
export const TEST_ZUGANG = path.join(TEST_KOPIE, 'zugang.db');
export const TEST_WELT = path.join(TEST_KOPIE, 'welten', '1.db');
export const TEST_TEIL_WELT = path.join(TEST_KOPIE, 'welten', '2.db');
export const TEST_PORT = 3327;
export const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;
export const TEST_PASSWORT = 'Stride-Test-2026';
