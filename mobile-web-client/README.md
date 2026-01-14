# Stock Dip Notifier Client (Expo)

A minimal Expo app that shows current dips from the backend API.

## Setup

```bash
npm install
npx expo start
```

## API base URL

Set `EXPO_PUBLIC_API_BASE_URL` so the app can reach your backend.

Examples:

- iOS simulator:
  ```bash
  EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npx expo start
  ```

- Android emulator:
  ```bash
  EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000 npx expo start
  ```

- Web:
  ```bash
  EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npx expo start --web
  ```

If you do not set the env var, the app falls back to `http://localhost:8000`.

## Backend checks

Make sure the backend is running, then verify with:

```bash
curl "http://127.0.0.1:8000/health"
curl "http://127.0.0.1:8000/dips?rule=drawdown_20d&limit=25"
```
