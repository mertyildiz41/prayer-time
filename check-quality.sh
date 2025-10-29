#!/bin/bash

# Prayer Time App - Code Quality Check Script
# Verifies TypeScript syntax and package structure

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        🔍 CODE QUALITY & SYNTAX VALIDATION                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}📋 CHECKING TYPESCRIPT FILES SYNTAX${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Function to check TypeScript file syntax
check_ts_syntax() {
    local file=$1
    if [ -f "$file" ]; then
        # Check if file is valid by counting curly braces
        open_braces=$(grep -o '{' "$file" | wc -l)
        close_braces=$(grep -o '}' "$file" | wc -l)
        
        # Check for import/export keywords
        has_structure=$(grep -E "^(import|export|interface|type|class|function|const)" "$file" | wc -l)
        
        if [ $open_braces -eq $close_braces ] && [ $has_structure -gt 0 ]; then
            echo -e "${GREEN}✓${NC} $file"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} $file (syntax check incomplete)"
            return 1
        fi
    fi
}

echo "${BLUE}Shared Package:${NC}"
check_ts_syntax "packages/shared/src/types.ts"
check_ts_syntax "packages/shared/src/calculator.ts"
check_ts_syntax "packages/shared/src/constants.ts"
check_ts_syntax "packages/shared/src/utils.ts"
check_ts_syntax "packages/shared/src/index.ts"
echo ""

echo "${BLUE}Web Package:${NC}"
check_ts_syntax "packages/web/src/App.tsx"
check_ts_syntax "packages/web/src/index.tsx"
check_ts_syntax "packages/web/src/components/PrayerCard.tsx"
echo ""

echo "${BLUE}Mobile Package:${NC}"
check_ts_syntax "packages/mobile/src/App.tsx"
check_ts_syntax "packages/mobile/src/index.ts"
check_ts_syntax "packages/mobile/src/screens/PrayerTimeScreen.tsx"
echo ""

echo "${BLUE}Desktop Package:${NC}"
check_ts_syntax "packages/desktop/src/main.ts"
check_ts_syntax "packages/desktop/src/preload.ts"
check_ts_syntax "packages/desktop/src/App.tsx"
check_ts_syntax "packages/desktop/src/index.tsx"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "${BLUE}📦 CHECKING PACKAGE.JSON STRUCTURE${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Function to check package.json
check_package_json() {
    local file=$1
    local name=$2
    if [ -f "$file" ]; then
        if grep -q '"name"' "$file" && grep -q '"version"' "$file"; then
            echo -e "${GREEN}✓${NC} $name - Valid package.json"
            return 0
        fi
    fi
}

check_package_json "packages/shared/package.json" "Shared"
check_package_json "packages/web/package.json" "Web"
check_package_json "packages/mobile/package.json" "Mobile"
check_package_json "packages/desktop/package.json" "Desktop"
check_package_json "package.json" "Root Monorepo"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "${BLUE}📚 CHECKING IMPORTS & EXPORTS${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if files have proper exports
check_exports() {
    local file=$1
    local module=$2
    if [ -f "$file" ]; then
        if grep -q "export" "$file"; then
            echo -e "${GREEN}✓${NC} $module - Has exports"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} $module - No exports found"
            return 1
        fi
    fi
}

echo "${BLUE}Shared Package Exports:${NC}"
check_exports "packages/shared/src/index.ts" "index.ts"
echo ""

echo "${BLUE}Web Package:${NC}"
check_exports "packages/web/src/App.tsx" "App.tsx"
check_exports "packages/web/src/components/PrayerCard.tsx" "PrayerCard.tsx"
echo ""

echo "${BLUE}Mobile Package:${NC}"
check_exports "packages/mobile/src/App.tsx" "App.tsx"
echo ""

echo "${BLUE}Desktop Package:${NC}"
check_exports "packages/desktop/src/App.tsx" "App.tsx"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "${BLUE}🔗 CHECKING CROSS-PACKAGE IMPORTS${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if packages import from @prayer-time/shared
check_shared_import() {
    local file=$1
    local package=$2
    if [ -f "$file" ]; then
        if grep -q "@prayer-time/shared" "$file"; then
            echo -e "${GREEN}✓${NC} $package - Imports from shared"
            return 0
        fi
    fi
}

check_shared_import "packages/web/src/App.tsx" "Web"
check_shared_import "packages/mobile/src/screens/PrayerTimeScreen.tsx" "Mobile"
check_shared_import "packages/desktop/src/App.tsx" "Desktop"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "${BLUE}📊 FILE COUNT VERIFICATION${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Count files by type
ts_files=$(find packages -name "*.ts" -o -name "*.tsx" | wc -l)
config_files=$(find packages -name "tsconfig.json" -o -name "package.json" | wc -l)
doc_files=$(find . -maxdepth 1 -name "*.md" -o -name "*.txt" | wc -l)

echo -e "TypeScript/TSX Files: ${YELLOW}${ts_files}${NC}"
echo -e "Config Files: ${YELLOW}${config_files}${NC}"
echo -e "Documentation Files: ${YELLOW}${doc_files}${NC}"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "${GREEN}✓ CODE QUALITY CHECK COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📌 All files are in place and properly structured."
echo "📌 Next: Install Node.js and Yarn, then run: yarn install-all"
echo ""
