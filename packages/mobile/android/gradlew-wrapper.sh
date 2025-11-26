#!/bin/bash

# Wrapper script for gradlew that ensures JAVA_HOME is set

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

if [ ! -d "$JAVA_HOME" ]; then
    echo "❌ Error: Java Runtime not found"
    echo ""
    echo "Please set JAVA_HOME to your JDK location:"
    echo "  export JAVA_HOME=\"/Applications/Android Studio.app/Contents/jbr/Contents/Home\""
    echo ""
    echo "Or install Android Studio which includes a JDK."
    exit 1
fi

# Execute gradlew with the correct JAVA_HOME
exec ./gradlew "$@"

