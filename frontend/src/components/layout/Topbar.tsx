import { useState, useEffect } from 'react';
import { Bell, Moon, Sun, LogOut } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/services/notificationService';
import { Notification } from '@/models/types';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function Topbar() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const load = async () => {
      try {
         const data = await notificationService.getAll();
         setNotifications(data || []);
      } catch(e) {}
    };
    load();
    const interval = setInterval(load, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(!dark);
  };

  const typeColor: Record<string, string> = {
    warning: 'bg-warning text-warning-foreground',
    error: 'bg-destructive text-destructive-foreground',
    info: 'bg-info text-info-foreground',
    success: 'bg-success text-success-foreground',
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shadow-soft">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDark} title="Toggle dark mode">
          {dark ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b">
              <h4 className="font-display font-semibold text-sm">Notifications</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className={`p-3 border-b last:border-0 ${!n.read ? 'bg-accent/30' : ''}`}>
                  <div className="flex items-start gap-2">
                    <Badge className={`${typeColor[n.type]} text-[10px] px-1.5 py-0 shrink-0 mt-0.5`}>
                      {n.type}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-semibold">
              {user.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={logout} title="Logout">
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
