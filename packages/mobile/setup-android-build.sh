#!/bin/bash

# Setup script to prepare Android build in monorepo
# This creates a local node_modules structure for the gradle plugin

set -e

echo "🔧 Setting up Android build environment..."

# Set JAVA_HOME to Android Studio's bundled JDK
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

if [ ! -d "$JAVA_HOME" ]; then
    echo "❌ Error: Java not found at $JAVA_HOME"
    echo "   Please install Android Studio or set JAVA_HOME to your JDK location"
    exit 1
fi

echo "✅ Java found at: $JAVA_HOME"
JAVA_BIN="${JAVA_HOME}/bin/java"
"${JAVA_BIN}" -version 2>&1 | head -1

MOBILE_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$MOBILE_DIR/../.." && pwd)"

# Create local node_modules structure
mkdir -p "$MOBILE_DIR/node_modules/@react-native"

# Check if gradle plugin exists in root
if [ -d "$ROOT_DIR/node_modules/@react-native/gradle-plugin" ]; then
    echo "✅ Found gradle plugin in root node_modules"
    
    # Copy (not symlink, as Gradle doesn't follow symlinks for includeBuild)
    if [ ! -d "$MOBILE_DIR/node_modules/@react-native/gradle-plugin" ]; then
        echo "📦 Copying gradle plugin to local node_modules..."
        cp -R "$ROOT_DIR/node_modules/@react-native/gradle-plugin" "$MOBILE_DIR/node_modules/@react-native/gradle-plugin"
        echo "✅ Gradle plugin copied successfully"
    else
        echo "ℹ️  Gradle plugin already exists locally"
    fi
else
    echo "❌ Error: gradle plugin not found in root node_modules"
    echo "   Please run 'yarn install' from the root directory first"
    exit 1
fi

echo ""
echo "✅ Setup complete! You can now build the Android APK."
echo "   Run: cd android && ./gradlew assembleRelease"

