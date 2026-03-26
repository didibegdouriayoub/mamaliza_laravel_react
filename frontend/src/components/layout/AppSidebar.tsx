import {
  LayoutDashboard, Package, BookOpen, Factory, ShieldCheck,
  ShoppingCart, BarChart3, Users, Calculator, ClipboardList,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Permission, UserRole } from '@/models/types';
import cheeseLogo from '@/assets/cheese-logo.png';

const navItems: { title: string; url: string; icon: typeof LayoutDashboard; permission?: Permission }[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, permission: 'view_analytics' },
  { title: 'Inventory', url: '/inventory', icon: Package, permission: 'manage_inventory' },
  { title: 'Recipes', url: '/recipes', icon: BookOpen, permission: 'manage_recipes' },
  { title: 'Batches', url: '/batches', icon: Factory, permission: 'manage_batches' },
  { title: 'Production', url: '/production', icon: ClipboardList, permission: 'manage_batches' },
  { title: 'Quality', url: '/quality', icon: ShieldCheck, permission: 'manage_quality' },
  { title: 'Estimation', url: '/estimation', icon: Calculator, permission: 'manage_inventory' },
  { title: 'Customers', url: '/customers', icon: Users, permission: 'manage_sales' },
  { title: 'Sales', url: '/sales', icon: ShoppingCart, permission: 'manage_sales' },
  { title: 'Analytics', url: '/analytics', icon: BarChart3, permission: 'view_analytics' },
  { title: 'Users', url: '/users', icon: Users, permission: 'manage_users' },
  { title: 'Permissions', url: '/permissions', icon: ShieldCheck, permission: 'manage_users' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { hasPermission, user } = useAuth();

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
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
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
