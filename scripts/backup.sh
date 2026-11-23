#!/bin/bash
# Backup diário do banco do Gestão Contábil (pg_dump compactado), mantendo os últimos 14 dias.
# Cron do host: 15 4 * * *  /opt/gestaocontabil/scripts/backup.sh >> /var/log/gestaocontabil-backup.log 2>&1
# Restaurar: gunzip -c backups/ARQUIVO.sql.gz | docker compose -f docker-compose.vps.yml --env-file .env.vps exec -T postgres psql -U gestaocontabil -d gestaocontabil
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$DIR/backups"
KEEP_DAYS=14
mkdir -p "$DEST"
chmod 700 "$DEST"

FILE="$DEST/gestaocontabil-$(date +%Y%m%d-%H%M%S).sql.gz"
cd "$DIR"
# pipefail: se o pg_dump falhar, o backup falha (em vez de gravar um arquivo vazio)
docker compose -f docker-compose.vps.yml --env-file .env.vps exec -T postgres \
  pg_dump -U gestaocontabil -d gestaocontabil --no-owner --clean --if-exists | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"

find "$DEST" -name 'gestaocontabil-*.sql.gz' -mtime +$KEEP_DAYS -delete
echo "$(date '+%F %T') backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
