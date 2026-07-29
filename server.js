const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const CHEMIN_ANNONCES = './data/annonces.json';

const valeursMarche = {
  "iphone 12": 400, "iphone 13": 550, "iphone 14": 650, "iphone 11": 300,
  "samsung galaxy s21": 350, "samsung galaxy s22": 450,
  "ps5": 550, "ps4": 250, "xbox series": 500, "xbox one": 180,
  "macbook air": 750, "macbook pro": 1100,
  "nintendo switch": 380,
  "vélo": 350, "bicyclette": 350,
  "table": 220, "canapé": 500, "sofa": 500, "commode": 200, "bureau": 180,
  "outils": 220, "perceuse": 100,
  "aspirateur": 150, "laveuse": 400, "sécheuse": 350, "réfrigérateur": 600,
  "tv": 400, "téléviseur": 400,
  "console": 300
};

function estimerValeurRevente(annonce) {
  const titre = annonce.titre.toLowerCase();
  const description = (annonce.description || '').toLowerCase();
  const texte = titre + ' ' + description;
  let valeurBase = null;

  for (const [cle, valeur] of Object.entries(valeursMarche)) {
    if (texte.includes(cle)) {
      valeurBase = valeur;
      break;
    }
  }

  if (!valeurBase) {
    const multiplicateurs = {
      "Électronique": 2.2,
      "Meubles": 2.5,
      "Sport": 2.0,
      "Outils": 2.3,
      "Électroménager": 2.0,
      "Autre": 1.8
    };
    valeurBase = annonce.prix * (multiplicateurs[annonce.categorie] || 1.8);
  }

  const facteurEtat = {
    "Excellent": 1.0,
    "Bon": 0.9,
    "Moyen": 0.75
  };
  valeurBase *= facteurEtat[annonce.etat] || 0.85;

  return Math.round(valeurBase);
}

function calculerScore(profit, prixAchat, etat) {
  let score = 0;
  const ratioProfit = profit / Math.max(prixAchat, 1);
  score += Math.min(ratioProfit * 30, 50);

  const pointsEtat = { "Excellent": 25, "Bon": 18, "Moyen": 10 };
  score += pointsEtat[etat] || 5;

  score += Math.min((profit / 20), 25);

  return Math.min(Math.round(score), 100);
}

function lireAnnonces() {
  if (!fs.existsSync(CHEMIN_ANNONCES)) return [];
  return JSON.parse(fs.readFileSync(CHEMIN_ANNONCES, 'utf8'));
}

function ecrireAnnonces(annonces) {
  fs.writeFileSync(CHEMIN_ANNONCES, JSON.stringify(annonces, null, 2));
}

function analyserAnnonces(budget) {
  const annonces = lireAnnonces();

  return annonces
    .filter(a => a.prix <= budget)
    .map(a => {
      const valeurEstimee = estimerValeurRevente(a);
      const profit = valeurEstimee - a.prix;
      const score = calculerScore(profit, a.prix, a.etat);
      return { ...a, valeurEstimee, profit, score };
    })
    .filter(a => a.profit > 50)
    .sort((a, b) => b.score - a.score);
}

app.get('/api/opportunites', (req, res) => {
  const budget = parseFloat(req.query.budget) || 500;
  res.json(analyserAnnonces(budget));
});

app.post('/api/annonces', (req, res) => {
  const { titre, prix, categorie, etat, ville, description, url } = req.body;

  if (!titre || !prix || !categorie || !etat) {
    return res.status(400).json({ erreur: 'Champs manquants' });
  }

  const icones = {
    "Électronique": "📱", "Meubles": "🛋️", "Sport": "🚲",
    "Outils": "🔧", "Électroménager": "🧺", "Autre": "📦"
  };

  const annonces = lireAnnonces();
  const nouvelleAnnonce = {
    id: Date.now(),
    titre,
    prix: parseFloat(prix),
    categorie,
    etat,
    ville: ville || "Québec",
    description: description || "",
    url: url || "",
    image: icones[categorie] || "📦"
  };

  annonces.push(nouvelleAnnonce);
  ecrireAnnonces(annonces);

  res.json({ succes: true, annonce: nouvelleAnnonce });
});

app.delete('/api/annonces/:id', (req, res) => {
  const id = parseInt(req.params.id);
  let annonces = lireAnnonces();
  annonces = annonces.filter(a => a.id !== id);
  ecrireAnnonces(annonces);
  res.json({ succes: true });
});

app.delete('/api/annonces', (req, res) => {
  ecrireAnnonces([]);
  res.json({ succes: true });
});

app.listen(PORT, () => {
  console.log(`✅ FlipHunter AI démarré sur le port ${PORT}`);
});
