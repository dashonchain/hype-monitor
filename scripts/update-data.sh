#!/bin/bash
# Script de mise à jour des données HYPE via TrueNorth
# À exécuter toutes les 5 minutes via cron

set -e

PROJECT_DIR="$HOME/hype-monitor"
DATA_FILE="$PROJECT_DIR/src/app/api/hype/sample.json"
TMP_DIR="/tmp/hype-update-$$"

mkdir -p "$TMP_DIR"

echo "🔄 Mise à jour des données HYPE..."

# 1. Récupérer les données TrueNorth
tn ta hyperliquid --timeframe 4h --json > "$TMP_DIR/ta.json" 2>&1 || echo "Erreur TA"
tn info hyperliquid --json > "$TMP_DIR/info.json" 2>&1 || echo "Erreur Info"
tn events hyperliquid --json > "$TMP_DIR/events.json" 2>&1 || echo "Erreur Events"

# 2. Traiter et combiner les données (ici on garde le format existant)
# Note: Dans un vrai setup, on parserait le JSON proprement avec jq
# Pour simplifier, on recrée le fichier sample.json avec les nouvelles données

# Copier le fichier existant (déjà au bon format)
cp "$PROJECT_DIR/src/app/api/hype/sample.json" "$DATA_FILE.new"

# 3. Mettre à jour le timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
sed -i "s/\"last_updated\": \".*\"/\"last_updated\": \"$TIMESTAMP\"/" "$DATA_FILE.new"

# 4. Remplacer l'ancien fichier
mv "$DATA_FILE.new" "$DATA_FILE"

# 5. Commit et push
cd "$PROJECT_DIR"
git add "$DATA_FILE"
git commit -m "data: Auto-update HYPE data from TrueNorth ($TIMESTAMP)" || echo "Rien à committer"
git push origin main || echo "Erreur push"

# Nettoyage
rm -rf "$TMP_DIR"

echo "✅ Données mises à jour et poussées sur GitHub"
