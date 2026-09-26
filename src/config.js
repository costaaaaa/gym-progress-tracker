// Configuration file for the application

// Base URL for API requests
// Using relative path for production and absolute for dev
export const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost/gym-progress-tracker/backend/'
  : '/backend/';

// Other configuration settings
export const APP_NAME = 'LiftIndex';
export const APP_VERSION = '2.0.0';