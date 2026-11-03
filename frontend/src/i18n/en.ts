// English texts. Keys are grouped by area; fr.ts must have the same keys (checked by a test).
const en = {
  common: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', create: 'Create', close: 'Close',
    search: 'Search', loading: 'Loading…', yes: 'Yes', no: 'No', name: 'Name', email: 'Email', password: 'Password',
    role: 'Role', language: 'Language', hide: 'Hide', show: 'Show',
  },
  nav: {
    navigation: 'Navigation',
    dashboard: 'Dashboard', inventory: 'Inventory', recipes: 'Recipes', batches: 'Batches', quality: 'Quality',
    estimation: 'Estimation', products: 'Products', finishing: 'Finishing', finishedGoods: 'Finished Goods',
    scanLot: 'Scan Lot', customers: 'Customers', suppliers: 'Suppliers', sales: 'Sales',
    analytics: 'Analytics', users: 'Users', permissions: 'Permissions',
  },
  topbar: { notifications: 'Notifications', clearAll: 'Clear all', noNotifications: 'No notifications', toggleDark: 'Toggle dark mode', logout: 'Logout', delete: 'Delete' },
  login: {
    tagline: 'Cheese Factory Management System', welcome: 'Welcome Back', subtitle: 'Sign in to manage your fromagerie',
    email: 'Email', password: 'Password', signIn: 'Sign In', signingIn: 'Signing in…',
    invalid: 'Invalid credentials.', connectFailed: 'Failed to connect. Please check that the server is running.',
  },
  users: {
    language: 'Language', english: 'English', french: 'Français',
    languageHelp: 'The language this user sees in the app. Printed documents are not affected.',
  },
};

export type Messages = typeof en;
export default en;
