import Constants from 'expo-constants';

// Set this to your machine's exact local IPv4 address if automatic detection fails:
// e.g. const HARDCODED_IP = "10.77.78.194";
const HARDCODED_IP = null;

const getLocalIP = () => {
  if (HARDCODED_IP) return HARDCODED_IP;

  // Constants.expoConfig?.hostUri contains the development server's IP address (e.g. "10.77.78.194:8081")
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return 'localhost';
};

export const BACKEND_IP = getLocalIP();
export const BACKEND_BASE_URL = `http://${BACKEND_IP}:5000`;

console.log('[EchoSense Config] Using backend base URL:', BACKEND_BASE_URL);
