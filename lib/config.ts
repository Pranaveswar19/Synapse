// API Configuration
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Remove trailing slash if present
export const API_BASE_URL = apiUrl.replace(/\/$/, '');
