#!/bin/bash

set -e

# Kolory do terminala
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguracja SFTP
SFTP_HOST="94.124.5.102"
SFTP_PORT="2222"
SFTP_USER="bmscope"
SFTP_PASS="Bmscope123!"
REMOTE_DIR="/var/www/files"
REMOTE_FILE="audix.apk"

# Ścieżka do projektu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"


echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Audix Android Build & Deploy Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Sprawdź czy sshpass jest zainstalowany
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}sshpass nie jest zainstalowany. Instaluję...${NC}"
    brew install hudochenkov/sshpass/sshpass
fi

# Sprawdź czy eas-cli jest zainstalowany
if ! command -v eas &> /dev/null; then
    echo -e "${RED}EAS CLI nie jest zainstalowany!${NC}"
    echo "Zainstaluj: npm install -g eas-cli"
    exit 1
fi

# ========================================
# KROK 1: Budowanie APK
# ========================================
echo -e "${YELLOW}[1/4] Rozpoczynam budowanie APK...${NC}"
echo ""

BUILD_START=$(date +%s)

# Buduj APK w chmurze EAS i pobierz
echo -e "${BLUE}Buduję w chmurze EAS...${NC}"
BUILD_OUTPUT=$(eas build --platform android --profile preview --non-interactive --json 2>&1)

# Wyciągnij URL do APK
BUILD_URL=$(echo "$BUILD_OUTPUT" | grep -o '"artifacts":{"buildUrl":"[^"]*"' | sed 's/.*"buildUrl":"\([^"]*\)".*/\1/')

if [ -z "$BUILD_URL" ]; then
    # Próbuj inny sposób parsowania
    BUILD_URL=$(echo "$BUILD_OUTPUT" | grep -oE 'https://expo\.dev/artifacts/[^"]+\.apk' | head -1)
fi

if [ -z "$BUILD_URL" ]; then
    echo -e "${RED}Nie udało się uzyskać URL buildu${NC}"
    echo "$BUILD_OUTPUT"
    exit 1
fi

echo -e "${GREEN}Build URL: $BUILD_URL${NC}"
echo -e "${BLUE}Pobieram APK...${NC}"
curl -L -o ./audix-build.apk "$BUILD_URL"

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
BUILD_MINUTES=$((BUILD_TIME / 60))
BUILD_SECONDS=$((BUILD_TIME % 60))

echo ""
echo -e "${GREEN}✓ Build zakończony w ${BUILD_MINUTES}m ${BUILD_SECONDS}s${NC}"
echo ""

# Sprawdź czy plik istnieje
if [ ! -f "./audix-build.apk" ]; then
    echo -e "${RED}Błąd: Plik audix-build.apk nie został utworzony!${NC}"
    exit 1
fi

APK_SIZE=$(ls -lh ./audix-build.apk | awk '{print $5}')
echo -e "${BLUE}Rozmiar APK: ${APK_SIZE}${NC}"
echo ""

# ========================================
# KROK 2: Sprawdź poprzednią wersję na serwerze
# ========================================
echo -e "${YELLOW}[2/4] Sprawdzam pliki na serwerze...${NC}"

# Pobierz listę plików z serwera
FILE_LIST=$(sshpass -p "$SFTP_PASS" ssh -o StrictHostKeyChecking=no -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "ls -la $REMOTE_DIR/audix*.apk 2>/dev/null" || echo "")

echo ""
echo -e "${BLUE}Pliki na serwerze:${NC}"
if [ -z "$FILE_LIST" ]; then
    echo "  (brak plików audix*.apk)"
else
    echo "$FILE_LIST" | while read line; do
        echo "  $line"
    done
fi
echo ""

# Znajdź najwyższą wersję
HIGHEST_VERSION=$(sshpass -p "$SFTP_PASS" ssh -o StrictHostKeyChecking=no -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "ls $REMOTE_DIR/audix-v*.apk 2>/dev/null | sed 's/.*audix-v\([0-9]*\)\.apk/\1/' | sort -n | tail -1" || echo "")

if [ -z "$HIGHEST_VERSION" ]; then
    HIGHEST_VERSION=0
fi

NEXT_VERSION=$((HIGHEST_VERSION + 1))

echo -e "${BLUE}Najwyższa znaleziona wersja: ${HIGHEST_VERSION}${NC}"
echo -e "${BLUE}Następna wersja backupu: ${NEXT_VERSION}${NC}"
echo ""

# ========================================
# KROK 3: Backup poprzedniego pliku na serwerze
# ========================================
echo -e "${YELLOW}[3/4] Tworzę backup poprzedniego pliku...${NC}"

# Sprawdź czy audix.apk istnieje i zrób backup
BACKUP_RESULT=$(sshpass -p "$SFTP_PASS" ssh -o StrictHostKeyChecking=no -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "
    if [ -f '$REMOTE_DIR/$REMOTE_FILE' ]; then
        mv '$REMOTE_DIR/$REMOTE_FILE' '$REMOTE_DIR/audix-v${NEXT_VERSION}.apk'
        echo 'BACKUP_CREATED'
    else
        echo 'NO_FILE'
    fi
" 2>/dev/null)

if [ "$BACKUP_RESULT" = "BACKUP_CREATED" ]; then
    echo -e "${GREEN}✓ Poprzedni plik zapisany jako audix-v${NEXT_VERSION}.apk${NC}"
else
    echo -e "${BLUE}ℹ Brak poprzedniego pliku do backupu${NC}"
fi
echo ""

# ========================================
# KROK 4: Upload nowego pliku
# ========================================
echo -e "${YELLOW}[4/4] Wysyłam nowy plik na serwer...${NC}"

UPLOAD_START=$(date +%s)

sshpass -p "$SFTP_PASS" scp -o StrictHostKeyChecking=no -P "$SFTP_PORT" ./audix-build.apk "$SFTP_USER@$SFTP_HOST:$REMOTE_DIR/$REMOTE_FILE"

UPLOAD_END=$(date +%s)
UPLOAD_TIME=$((UPLOAD_END - UPLOAD_START))

echo -e "${GREEN}✓ Upload zakończony w ${UPLOAD_TIME}s${NC}"
echo ""

# ========================================
# Podsumowanie
# ========================================
TOTAL_TIME=$((BUILD_TIME + UPLOAD_TIME))
TOTAL_MINUTES=$((TOTAL_TIME / 60))
TOTAL_SECONDS=$((TOTAL_TIME % 60))

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   DEPLOY ZAKOŃCZONY SUKCESEM!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Podsumowanie:${NC}"
echo -e "  • Czas budowy:  ${BUILD_MINUTES}m ${BUILD_SECONDS}s"
echo -e "  • Czas uploadu: ${UPLOAD_TIME}s"
echo -e "  • Całkowity:    ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s"
echo -e "  • Rozmiar APK:  ${APK_SIZE}"
echo ""
echo -e "${BLUE}Pliki na serwerze po deploymencie:${NC}"
sshpass -p "$SFTP_PASS" ssh -o StrictHostKeyChecking=no -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "ls -lh $REMOTE_DIR/audix*.apk 2>/dev/null" | while read line; do
    echo "  $line"
done
echo ""
echo -e "${GREEN}URL do pobrania: http://${SFTP_HOST}/files/audix.apk${NC}"
echo ""

# Cleanup lokalny plik
rm -f ./audix-build.apk
echo -e "${BLUE}ℹ Lokalny plik tymczasowy usunięty${NC}"
