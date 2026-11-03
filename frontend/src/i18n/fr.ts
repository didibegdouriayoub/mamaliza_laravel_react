import type { Messages } from './en';

// French texts, using the glossary agreed with the owner (2026-11-03)
const fr: Messages = {
  common: {
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', create: 'Créer', close: 'Fermer',
    search: 'Rechercher', loading: 'Chargement…', yes: 'Oui', no: 'Non', name: 'Nom', email: 'E-mail', password: 'Mot de passe',
    role: 'Rôle', language: 'Langue', hide: 'Masquer', show: 'Afficher',
  },
  nav: {
    navigation: 'Navigation',
    dashboard: 'Tableau de bord', inventory: 'Stock', recipes: 'Recettes', batches: 'Productions', quality: 'Qualité',
    estimation: 'Estimation', products: 'Produits', finishing: 'Finition', finishedGoods: 'Produits finis',
    scanLot: 'Scanner un lot', customers: 'Clients', suppliers: 'Fournisseurs', tournees: 'Tournées', sales: 'Ventes',
    analytics: 'Analyses', users: 'Utilisateurs', permissions: 'Autorisations',
  },
  topbar: { notifications: 'Notifications', clearAll: 'Tout effacer', noNotifications: 'Aucune notification', toggleDark: 'Mode sombre', logout: 'Déconnexion', delete: 'Supprimer' },
  login: {
    tagline: "Système de gestion de fromagerie", welcome: 'Bon retour', subtitle: 'Connectez-vous pour gérer votre fromagerie',
    email: 'E-mail', password: 'Mot de passe', signIn: 'Se connecter', signingIn: 'Connexion…',
    invalid: 'Identifiants invalides.', connectFailed: 'Connexion impossible. Vérifiez que le serveur est démarré.',
  },
  users: {
    language: 'Langue', english: 'English', french: 'Français',
    languageHelp: "La langue que cet utilisateur voit dans l'application. Les documents imprimés ne changent pas.",
  },
};

export default fr;
