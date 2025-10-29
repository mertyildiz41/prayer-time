#!/bin/bash

# Prayer Time Multi-Platform App - Project Validation Script
# This script verifies that all necessary files and folders are in place

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   🙏 PRAYER TIME MULTI-PLATFORM APP - VALIDATION SCRIPT       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check file existence
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
        ((FAILED++))
    fi
}

# Function to check directory existence
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $1/ (MISSING)"
        ((FAILED++))
    fi
}

echo "📋 CHECKING ROOT LEVEL FILES"
echo "═══════════════════════════════════════════════════════════════"
check_file "package.json"
check_file "README.md"
check_file "GETTING_STARTED.md"
check_file "ARCHITECTURE.md"
check_file "SETUP_SUMMARY.md"
check_file "START_HERE.md"
check_file "INDEX.md"
check_file "CHECKLIST.md"
check_file "PROJECT_SUMMARY.txt"
check_file ".gitignore"
echo ""

echo "📦 CHECKING SHARED PACKAGE"
echo "═══════════════════════════════════════════════════════════════"
check_dir "packages/shared"
check_file "packages/shared/package.json"
check_file "packages/shared/tsconfig.json"
check_file "packages/shared/README.md"
check_file "packages/shared/src/types.ts"
check_file "packages/shared/src/calculator.ts"
check_file "packages/shared/src/constants.ts"
check_file "packages/shared/src/utils.ts"
check_file "packages/shared/src/index.ts"
echo ""

echo "🌐 CHECKING WEB PACKAGE (PWA - React)"
echo "═══════════════════════════════════════════════════════════════"
check_dir "packages/web"
check_file "packages/web/package.json"
check_file "packages/web/tsconfig.json"
check_file "packages/web/README.md"
check_file "packages/web/src/App.tsx"
check_file "packages/web/src/App.css"
check_file "packages/web/src/index.tsx"
check_file "packages/web/src/index.css"
check_file "packages/web/src/components/PrayerCard.tsx"
check_file "packages/web/src/components/PrayerCard.css"
check_file "packages/web/public/index.html"
check_file "packages/web/public/manifest.json"
echo ""

echo "📱 CHECKING MOBILE PACKAGE (React Native)"
echo "═══════════════════════════════════════════════════════════════"
check_dir "packages/mobile"
check_file "packages/mobile/package.json"
check_file "packages/mobile/tsconfig.json"
check_file "packages/mobile/README.md"
check_file "packages/mobile/src/App.tsx"
check_file "packages/mobile/src/index.ts"
check_file "packages/mobile/src/screens/PrayerTimeScreen.tsx"
echo ""

echo "🖥️  CHECKING DESKTOP PACKAGE (Electron)"
echo "═══════════════════════════════════════════════════════════════"
check_dir "packages/desktop"
check_file "packages/desktop/package.json"
check_file "packages/desktop/tsconfig.json"
check_file "packages/desktop/tsconfig.react.json"
check_file "packages/desktop/README.md"
check_file "packages/desktop/src/main.ts"
check_file "packages/desktop/src/preload.ts"
check_file "packages/desktop/src/App.tsx"
check_file "packages/desktop/src/index.tsx"
check_file "packages/desktop/src/index.css"
check_file "packages/desktop/public/index.html"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📊 VALIDATION SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
TOTAL=$((PASSED + FAILED))
echo -e "Total Files/Dirs Checked: ${YELLOW}${TOTAL}${NC}"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "🎉 Your Prayer Time Multi-Platform App is ready!"
    echo ""
    echo "📚 NEXT STEPS:"
    echo "   1. Read: START_HERE.md"
    echo "   2. Read: GETTING_STARTED.md"
    echo "   3. Run: npm install -g yarn"
    echo "   4. Run: yarn install-all"
    echo "   5. Start: yarn web:dev"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME CHECKS FAILED${NC}"
    echo "Please review the missing files listed above."
    echo ""
    exit 1
fi
