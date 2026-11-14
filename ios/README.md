# Atticory iOS

Native SwiftUI app for Atticory inventory. Uses the same FastAPI backend as the web app (Bearer JWT + multipart uploads).

## Requirements

- Xcode 16+
- iOS 17+
- Local API at `http://localhost:8092` (Simulator) or your Mac’s LAN IP (device)

## Setup

```bash
# From repo root — start backend first
task api_service:dev

# Generate / refresh the Xcode project
cd ios
xcodegen generate
open Atticory.xcodeproj
```

In Xcode:

1. Select the **Atticory** target → Signing → your Team
2. Run on Simulator or a device

### API URL

| Build | Config | Default |
|-------|--------|---------|
| Debug | `Configs/Debug.xcconfig` | `http://localhost:8092` |
| Release | `Configs/Release.xcconfig` | set your Railway prod API URL |

On a **physical device**, `localhost` is the phone — point Debug at your Mac, e.g. `http://192.168.1.20:8092`.

Auth uses short-lived access tokens plus a refresh token (`POST /auth/refresh`). The app stores both in Keychain.

## Features

- Sign in / register (Keychain token storage)
- Inventory list, search, pagination
- Add / edit items with camera + photo library (up to 4 images)
- AI analyze (multipart) + queue analysis after save
- Categories CRUD
- Dashboard metrics
- Profile / sign out

## Notes

- This is a real native client, not a web wrapper.
- App icon is a placeholder — drop a 1024×1024 image into `Atticory/Resources/Assets.xcassets/AppIcon.appiconset`.
- Access tokens are short-lived; the app refreshes via Keychain-stored refresh tokens.
