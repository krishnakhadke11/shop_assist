// Dummy data for the customer Home screen (docs/shopassist-ui-plan.md §5.3).
// Note: `rating` below is a deliberate deviation from that doc's §10, which
// drops star ratings for lack of a review corpus. Kept here per explicit
// card-design direction; reconsider before this becomes real data.

export interface Category {
  slug: string;
  name: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'kirana', name: 'Kirana', icon: '🛒' },
  { slug: 'dairy', name: 'Dairy', icon: '🥛' },
  { slug: 'medical', name: 'Medical Shop', icon: '💊' },
  { slug: 'garments', name: 'Garments', icon: '👕' },
  { slug: 'flowers', name: 'Flowers', icon: '💐' },
  { slug: 'atta-chakki', name: 'Atta Chakki', icon: '🌾' },
  { slug: 'bakery', name: 'Bakery', icon: '🍞' },
  { slug: 'stationery', name: 'Stationery', icon: '✏️' },
];

export interface Merchant {
  id: string;
  name: string;
  categorySlug: string;
  category: string;
  distanceKm: number;
  isOpen: boolean;
  hours: string;
  phone: string;
  rating: number;
  recentlyOrdered?: boolean;
}

export const MERCHANTS: Merchant[] = [
  {
    id: 'm1',
    name: 'Sharma Kirana Store',
    categorySlug: 'kirana',
    category: 'Kirana',
    distanceKm: 0.4,
    isOpen: true,
    hours: 'Closes 10 PM',
    phone: '9876543210',
    rating: 4.6,
    recentlyOrdered: true,
  },
  {
    id: 'm2',
    name: 'Shri Ganesh Dairy',
    categorySlug: 'dairy',
    category: 'Dairy',
    distanceKm: 0.6,
    isOpen: true,
    hours: 'Closes 9 PM',
    phone: '9876500001',
    rating: 4.4,
    recentlyOrdered: true,
  },
  {
    id: 'm3',
    name: 'Apollo Medical Store',
    categorySlug: 'medical',
    category: 'Medical Shop',
    distanceKm: 0.3,
    isOpen: true,
    hours: 'Open 24 hours',
    phone: '9876500002',
    rating: 4.8,
  },
  {
    id: 'm4',
    name: 'Fashion Point Garments',
    categorySlug: 'garments',
    category: 'Garments',
    distanceKm: 1.1,
    isOpen: false,
    hours: 'Opens 10 AM',
    phone: '9876500003',
    rating: 4.1,
  },
  {
    id: 'm5',
    name: 'Phool Wala Flower Shop',
    categorySlug: 'flowers',
    category: 'Flowers',
    distanceKm: 0.8,
    isOpen: true,
    hours: 'Closes 8 PM',
    phone: '9876500004',
    rating: 4.5,
    recentlyOrdered: true,
  },
  {
    id: 'm6',
    name: 'Aashirwaad Atta Chakki',
    categorySlug: 'atta-chakki',
    category: 'Atta Chakki',
    distanceKm: 0.9,
    isOpen: true,
    hours: 'Closes 7 PM',
    phone: '9876500005',
    rating: 4.7,
  },
  {
    id: 'm7',
    name: 'New Bombay Bakery',
    categorySlug: 'bakery',
    category: 'Bakery',
    distanceKm: 1.4,
    isOpen: true,
    hours: 'Closes 9 PM',
    phone: '9876500006',
    rating: 4.3,
  },
  {
    id: 'm8',
    name: 'Patel Stationery Mart',
    categorySlug: 'stationery',
    category: 'Stationery',
    distanceKm: 1.6,
    isOpen: false,
    hours: 'Opens 9 AM',
    phone: '9876500007',
    rating: 3.9,
  },
];
