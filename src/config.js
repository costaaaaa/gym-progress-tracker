// Configuration file for the application

// Base URL for API requests
// Using relative path instead of absolute path
export const API_BASE_URL = window.location.hostname === 'localhost' 
  ? `${window.location.protocol}//${window.location.host}/gym-progress-tracker/backend/`
  : `${window.location.protocol}//${window.location.host}/gym-progress-tracker-v2/backend/`;

// Other configuration settings
export const APP_NAME = 'Gym Progress Tracker';
export const APP_VERSION = '2.0.0';