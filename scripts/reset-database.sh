#!/bin/bash

# ============================================
# DATABASE RESET SCRIPT
# WARNING: This will DELETE ALL DATA!
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}"
echo "╔════════════════════════════════════════════╗"
echo "║         ⚠️  DATABASE RESET WARNING ⚠️        ║"
echo "║                                            ║"
echo "║  This will DELETE ALL DATA including:     ║"
echo "║  - All users                              ║"
echo "║  - All dashboards                         ║"
echo "║  - All organizations                      ║"
echo "║  - All credits and transactions           ║"
echo "║                                            ║"
echo "║  This action CANNOT be undone!            ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

read -p "Are you sure you want to reset the database? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Aborted. No changes made.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Resetting database...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set.${NC}"
    echo ""
    echo "Set it using:"
    echo "  export DATABASE_URL='postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres'"
    echo ""
    echo "You can find this in your Supabase Dashboard under Settings > Database > Connection string."
    echo "Or run the SQL directly in the Supabase Dashboard SQL Editor."
    exit 1
fi

# Run the SQL script using psql
echo "Connecting to database..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/reset-database.sql"

echo ""
echo -e "${GREEN}✓ Database reset complete!${NC}"
