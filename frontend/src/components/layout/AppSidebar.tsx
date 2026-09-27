import {
  LayoutDashboard, Package, BookOpen, Factory, ShieldCheck,
  ShoppingCart, BarChart3, Users, Calculator, PackageCheck, Recycle, Truck, Box, Layers, Warehouse,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import type { Permission } from '@/models/types';
import cheeseLogo from '@/assets/cheese-logo.png';

const navItems: { title: string; url: string; icon: typeof LayoutDashboard; permission?: Permission; group?: string }[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, permission: 'analytics.read' },
  { title: 'Inventory', url: '/inventory', icon: Package, permission: 'inventory.read' },
  { title: 'Recipes', url: '/recipes', icon: BookOpen, permission: 'recipes.read' },
  { title: 'Batches', url: '/batches', icon: Factory, permission: 'batches.read' },
  { title: 'Pieces Produced', url: '/pieces-produced', icon: PackageCheck, permission: 'pieces.read' },
  { title: 'Leftover', url: '/leftover', icon: Recycle, permission: 'leftover.read' },
  { title: 'Quality', url: '/quality', icon: ShieldCheck, permission: 'quality.read' },
  { title: 'Estimation', url: '/estimation', icon: Calculator, permission: 'estimation.read' },
  // Finished goods
  { title: 'Products', url: '/products', icon: Box, permission: 'analytics.read' },
  { title: 'Finishing', url: '/finishing', icon: Layers, permission: 'analytics.read' },
  { title: 'Finished Goods', url: '/finished-goods', icon: Warehouse, permission: 'analytics.read' },
  // Sales & admin
  { title: 'Customers', url: '/customers', icon: Users, permission: 'customers.read' },
  { title: 'Suppliers', url: '/suppliers', icon: Truck, permission: 'suppliers.read' },
  { title: 'Sales', url: '/sales', icon: ShoppingCart, permission: 'sales.read' },
  { title: 'Analytics', url: '/analytics', icon: BarChart3, permission: 'analytics.read' },
  { title: 'Users', url: '/users', icon: Users, permission: 'users.read' },
  { title: 'Permissions', url: '/permissions', icon: ShieldCheck, permission: 'permissions.read' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { hasPermission } = useAuth();

  const visibleItems = navItems.filter(i => !i.permission || hasPermission(i.permission));

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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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
                      {!collapsed && <span>{item.title}</span>}
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
