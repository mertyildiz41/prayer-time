#!/bin/bash

# Android APK Build Script
# This script builds the Android release APK

set -e

echo "🔨 Building Android Release APK..."

# Set Java Home (adjust path if needed)
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

if [ ! -d "$JAVA_HOME" ]; then
    echo "❌ Java not found at $JAVA_HOME"
    echo "Please set JAVA_HOME to your JDK location"
    exit 1
fi

# Navigate to android directory
cd "$(dirname "$0")/android"

# Ensure gradle wrapper is executable
chmod +x gradlew

# Verify Java is accessible (quote the path to handle spaces)
JAVA_BIN="${JAVA_HOME}/bin/java"
if ! "${JAVA_BIN}" -version > /dev/null 2>&1; then
    echo "❌ Error: Java is not accessible at $JAVA_HOME"
    exit 1
fi

echo "✅ Using Java: $("${JAVA_BIN}" -version 2>&1 | head -1)"

# Ensure Node.js is available (required by some RN gradle plugins)
if ! command -v node >/dev/null 2>&1; then
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "$HOME/.nvm/nvm.sh"
    fi
fi

if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not available in PATH. Please install Node or load your Node version manager."
    exit 1
fi

NODE_BIN="$(command -v node)"
export NODE_BINARY="$NODE_BIN"
echo "✅ Using Node: $("$NODE_BIN" -v)"

# Build the APK (using debug for now due to react-native-permissions release variant issue)
echo "📦 Building APK..."
# Ensure Gradle uses the correct Java and stop any existing daemons
./gradlew --stop 2>/dev/null || true
# Set Java home for Gradle
export JAVA_HOME

# Try release first, fall back to debug if it fails
echo "🔄 Attempting release build..."
if ./gradlew assembleRelease -Dorg.gradle.java.home="$JAVA_HOME" > /tmp/gradle-build.log 2>&1; then
    APK_VARIANT="release"
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
    echo "✅ Release build successful!"
else
    echo "⚠️  Release build failed, trying debug build..."
    if ./gradlew assembleDebug -Dorg.gradle.java.home="$JAVA_HOME" > /tmp/gradle-build.log 2>&1; then
        APK_VARIANT="debug"
        APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
        echo "✅ Debug build successful!"
    else
        echo "❌ Both release and debug builds failed"
        cat /tmp/gradle-build.log | tail -30
        exit 1
    fi
fi

# Check if build was successful
if [ -f "$APK_PATH" ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📱 APK location: $(pwd)/$APK_PATH"
    echo "📦 Variant: $APK_VARIANT"
    echo ""
    echo "You can now share this APK file."
    if [ "$APK_VARIANT" = "debug" ]; then
        echo "ℹ️  Note: This is a debug APK (signed with debug keystore)"
    fi
else
    echo "❌ Build failed - APK not found"
    exit 1
fi


