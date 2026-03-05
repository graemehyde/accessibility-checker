import { devices } from 'playwright';

export const DEVICE_PROFILES = {
  desktop:  { name: 'Desktop (1280×720)',  viewport: { width: 1280, height: 720 } },
  mobile:   { name: 'iPhone 14',           ...devices['iPhone 14'] },
  mobileSE: { name: 'iPhone SE',           ...devices['iPhone SE'] },
  tablet:   { name: 'iPad Mini',           ...devices['iPad Mini'] },
  android:  { name: 'Pixel 7',             ...devices['Pixel 7'] },
};

export const DEFAULT_PROFILES = ['desktop', 'mobile', 'tablet'];
