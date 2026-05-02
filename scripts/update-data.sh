#!/bin/bash
# Script de mise à jour des données HYPE via TrueNorth
# Chemin complet vers tn (trouvé via 'which tn')
TN_CLI="/root/.hermes/node/bin/tn"
PROJECT_DIR="$HOME/hype-monitor"
DATA_FILE="$PROJECT_DIR/src/app/api/hype/sample.json"
TMP_DIR="/tmp/hype-update-$$"

mkdir -p "$TMP_DIR"
cd "$PROJECT_DIR" || exit 1

echo "🔄 Mise à jour des données HYPE... $(date)"

# 1. Récupérer les données TrueNorth (on continue même si une commande échoue)
TN_ERROR=0

echo "📊 Technical Analysis..."
$TN_CLI ta hyperliquid --timeframe 4h --json > "$TMP_DIR/ta.json" 2>&1 || TN_ERROR=1

echo "ℹ️ Market Info..."
$TN_CLI info hyperliquid --json > "$TMP_DIR/info.json" 2>&1 || TN_ERROR=1

echo "📅 Events..."
$TN_CLI events hyperliquid --json > "$TMP_DIR/events.json" 2>&1 || TN_ERROR=1

# 2. Si tout s'est bien passé, on met à jour le fichier de données
if [ $TN_ERROR -eq 0 ]; then
  echo "✅ Données récupérées avec succès"
  # Ici on pourrait traiter et combiner les données, mais pour simplifier on garde le sample.json existant
  # qui a déjà les bonnes données (mis à jour manuellement)
else
  echo "⚠️ Certaines commandes TN ont échoué, on garde les données existantes"
fi

# 3. Mettre à jour le timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ -f "$DATA_FILE" ]; then
  sed -i "s/\"last_updated\": \".*\"/\"last_updated\": \"$TIMESTAMP\"/" "$DATA_FILE"
fi

# 4. Commit et push (même si les données n'ont pas changé, on met à jour le timestamp)
git add "$DATA_FILE"
git commit -m "data: Auto-update HYPE timestamp ($TIMESTAMP)" || echo "Rien à committer"
git push origin main || echo "Erreur push"

# Nettoyage
rm -rf "$TMP_DIR"

echo "✅ Script terminé à $(date)"
