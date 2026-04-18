export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  created_at?: string;
}

export interface PreviewLink {
  label: string;
  url: string;
}

export interface Asset {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  url: string | null;
  previews: PreviewLink[];
  notes: string | null;
  images: string[];
  bought: boolean;
  favorite: boolean;
  priority: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  role: 'admin' | 'member';
  created_at?: string;
}

export interface DashboardStats {
  total: number;
  spent: number;
  open: number;
  pct: number;
  n: number;
  nBought: number;
  nOpen: number;
}
