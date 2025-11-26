# Android APK Build Instructions

## Prerequisites

1. **Android Studio** (includes JDK) - [Download here](https://developer.android.com/studio)
2. **Node.js and Yarn** - Already installed

## Quick Build Steps

### Option 1: Using the Build Script (Recommended)

```bash
cd packages/mobile
./setup-android-build.sh  # Run once to set up dependencies
./build-android.sh        # Build the APK
```

The APK will be at: `packages/mobile/android/app/build/outputs/apk/release/app-release.apk`

### Option 2: Using Android Studio (Easiest)

1. Open **Android Studio**
2. Click **Open** and select: `packages/mobile/android`
3. Wait for Gradle sync to complete
4. Go to **Build > Generate Signed Bundle / APK**
5. Select **APK**
6. Use the existing debug keystore (password: `android`)
7. Click **Finish**

The APK will be generated in the same location as above.

### Option 3: Manual Gradle Build

```bash
cd packages/mobile/android

# Set Java Home (required)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# Build the APK
./gradlew assembleRelease
```

## Troubleshooting

### "Unable to locate a Java Runtime"

If you get this error, set JAVA_HOME:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Or add to your `~/.zshrc` or `~/.bash_profile`:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

### "Gradle plugin not found"

Run the setup script first:
```bash
cd packages/mobile
./setup-android-build.sh
```

### Build Fails with Plugin Errors

If you encounter plugin resolution errors, try building via Android Studio instead, as it handles dependency paths automatically.

## APK Location

After a successful build, the APK will be at:
```
packages/mobile/android/app/build/outputs/apk/release/app-release.apk
```

You can share this file directly with others to install on Android devices.

