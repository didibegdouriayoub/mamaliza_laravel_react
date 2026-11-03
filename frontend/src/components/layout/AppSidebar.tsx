import {
  LayoutDashboard, Package, BookOpen, Factory, ShieldCheck,
  ShoppingCart, BarChart3, Users, Calculator, Truck, Box, Layers, Warehouse, ScanLine,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import type { Permission } from '@/models/types';
import cheeseLogo from '@/assets/cheese-logo.png';

const navItems: { title: string; url: string; icon: typeof LayoutDashboard; permission?: Permission | Permission[]; group?: string }[] = [
  { title: 'nav.dashboard', url: '/', icon: LayoutDashboard, permission: 'analytics.read' },
  { title: 'nav.inventory', url: '/inventory', icon: Package, permission: 'inventory.read' },
  { title: 'nav.recipes', url: '/recipes', icon: BookOpen, permission: 'recipes.read' },
  { title: 'nav.batches', url: '/batches', icon: Factory, permission: 'batches.read' },
  { title: 'nav.quality', url: '/quality', icon: ShieldCheck, permission: 'quality.read' },
  { title: 'nav.estimation', url: '/estimation', icon: Calculator, permission: ['estimation.read', 'money.read'] },
  // Finished goods
  { title: 'nav.products', url: '/products', icon: Box, permission: 'products.read' },
  { title: 'nav.finishing', url: '/finishing', icon: Layers, permission: 'finishing.read' },
  { title: 'nav.finishedGoods', url: '/finished-goods', icon: Warehouse, permission: 'finished_goods.read' },
  { title: 'nav.scanLot', url: '/scan', icon: ScanLine, permission: 'scan.read' },
  // Sales & admin
  { title: 'nav.customers', url: '/customers', icon: Users, permission: 'customers.read' },
  { title: 'nav.suppliers', url: '/suppliers', icon: Truck, permission: 'suppliers.read' },
  { title: 'nav.tournees', url: '/tournees', icon: Truck, permission: 'sales.read' },
  { title: 'nav.sales', url: '/sales', icon: ShoppingCart, permission: ['sales.read', 'money.read'] },
  { title: 'nav.analytics', url: '/analytics', icon: BarChart3, permission: 'analytics.read' },
  { title: 'nav.users', url: '/users', icon: Users, permission: 'users.read' },
  { title: 'nav.permissions', url: '/permissions', icon: ShieldCheck, permission: 'permissions.read' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { hasPermission } = useAuth();
  const { t } = useTranslation();

  const visibleItems = navItems.filter(i => !i.permission || ([] as string[]).concat(i.permission).every(p => hasPermission(p as any)));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={cheeseLogo} alt="Logo" className="h-8 w-8 rounded-lg" />
            <span className="font-display font-semibold text-base text-foreground">Fromagerie</span>
          </div>
        )}
        {collapsed && (
          <img src={cheeseLogo} alt="Logo" className="h-8 w-8 rounded-lg mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation (no group) */}
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.filter(i => !i.group).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-accent/60"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{t(item.title)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-4">
        {/* Role switching is now handled by actual JWT claims upon login */}
      </SidebarFooter>
    </Sidebar>
  );
}
